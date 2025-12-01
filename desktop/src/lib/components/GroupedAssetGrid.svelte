<script>
  import AssetCard from './AssetCard.svelte';
  import { localAssetStore } from '../stores/localAssetStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  $: groupedAssets = localAssetStore.getGroupedAssets($localAssetStore);

  function handleView(event) {
    dispatch('view', event.detail);
  }

  function handleDelete(event) {
    if (confirm('Are you sure you want to remove this asset from the library? (The file will not be deleted from your computer)')) {
      localAssetStore.deleteAsset(event.detail.id);
    }
  }

  function toggleFolder(folderPath) {
    localAssetStore.toggleFolder(folderPath);
  }

  function isExpanded(folderPath) {
    return $localAssetStore.expandedFolders[folderPath] !== false;
  }

  function hasChildren(folder) {
    return Object.keys(folder.children || {}).length > 0;
  }

  function getTotalAssets(folder) {
    let total = folder.assets.length;
    Object.values(folder.children || {}).forEach(child => {
      total += getTotalAssets(child);
    });
    return total;
  }
</script>

<div class="w-full space-y-8">
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
  {:else if groupedAssets.length === 0}
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
    <!-- Grouped Asset Grid -->
    {#each groupedAssets as group (group.fullPath)}
      <div class="space-y-4 animate-fade-in" style="margin-left: {group.level * 2}rem">
        <!-- Folder Header -->
        <div
          class="flex items-center gap-3 pb-3 border-b border-white/10 cursor-pointer hover:bg-white/5 rounded-lg p-2 -mx-2 transition-colors"
          on:click={() => toggleFolder(group.fullPath)}
          on:keydown={(e) => e.key === 'Enter' && toggleFolder(group.fullPath)}
          role="button"
          tabindex="0"
        >
          <!-- Expand/Collapse Icon -->
          {#if hasChildren(group) || group.assets.length > 0}
            <div class="w-6 h-6 flex items-center justify-center text-white/60">
              {#if isExpanded(group.fullPath)}
                <!-- Expanded Icon (chevron down) -->
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              {:else}
                <!-- Collapsed Icon (chevron right) -->
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              {/if}
            </div>
          {:else}
            <div class="w-6 h-6"></div>
          {/if}

          <!-- Folder Icon -->
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>

          <!-- Folder Info -->
          <div class="flex-1">
            <h3 class="text-xl font-bold text-white">
              {group.name}
            </h3>
            <p class="text-sm text-white/50">
              {#if hasChildren(group)}
                {getTotalAssets(group)} total {getTotalAssets(group) === 1 ? 'asset' : 'assets'}
                {#if group.assets.length > 0}
                  ({group.assets.length} in this folder)
                {/if}
              {:else}
                {group.assets.length} {group.assets.length === 1 ? 'asset' : 'assets'}
              {/if}
            </p>
          </div>
        </div>

        <!-- Assets Grid (only shown if expanded and has assets) -->
        {#if isExpanded(group.fullPath) && group.assets.length > 0}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {#each group.assets as asset (asset.id)}
              <AssetCard
                {asset}
                on:view={handleView}
                on:delete={handleDelete}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Total Count -->
    <div class="mt-8 text-center text-white/50 text-sm">
      {#if groupedAssets.length === 1}
        1 folder • {getTotalAssets(groupedAssets[0])} {getTotalAssets(groupedAssets[0]) === 1 ? 'asset' : 'assets'}
      {:else}
        {groupedAssets.length} folders • {groupedAssets.reduce((sum, g) => sum + getTotalAssets(g), 0)} total assets
      {/if}
    </div>
  {/if}
</div>
