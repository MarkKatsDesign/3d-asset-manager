<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { localAssetStore } from '../stores/localAssetStore';
  import { themeStore, themes } from '../stores/themeStore';
  import { generateThumbnail } from '../utils/thumbnailGenerator';

  export let asset;

  let theme;
  themeStore.subscribe(value => {
    theme = themes[value];
  });

  const dispatch = createEventDispatcher();
  let thumbnailUrl = null;
  let checkCount = 0;
  let isLoadingThumbnail = true; // Track thumbnail loading state
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let regeneratingThumbnail = false;

  // Subscribe to store to track bulk regeneration
  let storeState;
  localAssetStore.subscribe(state => {
    storeState = state;
  });

  // Reactive statement to check if this specific asset is being regenerated
  $: isRegeneratingThisAsset = storeState?.regeneratingAssets?.has(asset.id) || false;

  onMount(async () => {
    // Load thumbnail from local database
    await loadThumbnail();

    // If we already have a placeholder thumbnail (SVG), don't show spinner or keep checking
    // This means the thumbnail already failed to generate or file is too large
    if (thumbnailUrl && thumbnailUrl.includes('svg+xml')) {
      isLoadingThumbnail = false;
      return; // Don't start the interval
    }

    // If we have a real thumbnail already, no need to show spinner
    if (thumbnailUrl && !thumbnailUrl.includes('svg+xml')) {
      isLoadingThumbnail = false;
      return; // Don't start the interval
    }

    // Only check for updated thumbnail if we don't have one yet
    const interval = setInterval(async () => {
      checkCount++;
      await loadThumbnail();

      // Stop checking after 5 attempts or when we get a real thumbnail
      if (checkCount >= 5 || (thumbnailUrl && !thumbnailUrl.includes('svg+xml'))) {
        clearInterval(interval);
        isLoadingThumbnail = false; // Done loading
      } else if (thumbnailUrl && thumbnailUrl.includes('svg+xml')) {
        // Got a placeholder, stop trying
        clearInterval(interval);
        isLoadingThumbnail = false;
      }
    }, 3000); // Check every 3 seconds

    // Cleanup
    return () => clearInterval(interval);
  });

  // Reactive statement: reload thumbnail when asset changes or when regeneration completes
  $: if (asset && asset.id) {
    loadThumbnail();
  }

  // When bulk regeneration starts for this asset, clear the thumbnail to show spinner
  $: if (isRegeneratingThisAsset && !isLoadingThumbnail) {
    isLoadingThumbnail = true;
    thumbnailUrl = null;
  }

  // When bulk regeneration completes for this asset, reload the thumbnail
  $: if (!isRegeneratingThisAsset && asset._thumbnailUpdated) {
    loadThumbnail().then(() => {
      isLoadingThumbnail = false;
    });
  }

  async function loadThumbnail() {
    const thumbnail = await localAssetStore.getThumbnail(asset.id);
    if (thumbnail) {
      thumbnailUrl = thumbnail;
      // If we got a real thumbnail (not placeholder), stop loading state
      if (!thumbnail.includes('svg+xml')) {
        isLoadingThumbnail = false;
      }
    }
  }

  function handleClick() {
    dispatch('view', asset);
  }

  function handleDelete(e) {
    e.stopPropagation();
    dispatch('delete', asset);
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getFileExtension() {
    if (asset.filePath) {
      return asset.filePath.split('.').pop()?.toUpperCase() || 'GLB';
    }
    return 'GLB';
  }

  function getFolderBadge() {
    if (!asset.filePath) return null;

    // Extract folder path from file path
    const pathParts = asset.filePath.split(/[/\\]/);

    // Get the last 1-2 folder names (not the file itself)
    if (pathParts.length > 2) {
      const folders = pathParts.slice(-3, -1); // Get last 2 folders before filename
      const folderName = folders.join('/');

      // Truncate if too long
      if (folderName.length > 20) {
        return folderName.substring(0, 18) + '...';
      }
      return folderName;
    }

    return null;
  }

  function getBreadcrumbPath() {
    if (!asset.filePath) return [];

    // Extract folder path from file path
    const pathParts = asset.filePath.split(/[/\\]/);

    // Remove the filename (last part) and any empty parts
    const folders = pathParts.slice(0, -1).filter(part => part.length > 0);

    // Return last 4 folders max to avoid overflow
    if (folders.length > 4) {
      return ['...', ...folders.slice(-4)];
    }

    return folders;
  }

  $: folderBadge = getFolderBadge();
  $: breadcrumb = getBreadcrumbPath();

  function handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    showContextMenu = true;

    // Close menu when clicking anywhere else
    const closeMenu = () => {
      showContextMenu = false;
      window.removeEventListener('click', closeMenu);
    };
    setTimeout(() => window.addEventListener('click', closeMenu), 0);
  }

  async function handleRegenerateThumbnail(e) {
    e.stopPropagation();
    showContextMenu = false;

    try {
      regeneratingThumbnail = true;
      isLoadingThumbnail = true; // Show loading spinner
      console.log('Regenerating thumbnail for asset:', asset.id);

      // Generate new thumbnail
      const thumbnailData = await generateThumbnail(asset.id, asset.path || asset.filePath);

      if (thumbnailData) {
        // Save the generated thumbnail
        await window.electronAPI.saveThumbnail(asset.id, thumbnailData);

        // Reload the thumbnail to show the new one
        await loadThumbnail();

        // Trigger asset update to refresh thumbnail in other views
        localAssetStore.triggerAssetUpdate(asset.id);

        console.log('Thumbnail regenerated successfully');
        isLoadingThumbnail = false; // Stop loading spinner on success
      } else {
        isLoadingThumbnail = false; // Stop loading spinner on failure
        alert('Failed to regenerate thumbnail. The model might be too large or complex.');
      }
    } catch (error) {
      console.error('Error regenerating thumbnail:', error);
      isLoadingThumbnail = false; // Stop loading spinner on error
      alert('Failed to regenerate thumbnail. Please try again.');
    } finally {
      regeneratingThumbnail = false;
    }
  }
