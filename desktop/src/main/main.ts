/*
 * 3D Asset Manager
 * Copyright (C) 2025 Mark Kats
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import { DatabaseService } from "./services/database.js";
import { FileWatcherService } from "./services/fileWatcher.js";
import { ThumbnailService } from "./services/thumbnail.js";

// Define __dirname for ES modules (CommonJS has it built-in)
const getDirname = (): string => {
  try {
    // @ts-ignore - import.meta is available in ESM
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback for CommonJS (development builds) - __dirname is a global
    // @ts-ignore - __dirname exists in CommonJS
    return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
};
const __dirname: string = getDirname();

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let fileWatcherService: FileWatcherService;
let thumbnailService: ThumbnailService;

const isDev = process.env.NODE_ENV === "development";

// Register custom protocol scheme as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);

function createWindow() {
  // Icon path - works for both dev and production
  // Use .ico for Windows, .png for other platforms
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  const iconPath = isDev
    ? path.join(__dirname, "../../resources", iconFile)
    : path.join(process.resourcesPath, "resources", iconFile);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: iconPath,
    title: "Forma",
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Initialize services
async function initializeServices() {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "assets.db");

  dbService = new DatabaseService(dbPath);
  thumbnailService = new ThumbnailService(dbService);

  // Pass mainWindow to fileWatcherService for progress updates
  fileWatcherService = new FileWatcherService(dbService, thumbnailService, mainWindow!);

  // Load watched folders from database and start watching
  const watchedFolders = dbService.getWatchedFolders();
  for (const folder of watchedFolders) {
    if (folder.enabled) {
      await fileWatcherService.addWatchedFolder(folder.path);
    }
  }
}

// IPC Handlers

// Get all assets
ipcMain.handle("db:getAssets", async () => {
  return dbService.getAllAssets();
});

// Get single asset
ipcMain.handle("db:getAsset", async (_event, id: number) => {
  return dbService.getAsset(id);
});

// Search assets
ipcMain.handle("db:searchAssets", async (_event, query: string) => {
  return dbService.searchAssets(query);
});

// Get assets by tag
ipcMain.handle("db:getAssetsByTag", async (_event, tag: string) => {
  return dbService.getAssetsByTag(tag);
});

// Update asset metadata
ipcMain.handle("db:updateAsset", async (_event, id: number, data: any) => {
  const updatedAsset = dbService.updateAsset(id, data);
  // Notify renderer process that asset was updated
  if (updatedAsset) {
    notifyAssetUpdated(updatedAsset);
  }
  return updatedAsset;
});

// Delete asset
ipcMain.handle("db:deleteAsset", async (_event, id: number) => {
  return dbService.deleteAsset(id);
});

// Get all tags
ipcMain.handle("db:getAllTags", async () => {
  return dbService.getAllTags();
});

// Get watched folders
ipcMain.handle("db:getWatchedFolders", async () => {
  return dbService.getWatchedFolders();
});

// Add watched folder
ipcMain.handle("folders:add", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    const folder = dbService.addWatchedFolder(folderPath);
    await fileWatcherService.addWatchedFolder(folderPath);
    return folder;
  }
  return null;
});

// Remove watched folder
ipcMain.handle("folders:remove", async (_event, id: number) => {
  const folder = dbService.getWatchedFolder(id);
  if (folder) {
    fileWatcherService.removeWatchedFolder(folder.path);
    dbService.removeWatchedFolder(id);
    return true;
  }
  return false;
});

// Toggle folder watching
ipcMain.handle(
  "folders:toggle",
  async (_event, id: number, enabled: boolean) => {
    const folder = dbService.updateWatchedFolder(id, { enabled });
    if (folder) {
      if (enabled) {
        await fileWatcherService.addWatchedFolder(folder.path);
      } else {
        fileWatcherService.removeWatchedFolder(folder.path);
      }
      return folder;
    }
    return null;
  }
);

// Rescan folder
ipcMain.handle("folders:rescan", async (_event, id: number) => {
  const folder = dbService.getWatchedFolder(id);
  if (folder) {
    await fileWatcherService.rescanFolder(folder.path);
    return true;
  }
  return false;
});

// Cancel folder scan
ipcMain.handle("folders:cancelScan", async (_event, folderPath: string) => {
  fileWatcherService.cancelScan(folderPath);
  return true;
});

// Get file path for asset
ipcMain.handle("file:getPath", async (_event, id: number) => {
  const asset = dbService.getAsset(id);
  return asset?.filePath || null;
});

// Get thumbnail as base64
ipcMain.handle("file:getThumbnail", async (_event, id: number) => {
  const thumbnail = dbService.getThumbnail(id);
  if (thumbnail) {
    // Check if it's an SVG (starts with '<svg')
    const content = thumbnail.toString("utf-8");
    if (content.trim().startsWith("<svg")) {
      return `data:image/svg+xml;base64,${thumbnail.toString("base64")}`;
    }
    // Otherwise treat as JPEG
    return `data:image/jpeg;base64,${thumbnail.toString("base64")}`;
  }
  return null;
});

// Read model file and return as ArrayBuffer
ipcMain.handle("file:readModel", async (_event, id: number) => {
  const asset = dbService.getAsset(id);
  if (!asset) return null;

  try {
    const fs = await import("fs/promises");
    const buffer = await fs.readFile(asset.filePath);
    // Return as Uint8Array which can be transferred
    return new Uint8Array(buffer);
  } catch (error) {
    console.error("Error reading model file:", error);
    return null;
  }
});

// Save thumbnail generated in renderer
ipcMain.handle(
  "file:saveThumbnail",
  async (_event, id: number, thumbnailData: string) => {
    try {
      thumbnailService.saveThumbnailFromRenderer(id, thumbnailData);
      return true;
    } catch (error) {
      console.error("Error saving thumbnail:", error);
      return false;
    }
  }
);

// Clear all thumbnails
ipcMain.handle("thumbnails:clearAll", async () => {
  try {
    const count = dbService.clearAllThumbnails();
    return count;
  } catch (error) {
    console.error("Error clearing thumbnails:", error);
    return 0;
  }
});

// Save screenshot with dialog
ipcMain.handle(
  "screenshot:save",
  async (_event, imageData: string, defaultFilename: string) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: "Save Screenshot",
        defaultPath: defaultFilename,
        filters: [
          { name: "PNG Image", extensions: ["png"] },
          { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
        ],
      });

      if (!result.canceled && result.filePath) {
        const fs = await import("fs/promises");
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        await fs.writeFile(result.filePath, buffer);
        return { success: true, path: result.filePath };
      }
      return { success: false, path: null };
    } catch (error) {
      console.error("Error saving screenshot:", error);
      return {
        success: false,
        path: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
);

// Show file in explorer
ipcMain.handle("file:showInExplorer", async (_event, id: number) => {
  const asset = dbService.getAsset(id);
  if (asset && asset.filePath) {
    shell.showItemInFolder(asset.filePath);
    return true;
  }
  return false;
});

// Select background file
ipcMain.handle("background:selectFile", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [
      {
        name: "Images and Videos",
        extensions: ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov"],
      },
      { name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] },
      { name: "Videos", extensions: ["mp4", "webm", "mov"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    // Convert to custom protocol URL
    const customUrl = `local-file://${encodeURIComponent(filePath)}`;
    return {
      success: true,
      cancelled: false,
      filePath: customUrl,
    };
  }
  return { success: true, cancelled: true, filePath: null };
});

// App lifecycle
app.whenReady().then(async () => {
  // Register the protocol handler
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const url = request.url.replace('local-file://', '');
    const decodedPath = decodeURIComponent(url);
    try {
      return callback(decodedPath);
    } catch (error) {
      console.error('Error loading local file:', error);
      return callback({ error: -2 } as any);
    }
  });

  await initializeServices();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    fileWatcherService?.cleanup();
    app.quit();
  }
});

app.on("before-quit", () => {
  fileWatcherService?.cleanup();
});

// Send updates to renderer when new assets are discovered
export function notifyAssetAdded(asset: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("asset:added", asset);
  }
}

export function notifyAssetUpdated(asset: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("asset:updated", asset);
  }
}

export function notifyAssetRemoved(id: number) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("asset:removed", id);
  }
}
