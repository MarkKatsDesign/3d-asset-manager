import { writable } from 'svelte/store';
import { pb } from '../pocketbase';

function createAssetStore() {
  const { subscribe, set, update } = writable({
    assets: [],
    loading: false,
    error: null,
    searchQuery: '',
    selectedTags: []
  });

  return {
    subscribe,

    loadAssets: async () => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const records = await pb.collection('assets').getFullList({
          sort: '-created',
          expand: 'user'
        });
        update(state => ({ ...state, assets: records, loading: false }));
      } catch (error) {
        console.error('Error loading assets:', error);
        update(state => ({ ...state, loading: false, error: error.message }));
      }
    },

    uploadAsset: async (file, metadata) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', metadata.name);
        formData.append('description', metadata.description || '');
        formData.append('tags', JSON.stringify(metadata.tags || []));
        formData.append('user', pb.authStore.model.id);

        // Add thumbnail if it was generated
        if (metadata.thumbnail) {
          formData.append('thumbnail', metadata.thumbnail, 'thumbnail.jpg');
        }

        const record = await pb.collection('assets').create(formData);

        update(state => ({
          ...state,
          assets: [record, ...state.assets]
        }));

        return { success: true, record };
      } catch (error) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
      }
    },

    deleteAsset: async (id) => {
      try {
        await pb.collection('assets').delete(id);
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
    }
  };
}

export const assetStore = createAssetStore();
