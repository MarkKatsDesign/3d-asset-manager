import { writable } from 'svelte/store';
import { generateThumbnail } from '../utils/thumbnailGenerator';

function createLocalAssetStore() {
  const { subscribe, set, update } = writable({
    assets: [],
    loading: false,
    error: null,
    searchQuery: '',
    selectedTags: []
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
      // Generate thumbnails in the background
      for (const asset of assets) {
        try {
          // Check if thumbnail exists
          const existingThumbnail = await window.electronAPI.getThumbnail(asset.id);

          // Skip if thumbnail exists and is not an SVG placeholder
          if (existingThumbnail && !existingThumbnail.includes('svg+xml')) {
            continue;
          }

          console.log(`Generating thumbnail for asset ${asset.id}: ${asset.name}`);

          // Generate thumbnail
          const thumbnailData = await generateThumbnail(asset.id);

          // Save to database
          await window.electronAPI.saveThumbnail(asset.id, thumbnailData);

          console.log(`✓ Thumbnail generated for ${asset.name}`);
        } catch (error) {
          console.error(`Error generating thumbnail for asset ${asset.id}:`, error);
          // Continue with other assets even if one fails
        }
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

    getFilteredAssets: (state) => {
      let filtered = state.assets;

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

      return filtered;
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
