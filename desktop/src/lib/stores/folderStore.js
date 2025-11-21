import { writable } from 'svelte/store';

function createFolderStore() {
  const { subscribe, set, update } = writable({
    folders: [],
    loading: false,
    error: null
  });

  return {
    subscribe,

    loadFolders: async () => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const folders = await window.electronAPI.getWatchedFolders();
        update(state => ({ ...state, folders, loading: false }));
      } catch (error) {
        console.error('Error loading folders:', error);
        update(state => ({ ...state, loading: false, error: error.message }));
      }
    },

    addFolder: async () => {
      try {
        const folder = await window.electronAPI.addWatchedFolder();
        if (folder) {
          update(state => ({
            ...state,
            folders: [...state.folders, folder]
          }));
          return { success: true, folder };
        }
        return { success: false, cancelled: true };
      } catch (error) {
        console.error('Error adding folder:', error);
        return { success: false, error: error.message };
      }
    },

    removeFolder: async (id) => {
      try {
        const success = await window.electronAPI.removeWatchedFolder(id);
        if (success) {
          update(state => ({
            ...state,
            folders: state.folders.filter(f => f.id !== id)
          }));
        }
        return { success };
      } catch (error) {
        console.error('Error removing folder:', error);
        return { success: false, error: error.message };
      }
    },

    toggleFolder: async (id, enabled) => {
      try {
        const folder = await window.electronAPI.toggleWatchedFolder(id, enabled);
        if (folder) {
          update(state => ({
            ...state,
            folders: state.folders.map(f => f.id === id ? folder : f)
          }));
        }
        return { success: true, folder };
      } catch (error) {
        console.error('Error toggling folder:', error);
        return { success: false, error: error.message };
      }
    },

    rescanFolder: async (id) => {
      try {
        const success = await window.electronAPI.rescanFolder(id);
        return { success };
      } catch (error) {
        console.error('Error rescanning folder:', error);
        return { success: false, error: error.message };
      }
    }
  };
}

export const folderStore = createFolderStore();
