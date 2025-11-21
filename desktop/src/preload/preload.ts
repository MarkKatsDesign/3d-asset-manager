import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Asset operations
  getAssets: () => ipcRenderer.invoke('db:getAssets'),
  getAsset: (id: number) => ipcRenderer.invoke('db:getAsset', id),
  searchAssets: (query: string) => ipcRenderer.invoke('db:searchAssets', query),
  getAssetsByTag: (tag: string) => ipcRenderer.invoke('db:getAssetsByTag', tag),
  updateAsset: (id: number, data: any) => ipcRenderer.invoke('db:updateAsset', id, data),
  deleteAsset: (id: number) => ipcRenderer.invoke('db:deleteAsset', id),
  getAllTags: () => ipcRenderer.invoke('db:getAllTags'),

  // Folder operations
  getWatchedFolders: () => ipcRenderer.invoke('db:getWatchedFolders'),
  addWatchedFolder: () => ipcRenderer.invoke('folders:add'),
  removeWatchedFolder: (id: number) => ipcRenderer.invoke('folders:remove', id),
  toggleWatchedFolder: (id: number, enabled: boolean) => ipcRenderer.invoke('folders:toggle', id, enabled),
  rescanFolder: (id: number) => ipcRenderer.invoke('folders:rescan', id),

  // File operations
  getFilePath: (id: number) => ipcRenderer.invoke('file:getPath', id),
  getThumbnail: (id: number) => ipcRenderer.invoke('file:getThumbnail', id),

  // Event listeners for real-time updates
  onAssetAdded: (callback: (asset: any) => void) => {
    const listener = (_event: any, asset: any) => callback(asset);
    ipcRenderer.on('asset:added', listener);
    return () => ipcRenderer.removeListener('asset:added', listener);
  },
  onAssetUpdated: (callback: (asset: any) => void) => {
    const listener = (_event: any, asset: any) => callback(asset);
    ipcRenderer.on('asset:updated', listener);
    return () => ipcRenderer.removeListener('asset:updated', listener);
  },
  onAssetRemoved: (callback: (id: number) => void) => {
    const listener = (_event: any, id: number) => callback(id);
    ipcRenderer.on('asset:removed', listener);
    return () => ipcRenderer.removeListener('asset:removed', listener);
  }
});

// Type definitions for TypeScript
export interface ElectronAPI {
  getAssets: () => Promise<any[]>;
  getAsset: (id: number) => Promise<any>;
  searchAssets: (query: string) => Promise<any[]>;
  getAssetsByTag: (tag: string) => Promise<any[]>;
  updateAsset: (id: number, data: any) => Promise<any>;
  deleteAsset: (id: number) => Promise<boolean>;
  getAllTags: () => Promise<string[]>;
  getWatchedFolders: () => Promise<any[]>;
  addWatchedFolder: () => Promise<any>;
  removeWatchedFolder: (id: number) => Promise<boolean>;
  toggleWatchedFolder: (id: number, enabled: boolean) => Promise<any>;
  rescanFolder: (id: number) => Promise<boolean>;
  getFilePath: (id: number) => Promise<string | null>;
  getThumbnail: (id: number) => Promise<string | null>;
  onAssetAdded: (callback: (asset: any) => void) => () => void;
  onAssetUpdated: (callback: (asset: any) => void) => () => void;
  onAssetRemoved: (callback: (id: number) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
