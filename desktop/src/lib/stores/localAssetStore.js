import { writable } from 'svelte/store';
import { generateThumbnail } from '../utils/thumbnailGenerator';

function createLocalAssetStore() {
  const { subscribe, set, update } = writable({
    assets: [],
    loading: false,
    error: null,
    searchQuery: '',
    selectedTags: [],
    sortBy: 'date-desc',
    selectedFileTypes: [],
    viewMode: 'grid', // 'grid' or 'grouped'
    expandedFolders: {}, // Track which folders are expanded (path -> boolean)
    thumbnailProgress: { current: 0, total: 0, isGenerating: false }, // Track thumbnail generation
    regeneratingAll: false, // Track when bulk regeneration is happening
    regeneratingAssets: new Set() // Track which specific assets are being regenerated
  });

  let unsubscribeAdded = null;
  let unsubscribeUpdated = null;
  let unsubscribeRemoved = null;

  const store = {
    subscribe,

    init: async () => {
      // Set up real-time listeners
      if (window.electronAPI) {
        unsubscribeAdded = window.electronAPI.onAssetAdded((asset) => {
          update(state => ({
            ...state,
            assets: [asset, ...state.assets]
          }));
        });

        unsubscribeUpdated = window.electronAPI.onAssetUpdated((asset) => {
          update(state => ({
            ...state,
            assets: state.assets.map(a => a.id === asset.id ? asset : a)
          }));
        });

        unsubscribeRemoved = window.electronAPI.onAssetRemoved((id) => {
          update(state => ({
            ...state,
            assets: state.assets.filter(a => a.id !== id)
          }));
        });
      }

      // Load initial assets
      await store.loadAssets();
    },

    loadAssets: async () => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const assets = await window.electronAPI.getAssets();
        update(state => ({ ...state, assets, loading: false }));

        // Generate thumbnails for assets that don't have them
        store.generateMissingThumbnails(assets);
      } catch (error) {
        console.error('Error loading assets:', error);
        update(state => ({ ...state, loading: false, error: error.message }));
      }
    },

    generateMissingThumbnails: async (assets) => {
      // Count assets that need thumbnails
      const assetsNeedingThumbnails = [];

      for (const asset of assets) {
        const existingThumbnail = await window.electronAPI.getThumbnail(asset.id);
        if (!existingThumbnail || existingThumbnail.includes('svg+xml')) {
          assetsNeedingThumbnails.push(asset);
        }
      }

      if (assetsNeedingThumbnails.length === 0) return;

      // Update progress
      update(state => ({
        ...state,
        thumbnailProgress: { current: 0, total: assetsNeedingThumbnails.length, isGenerating: true }
      }));

      // Generate thumbnails in the background
      let completed = 0;
      for (const asset of assetsNeedingThumbnails) {
        try {
          // Generate thumbnail
          const thumbnailData = await generateThumbnail(asset.id, asset.filePath);

          // Save to database if generation succeeded
          if (thumbnailData) {
            await window.electronAPI.saveThumbnail(asset.id, thumbnailData);
          }
        } catch (error) {
          console.log(`Skipped thumbnail for asset ${asset.id}`);
          // Continue with other assets even if one fails
        }

        // Update progress
        completed++;
        update(state => ({
          ...state,
          thumbnailProgress: { current: completed, total: assetsNeedingThumbnails.length, isGenerating: true }
        }));
      }

      // Mark as complete
      update(state => ({
        ...state,
        thumbnailProgress: { current: completed, total: assetsNeedingThumbnails.length, isGenerating: false }
      }));
    },

    regenerateAllThumbnails: async () => {
      try {
        // Clear all existing thumbnails
        const clearedCount = await window.electronAPI.clearAllThumbnails();

        // Get all current assets
        const assets = await window.electronAPI.getAssets();

        // Set regeneratingAll flag to show spinners on all thumbnails
        update(state => ({
          ...state,
          regeneratingAll: true,
          regeneratingAssets: new Set(assets.map(a => a.id))
        }));

        // Generate thumbnails for all assets
        let successCount = 0;
        let failCount = 0;

        for (const asset of assets) {
          try {
            const thumbnailData = await generateThumbnail(asset.id, asset.filePath);

            if (thumbnailData) {
              await window.electronAPI.saveThumbnail(asset.id, thumbnailData);
              successCount++;

              // Remove this asset from regenerating set and trigger update
              update(state => {
                const newRegeneratingAssets = new Set(state.regeneratingAssets);
                newRegeneratingAssets.delete(asset.id);
                return {
                  ...state,
                  regeneratingAssets: newRegeneratingAssets,
                  // Trigger asset update to refresh thumbnail
                  assets: state.assets.map(a =>
                    a.id === asset.id
                      ? { ...a, _thumbnailUpdated: Date.now() }
                      : a
                  )
                };
              });
            } else {
              failCount++;
              // Still remove from regenerating set even if failed
              update(state => {
                const newRegeneratingAssets = new Set(state.regeneratingAssets);
                newRegeneratingAssets.delete(asset.id);
                return {
                  ...state,
                  regeneratingAssets: newRegeneratingAssets
                };
              });
            }
          } catch (error) {
            failCount++;
            console.error(`✗ Error generating thumbnail for ${asset.name}:`, error);

            // Remove from regenerating set on error
            update(state => {
              const newRegeneratingAssets = new Set(state.regeneratingAssets);
              newRegeneratingAssets.delete(asset.id);
              return {
                ...state,
                regeneratingAssets: newRegeneratingAssets
              };
            });
          }
        }

        // Clear regeneratingAll flag when done
        update(state => ({
          ...state,
          regeneratingAll: false,
          regeneratingAssets: new Set()
        }));

        return { success: true, total: assets.length, successful: successCount, failed: failCount };
      } catch (error) {
        console.error('Error regenerating thumbnails:', error);

        // Clear flags on error
        update(state => ({
          ...state,
          regeneratingAll: false,
          regeneratingAssets: new Set()
        }));

        return { success: false, error: error.message };
      }
    },

    getAsset: async (id) => {
      try {
        return await window.electronAPI.getAsset(id);
      } catch (error) {
        console.error('Error getting asset:', error);
        return null;
      }
    },

    updateAsset: async (id, data) => {
      try {
        const updatedAsset = await window.electronAPI.updateAsset(id, data);
        update(state => ({
          ...state,
          assets: state.assets.map(a => a.id === id ? updatedAsset : a)
        }));
        return { success: true, asset: updatedAsset };
      } catch (error) {
        console.error('Update error:', error);
        return { success: false, error: error.message };
      }
    },

    deleteAsset: async (id) => {
      try {
        await window.electronAPI.deleteAsset(id);
        update(state => ({
          ...state,
          assets: state.assets.filter(asset => asset.id !== id)
        }));
        return { success: true };
      } catch (error) {
        console.error('Delete error:', error);
        return { success: false, error: error.message };
      }
    },

    searchAssets: async (query) => {
      if (!query) {
        await store.loadAssets();
        return;
      }

      update(state => ({ ...state, loading: true }));
      try {
        const assets = await window.electronAPI.searchAssets(query);
        update(state => ({ ...state, assets, loading: false }));
      } catch (error) {
        console.error('Search error:', error);
        update(state => ({ ...state, loading: false, error: error.message }));
      }
    },

    getAssetsByTag: async (tag) => {
      update(state => ({ ...state, loading: true }));
      try {
        const assets = await window.electronAPI.getAssetsByTag(tag);
        update(state => ({ ...state, assets, loading: false }));
      } catch (error) {
        console.error('Error getting assets by tag:', error);
        update(state => ({ ...state, loading: false, error: error.message }));
      }
    },

    getAllTags: async () => {
      try {
        return await window.electronAPI.getAllTags();
      } catch (error) {
        console.error('Error getting tags:', error);
        return [];
      }
    },

    getThumbnail: async (id) => {
      try {
        return await window.electronAPI.getThumbnail(id);
      } catch (error) {
        console.error('Error getting thumbnail:', error);
        return null;
      }
    },

    getFilePath: async (id) => {
      try {
        return await window.electronAPI.getFilePath(id);
      } catch (error) {
        console.error('Error getting file path:', error);
        return null;
      }
    },

    setSearchQuery: (query) => {
      update(state => ({ ...state, searchQuery: query }));
    },

    setSelectedTags: (tags) => {
      update(state => ({ ...state, selectedTags: tags }));
    },

    setSortBy: (sortBy) => {
      update(state => ({ ...state, sortBy }));
    },

    setFileTypeFilter: (fileTypes) => {
      update(state => ({ ...state, selectedFileTypes: fileTypes }));
    },

    setViewMode: (viewMode) => {
      update(state => ({ ...state, viewMode }));
    },

    toggleFolder: (folderPath, forceState = undefined) => {
      update(state => {
        const expandedFolders = { ...state.expandedFolders };
        if (forceState !== undefined) {
          // Force to specific state (for expand/collapse all)
          expandedFolders[folderPath] = forceState;
        } else {
          // Toggle: if undefined (default expanded), set to false (collapse)
          // Otherwise, invert the current value
          const currentState = expandedFolders[folderPath] !== false;
          expandedFolders[folderPath] = !currentState;
        }
        return { ...state, expandedFolders };
      });
    },

    getFilteredAssets: (state) => {
      let filtered = [...state.assets];

      // Filter by search query
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(asset =>
          asset.name.toLowerCase().includes(query) ||
          (asset.description && asset.description.toLowerCase().includes(query))
        );
      }

      // Filter by tags
      if (state.selectedTags.length > 0) {
        filtered = filtered.filter(asset =>
          state.selectedTags.some(tag => asset.tags?.includes(tag))
        );
      }

      // Filter by file type
      if (state.selectedFileTypes && state.selectedFileTypes.length > 0) {
        filtered = filtered.filter(asset => {
          const ext = asset.filePath?.split('.').pop()?.toUpperCase();
          return state.selectedFileTypes.includes(ext);
        });
      }

      // Sort assets
      const sortBy = state.sortBy || 'date-desc';

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'date-desc':
            return new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt);

          case 'date-asc':
            return new Date(a.createdAt || a.updatedAt) - new Date(b.createdAt || b.updatedAt);

          case 'name-asc':
            return a.name.localeCompare(b.name);

          case 'name-desc':
            return b.name.localeCompare(a.name);

          case 'size-desc':
            return (b.fileSize || 0) - (a.fileSize || 0);

          case 'size-asc':
            return (a.fileSize || 0) - (b.fileSize || 0);

          default:
            return 0;
        }
      });

      return filtered;
    },

    getGroupedAssets: (state) => {
      const filtered = store.getFilteredAssets(state);
      const folderMap = {};

      // Build a map of all folder paths and their assets
      filtered.forEach(asset => {
        const pathParts = asset.filePath.split(/[/\\]/);

        // Get all folder parts (exclude the filename)
        const folderParts = pathParts.slice(0, -1);

        if (folderParts.length === 0) {
          // File in root
          if (!folderMap['Root']) {
            folderMap['Root'] = {
              name: 'Root',
              fullPath: 'Root',
              level: 0,
              assets: [],
              children: {}
            };
          }
          folderMap['Root'].assets.push(asset);
        } else {
          // Build the folder hierarchy
          for (let i = 0; i < folderParts.length; i++) {
            const currentPath = folderParts.slice(0, i + 1).join('/');
            const parentPath = i > 0 ? folderParts.slice(0, i).join('/') : null;
            const folderName = folderParts[i];

            if (!folderMap[currentPath]) {
              folderMap[currentPath] = {
                name: folderName,
                fullPath: currentPath,
                level: i,
                assets: [],
                children: {},
                parentPath: parentPath
              };
            }
          }

          // Add asset to its immediate parent folder
          const assetFolderPath = folderParts.join('/');
          folderMap[assetFolderPath].assets.push(asset);
        }
      });

      // Build the tree structure
      const tree = {};
      Object.keys(folderMap).forEach(path => {
        const folder = folderMap[path];
        if (!folder.parentPath) {
          // Root-level folder
          tree[path] = folder;
        } else {
          // Add as child to parent
          const parent = folderMap[folder.parentPath];
          if (parent) {
            parent.children[path] = folder;
          }
        }
      });

      // Flatten the tree into a sorted hierarchical list
      const flattenTree = (node, result = []) => {
        result.push(node);

        // Sort children by name
        const childKeys = Object.keys(node.children).sort((a, b) => {
          return folderMap[a].name.localeCompare(folderMap[b].name);
        });

        // Add children if folder is expanded
        if (state.expandedFolders[node.fullPath] !== false) {
          childKeys.forEach(key => {
            flattenTree(node.children[key], result);
          });
        }

        return result;
      };

      // Sort root folders and flatten
      const rootFolders = Object.keys(tree).sort((a, b) => {
        return folderMap[a].name.localeCompare(folderMap[b].name);
      });

      const result = [];
      rootFolders.forEach(key => {
        flattenTree(tree[key], result);
      });

      return result;
    },

    triggerAssetUpdate: (assetId) => {
      // Force a reactive update by creating new asset objects
      // This will trigger Svelte's reactivity in components using the asset
      update(state => ({
        ...state,
        assets: state.assets.map(a =>
          a.id === assetId
            ? { ...a, _thumbnailUpdated: Date.now() } // Add timestamp to force reactivity
            : a
        )
      }));
    },

    cleanup: () => {
      if (unsubscribeAdded) unsubscribeAdded();
      if (unsubscribeUpdated) unsubscribeUpdated();
      if (unsubscribeRemoved) unsubscribeRemoved();
    }
  };

  return store;
}

export const localAssetStore = createLocalAssetStore();
