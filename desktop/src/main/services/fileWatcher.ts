import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { DatabaseService } from './database.js';
import { ThumbnailService } from './thumbnail.js';
import { BrowserWindow } from 'electron';

interface ScanProgress {
  folderId: number;
  folderPath: string;
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  foundModels: number;
}

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private dbService: DatabaseService;
  private thumbnailService: ThumbnailService;
  private mainWindow: BrowserWindow | null = null;
  private activeScanControllers: Map<string, AbortController> = new Map();

  // Supported 3D file extensions
  private supportedExtensions = ['.glb', '.obj', '.fbx', '.stl'];

  // Performance tuning
  private readonly MAX_CONCURRENT_SCANS = 5; // Max parallel folder scans
  private readonly BATCH_SIZE = 50; // Database insert batch size
  private readonly PROGRESS_THROTTLE = 100; // ms between progress updates

  constructor(dbService: DatabaseService, thumbnailService: ThumbnailService, mainWindow?: BrowserWindow) {
    this.dbService = dbService;
    this.thumbnailService = thumbnailService;
    if (mainWindow) {
      this.mainWindow = mainWindow;
    }
  }

  setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  async addWatchedFolder(folderPath: string): Promise<void> {
    if (this.watchers.has(folderPath)) {
      return;
    }

    // Get or create folder record
    let folder = this.dbService.getWatchedFolderByPath(folderPath);
    if (!folder) {
      folder = this.dbService.addWatchedFolder(folderPath);
    }

    // Initial scan of the folder
    await this.scanFolder(folderPath, folder.id!);

    // Set up file watcher
    const watcher = chokidar.watch(folderPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true, // we already did initial scan
      depth: 99, // watch subdirectories
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    watcher
      .on('add', (filePath) => this.onFileAdded(filePath, folder!.id!))
      .on('change', (filePath) => this.onFileChanged(filePath))
      .on('unlink', (filePath) => this.onFileRemoved(filePath))
      .on('error', (error) => console.error(`Watcher error: ${error}`));

    this.watchers.set(folderPath, watcher);
  }

  removeWatchedFolder(folderPath: string): void {
    const watcher = this.watchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(folderPath);
    }
  }

  async rescanFolder(folderPath: string): Promise<void> {
    const folder = this.dbService.getWatchedFolderByPath(folderPath);
    if (!folder) {
      console.error(`Folder not found: ${folderPath}`);
      return;
    }

    // Remove all assets from this folder
    const assets = this.dbService.getAssetsByFolder(folder.id!);
    for (const asset of assets) {
      this.dbService.deleteAsset(asset.id!);
    }

    // Rescan
    await this.scanFolder(folderPath, folder.id!);
  }

  private async scanFolder(folderPath: string, folderId: number): Promise<void> {
    const startTime = Date.now();

    // Create abort controller for this scan
    const abortController = new AbortController();
    this.activeScanControllers.set(folderPath, abortController);

    try {
      // Fast parallel file discovery
      const allFiles = await this.getAllFilesParallel(folderPath, abortController.signal);

      if (abortController.signal.aborted) {
        return;
      }

      // Filter for supported models
      const modelFiles = allFiles.filter(file =>
        this.supportedExtensions.includes(path.extname(file).toLowerCase())
      );

      // Batch process model files with progress reporting
      await this.processModelsBatch(modelFiles, folderId, folderPath, abortController.signal);

      if (!abortController.signal.aborted) {
        this.dbService.markFolderScanned(folderId);

        // Send completion notification
        this.sendProgress({
          folderId,
          folderPath,
          totalFiles: modelFiles.length,
          processedFiles: modelFiles.length,
          currentFile: '',
          foundModels: modelFiles.length
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(`Error scanning folder: ${error}`);
      }
    } finally {
      this.activeScanControllers.delete(folderPath);
    }
  }

  /**
   * Fast parallel file discovery with configurable concurrency
   */
  private async getAllFilesParallel(
    dirPath: string,
    signal: AbortSignal,
    files: string[] = []
  ): Promise<string[]> {
    if (signal.aborted) return files;

    try {
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

      // Separate files and directories
      const fileEntries: string[] = [];
      const dirEntries: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          dirEntries.push(fullPath);
        } else if (entry.isFile()) {
          fileEntries.push(fullPath);
        }
      }

      // Add files to result
      files.push(...fileEntries);

      // Process subdirectories in parallel with concurrency limit
      if (dirEntries.length > 0) {
        await this.processInBatches(
          dirEntries,
          this.MAX_CONCURRENT_SCANS,
          async (subDir) => {
            if (!signal.aborted) {
              await this.getAllFilesParallel(subDir, signal, files);
            }
          }
        );
      }

      return files;
    } catch (error) {
      // Skip directories we can't access
      console.warn(`Cannot access: ${dirPath}`);
      return files;
    }
  }

  /**
   * Process items in batches with concurrency control
   */
  private async processInBatches<T>(
    items: T[],
    batchSize: number,
    processor: (item: T) => Promise<void>
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(item => processor(item)));
    }
  }

  /**
   * Process model files in batches with progress reporting
   */
  private async processModelsBatch(
    modelFiles: string[],
    folderId: number,
    folderPath: string,
    signal: AbortSignal
  ): Promise<void> {
    let processedCount = 0;
    let foundModels = 0;
    let lastProgressUpdate = Date.now();

    for (let i = 0; i < modelFiles.length; i += this.BATCH_SIZE) {
      if (signal.aborted) break;

      const batch = modelFiles.slice(i, i + this.BATCH_SIZE);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(filePath => this.addAssetFromFile(filePath, folderId))
      );

      // Count successful additions
      foundModels += results.filter(r => r.status === 'fulfilled').length;
      processedCount += batch.length;

      // Throttled progress updates
      const now = Date.now();
      if (now - lastProgressUpdate >= this.PROGRESS_THROTTLE) {
        this.sendProgress({
          folderId,
          folderPath,
          totalFiles: modelFiles.length,
          processedFiles: processedCount,
          currentFile: batch[0] ? path.basename(batch[0]) : '',
          foundModels
        });
        lastProgressUpdate = now;
      }
    }
  }

  /**
   * Send progress update to renderer process
   */
  private sendProgress(progress: ScanProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('scan-progress', progress);
    }
  }

  /**
   * Cancel an active folder scan
   */
  cancelScan(folderPath: string): void {
    const controller = this.activeScanControllers.get(folderPath);
    if (controller) {
      controller.abort();
      console.log(`Cancelling scan: ${folderPath}`);
    }
  }

  private async addAssetFromFile(filePath: string, folderId: number): Promise<void> {
    try {
      // Check if asset already exists
      const existing = this.dbService.getAssetByPath(filePath);
      if (existing) {
        return;
      }

      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath, path.extname(filePath));

      // Create asset record
      const asset = this.dbService.createAsset({
        name: fileName,
        filePath: filePath,
        fileSize: stats.size,
        folderId: folderId,
        tags: []
      });

      // Generate thumbnail asynchronously
      this.thumbnailService.generateThumbnail(asset.id!, filePath)
        .catch(error => {
          console.error(`Failed to generate thumbnail for ${filePath}:`, error);
        });

    } catch (error) {
      console.error(`Error adding asset from file ${filePath}:`, error);
    }
  }

  private async onFileAdded(filePath: string, folderId: number): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return;
    }

    await this.addAssetFromFile(filePath, folderId);
  }

  private async onFileChanged(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return;
    }

    const asset = this.dbService.getAssetByPath(filePath);
    if (asset) {
      // Update file size
      const stats = fs.statSync(filePath);
      this.dbService.updateAsset(asset.id!, {
        fileSize: stats.size
      });

      // Regenerate thumbnail
      await this.thumbnailService.generateThumbnail(asset.id!, filePath);
    }
  }

  private onFileRemoved(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return;
    }

    const asset = this.dbService.getAssetByPath(filePath);
    if (asset) {
      this.dbService.deleteAsset(asset.id!);
    }
  }

  cleanup(): void {
    for (const [folderPath, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
