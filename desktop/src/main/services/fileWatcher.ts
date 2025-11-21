import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from './database.js';
import { ThumbnailService } from './thumbnail.js';

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private dbService: DatabaseService;
  private thumbnailService: ThumbnailService;

  // Supported 3D file extensions
  private supportedExtensions = ['.glb', '.gltf'];

  constructor(dbService: DatabaseService, thumbnailService: ThumbnailService) {
    this.dbService = dbService;
    this.thumbnailService = thumbnailService;
  }

  async addWatchedFolder(folderPath: string): Promise<void> {
    if (this.watchers.has(folderPath)) {
      console.log(`Already watching: ${folderPath}`);
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
    console.log(`Now watching: ${folderPath}`);
  }

  removeWatchedFolder(folderPath: string): void {
    const watcher = this.watchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(folderPath);
      console.log(`Stopped watching: ${folderPath}`);
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
    console.log(`Scanning folder: ${folderPath}`);

    try {
      const files = await this.getAllFiles(folderPath);
      const modelFiles = files.filter(file =>
        this.supportedExtensions.includes(path.extname(file).toLowerCase())
      );

      console.log(`Found ${modelFiles.length} 3D models in ${folderPath}`);

      for (const filePath of modelFiles) {
        await this.addAssetFromFile(filePath, folderId);
      }

      this.dbService.markFolderScanned(folderId);
    } catch (error) {
      console.error(`Error scanning folder: ${error}`);
    }
  }

  private async getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          arrayOfFiles = await this.getAllFiles(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath);
        }
      } catch (error) {
        // Skip files we can't access
        console.warn(`Cannot access: ${fullPath}`);
      }
    }

    return arrayOfFiles;
  }

  private async addAssetFromFile(filePath: string, folderId: number): Promise<void> {
    try {
      // Check if asset already exists
      const existing = this.dbService.getAssetByPath(filePath);
      if (existing) {
        console.log(`Asset already exists: ${filePath}`);
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

      console.log(`Added asset: ${fileName}`);

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

    console.log(`New file detected: ${filePath}`);
    await this.addAssetFromFile(filePath, folderId);
  }

  private async onFileChanged(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return;
    }

    const asset = this.dbService.getAssetByPath(filePath);
    if (asset) {
      console.log(`File changed: ${filePath}`);

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
      console.log(`File removed: ${filePath}`);
      this.dbService.deleteAsset(asset.id!);
    }
  }

  cleanup(): void {
    console.log('Cleaning up file watchers...');
    for (const [folderPath, watcher] of this.watchers) {
      watcher.close();
      console.log(`Stopped watching: ${folderPath}`);
    }
    this.watchers.clear();
  }
}
