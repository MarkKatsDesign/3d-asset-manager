<script>
  import AssetCard from './AssetCard.svelte';
  import { localAssetStore } from '../stores/localAssetStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  $: filteredAssets = localAssetStore.getFilteredAssets($localAssetStore);

  function handleView(event) {
    dispatch('view', event.detail);
  }

  function handleDelete(event) {
    if (confirm('Are you sure you want to remove this asset from the library? (The file will not be deleted from your computer)')) {
      localAssetStore.deleteAsset(event.detail.id);
    }
  }
</script>

<div class="w-full">
  {#if $localAssetStore.loading}
    <!-- Loading State -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {#each Array(10) as _, i}
        <div class="glass-card overflow-hidden animate-pulse" style="animation-delay: {i * 0.1}s">
          <div class="aspect-video bg-white/5 shimmer"></div>
          <div class="p-4 space-y-3">
            <div class="h-6 bg-white/5 rounded shimmer"></div>
            <div class="h-4 bg-white/5 rounded w-3/4 shimmer"></div>
            <div class="flex gap-2">
              <div class="h-6 bg-white/5 rounded w-16 shimmer"></div>
              <div class="h-6 bg-white/5 rounded w-16 shimmer"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if filteredAssets.length === 0}
    <!-- Empty State -->
    <div class="flex flex-col items-center justify-center py-20">
      <div class="glass-card p-12 text-center max-w-md">
        <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
          <svg class="w-12 h-12 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold mb-2 gradient-text">No Assets Found</h3>
        <p class="text-white/60 mb-6">
          {#if $localAssetStore.searchQuery || $localAssetStore.selectedTags.length > 0}
            Try adjusting your search or filters
          {:else}
            Add folders containing 3D models to get started
          {/if}
        </p>
        {#if !$localAssetStore.searchQuery && $localAssetStore.selectedTags.length === 0}
          <button
            on:click={() => dispatch('manageFolders')}
            class="glass-button font-medium"
          >
            Add Your First Folder
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Asset Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {#each filteredAssets as asset (asset.id)}
        <AssetCard
          {asset}
          on:view={handleView}
          on:delete={handleDelete}
        />
      {/each}
    </div>

    <!-- Results count -->
    <div class="mt-8 text-center text-white/50 text-sm">
      Showing {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'}
    </div>
  {/if}
</div>
