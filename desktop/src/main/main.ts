import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import { DatabaseService } from "./services/database.js";
import { FileWatcherService } from "./services/fileWatcher.js";
import { ThumbnailService } from "./services/thumbnail.js";

// In CommonJS, __dirname is already available
declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let fileWatcherService: FileWatcherService;
let thumbnailService: ThumbnailService;

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
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
    icon: path.join(__dirname, "../../resources/icon.png"),
    title: "3D Asset Manager",
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
  fileWatcherService = new FileWatcherService(dbService, thumbnailService);

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
  return dbService.updateAsset(id, data);
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
    console.log(`Cleared ${count} thumbnails`);
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

// App lifecycle
app.whenReady().then(async () => {
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