</script>

<div
  class="glass-card cursor-pointer group overflow-hidden animate-fade-in"
  on:click={handleClick}
  on:contextmenu={handleContextMenu}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
>
  <!-- Thumbnail -->
  <div class="relative aspect-video overflow-hidden bg-gradient-to-br from-gray-800/50 to-gray-900/50">
    {#if thumbnailUrl && !isLoadingThumbnail && !isRegeneratingThisAsset}
      <img
        src={thumbnailUrl}
        alt={asset.name}
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
    {:else}
      <!-- Loading Spinner -->
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-4">
        {#if isLoadingThumbnail || isRegeneratingThisAsset}
          <!-- Animated spinner -->
          <div class="relative w-16 h-16">
            <!-- Outer ring -->
            <div class="absolute inset-0 rounded-full border-4 border-white/10"></div>
            <!-- Spinning gradient ring -->
            <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin"></div>
            <!-- Inner pulsing dot -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-3 h-3 bg-indigo-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p class="text-white/60 text-sm font-medium">Generating thumbnail...</p>
        {:else}
          <!-- Placeholder 3D Icon (if loading finished but no thumbnail) -->
          <svg class="w-20 h-20 text-white/30 group-hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        {/if}
      </div>
    {/if}

    <!-- Overlay on hover -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-between">
      <!-- View Icon (Center) -->
      <div class="flex-1 flex items-center justify-center">
        <div class="glass-button p-3 rounded-full">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
      </div>

      <!-- Breadcrumb Path (Bottom) -->
      {#if breadcrumb.length > 0}
        <div class="w-full px-3 pb-3">
          <div class="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/20">
            <div class="flex items-center gap-1.5 flex-wrap text-xs">
              {#each breadcrumb as folder, index}
                <span class="text-white/90 font-medium">{folder}</span>
                {#if index < breadcrumb.length - 1}
                  <svg class="w-3 h-3 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- File format badge (top-left) -->
    <div class="absolute top-3 left-3">
      <div class="bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
        {getFileExtension()}
      </div>
    </div>

    <!-- Folder badge (top-right, theme-aware with glassmorphism) -->
    {#if folderBadge}
      <div class="absolute top-3 right-3">
        <div class="folder-badge {theme?.colors.accentPrimary} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1" style="color: white !important;">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {folderBadge}
        </div>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="p-4 space-y-3">
    <!-- Title -->
    <h3 class="font-bold text-lg truncate group-hover:text-indigo-300 transition-colors">
      {asset.name}
    </h3>

    <!-- Tags -->
    {#if asset.tags && asset.tags.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each asset.tags.slice(0, 3) as tag}
          <span class="px-2 py-1 bg-white/10 rounded-lg text-xs font-medium">
            {tag}
          </span>
        {/each}
        {#if asset.tags.length > 3}
          <span class="px-2 py-1 bg-white/10 rounded-lg text-xs font-medium">
            +{asset.tags.length - 3}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Footer -->
    <div class="flex items-center justify-between pt-2 border-t border-white/10">
      <div class="flex items-center space-x-2 flex-1 min-w-0">
        <svg class="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span class="text-xs text-white/60 truncate">{formatFileSize(asset.fileSize)}</span>
        {#if asset.createdAt}
          <span class="text-xs text-white/40">•</span>
          <span class="text-xs text-white/60">{formatDate(asset.createdAt)}</span>
        {/if}
      </div>

      <!-- Delete Button -->
      <button
        on:click={handleDelete}
        class="p-2 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all flex-shrink-0"
        title="Remove asset"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
</div>

<!-- Context Menu -->
{#if showContextMenu}
  <div
    class="fixed z-[9999] min-w-[200px] py-2 glass-card shadow-2xl"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
  >
    <button
      on:click={handleRegenerateThumbnail}
      disabled={regeneratingThumbnail}
      class="w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-3 {regeneratingThumbnail ? 'opacity-50 cursor-not-allowed' : ''}"
    >
      {#if regeneratingThumbnail}
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Regenerating...</span>
      {:else}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Regenerate Thumbnail</span>
      {/if}
    </button>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Glassmorphism effect for folder badge */
  .folder-badge {
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    background-color: rgba(var(--badge-color), 0.3) !important;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow:
      0 8px 32px 0 rgba(0, 0, 0, 0.2),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
    color: #ffffff !important;
  }

  /* Theme-specific colors for glassmorphism */
  .folder-badge.bg-indigo-600 {
    background-color: rgba(79, 70, 229, 0.3) !important;
    color: #ffffff !important;
  }

  .folder-badge.bg-purple-600 {
    background-color: rgba(147, 51, 234, 0.3) !important;
    color: #ffffff !important;
  }

  .folder-badge.bg-violet-500 {
    background-color: rgba(139, 92, 246, 0.3) !important;
    color: #ffffff !important;
  }

  /* Ensure SVG icon in folder badge is also white */
  .folder-badge svg {
    color: #ffffff !important;
    stroke: #ffffff !important;
  }

  /* Ensure all text content inside folder badge is white */
  .folder-badge * {
    color: #ffffff !important;
  }
</style>
