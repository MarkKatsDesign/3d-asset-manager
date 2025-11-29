<script>
  import { localAssetStore } from '../stores/localAssetStore';
  import { themeStore, themes } from '../stores/themeStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // File types
  const fileTypes = ['GLB', 'FBX', 'OBJ', 'STL', 'GLTF'];

  // Get current theme
  let theme;
  themeStore.subscribe(value => {
    theme = themes[value];
  });

  // Get file type counts
  $: fileTypeCounts = getFileTypeCounts($localAssetStore.assets);

  // Get current filter state
  $: sortBy = $localAssetStore.sortBy || 'date-desc';
  $: selectedFileTypes = $localAssetStore.selectedFileTypes || [];
  $: viewMode = $localAssetStore.viewMode || 'grid';

  function getFileTypeCounts(assets) {
    const counts = {};
    fileTypes.forEach(type => {
      counts[type] = assets.filter(asset => {
        const ext = asset.filePath?.split('.').pop()?.toUpperCase();
        return ext === type;
      }).length;
    });
    return counts;
  }

  function handleSortChange(event) {
    localAssetStore.setSortBy(event.target.value);
  }

  function toggleFileType(type) {
    const current = $localAssetStore.selectedFileTypes || [];
    let updated;

    if (current.includes(type)) {
      // Remove the type
      updated = current.filter(t => t !== type);
    } else {
      // Add the type
      updated = [...current, type];
    }

    localAssetStore.setFileTypeFilter(updated);
  }

  function clearAllFilters() {
    localAssetStore.setFileTypeFilter([]);
    localAssetStore.setSearchQuery('');
    localAssetStore.setSelectedTags([]);
  }

  function setViewMode(mode) {
    localAssetStore.setViewMode(mode);
  }

  $: hasActiveFilters = ($localAssetStore.selectedFileTypes?.length > 0) ||
                        ($localAssetStore.searchQuery?.length > 0) ||
                        ($localAssetStore.selectedTags?.length > 0);

  $: filteredCount = localAssetStore.getFilteredAssets($localAssetStore).length;
  $: totalCount = $localAssetStore.assets.length;
</script>

<div class="glass-card px-6 py-4 mb-6 animate-fade-in" style="animation-delay: 0.4s;">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <!-- Left: Sort & Stats -->
    <div class="flex items-center gap-6">
      <!-- Sort Dropdown -->
      <div class="flex items-center gap-3">
        <label class="text-sm text-white/60 font-medium">Sort:</label>
        <select
          value={sortBy}
          on:change={handleSortChange}
          class="glass-button px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-white/20 transition-colors"
        >
          <option value="date-desc">📅 Date Added (newest)</option>
          <option value="date-asc">📅 Date Added (oldest)</option>
          <option value="name-asc">🔤 Name (A-Z)</option>
          <option value="name-desc">🔤 Name (Z-A)</option>
          <option value="size-desc">📦 Size (largest)</option>
          <option value="size-asc">📦 Size (smallest)</option>
        </select>
      </div>

      <!-- Results Counter -->
      <div class="text-sm text-white/60">
        {#if hasActiveFilters}
          Showing <span class="text-white font-semibold">{filteredCount}</span> of <span class="text-white/80">{totalCount}</span> assets
        {:else}
          <span class="text-white font-semibold">{totalCount}</span> total assets
        {/if}
      </div>
    </div>

    <!-- Right: View Toggle & File Type Filters -->
    <div class="flex items-center gap-6">
      <!-- View Mode Toggle -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-white/60 font-medium">View:</span>
        <div class="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            on:click={() => setViewMode('grid')}
            class="px-3 py-1.5 rounded text-xs font-semibold transition-all {viewMode === 'grid' ? `${theme?.colors.accentPrimary} text-white shadow-lg` : 'text-white/70 hover:text-white'}"
            title="Grid view"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            on:click={() => setViewMode('grouped')}
            class="px-3 py-1.5 rounded text-xs font-semibold transition-all {viewMode === 'grouped' ? `${theme?.colors.accentPrimary} text-white shadow-lg` : 'text-white/70 hover:text-white'}"
            title="Grouped by folder"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- File Type Filters -->
      <div class="flex items-center gap-3">
        <span class="text-sm text-white/60 font-medium">File Type:</span>
        <div class="flex gap-2">
          {#each fileTypes as type}
            {@const isSelected = selectedFileTypes.includes(type)}
            {@const count = fileTypeCounts[type]}
            {#if count > 0}
              <button
                on:click={() => toggleFileType(type)}
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all {isSelected ? `${theme?.colors.accentPrimary} text-white shadow-lg` : 'bg-white/10 text-white/70 hover:bg-white/20'}"
                title="{type} files ({count})"
              >
                {type}
                <span class="ml-1 opacity-70">({count})</span>
              </button>
            {/if}
          {/each}
        </div>

        <!-- Clear Filters Button -->
        {#if hasActiveFilters}
          <button
            on:click={clearAllFilters}
            class="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            title="Clear all filters"
          >
            Clear All
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Active Filters Indicator -->
  {#if hasActiveFilters}
    <div class="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 flex-wrap">
      <span class="text-xs text-white/50">Active filters:</span>

      {#if $localAssetStore.searchQuery}
        <span class="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-medium">
          Search: "{$localAssetStore.searchQuery}"
        </span>
      {/if}

      {#each selectedFileTypes as type}
        <span class="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs font-medium flex items-center gap-1">
          {type}
          <button on:click={() => toggleFileType(type)} class="hover:text-white">×</button>
        </span>
      {/each}

      {#each $localAssetStore.selectedTags as tag}
        <span class="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
          Tag: {tag}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  select {
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
  }

  select option {
    background-color: #1a1a2e;
    color: white;
  }
</style>
