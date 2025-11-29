<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { localAssetStore } from '../stores/localAssetStore';
  import { themeStore, themes } from '../stores/themeStore';

  export let asset;

  let theme;
  themeStore.subscribe(value => {
    theme = themes[value];
  });

  const dispatch = createEventDispatcher();
  let thumbnailUrl = null;
  let checkCount = 0;

  onMount(async () => {
    // Load thumbnail from local database
    await loadThumbnail();

    // Check for updated thumbnail a few times (in case it's being generated)
    const interval = setInterval(async () => {
      checkCount++;
      const hadPlaceholder = thumbnailUrl && thumbnailUrl.includes('svg+xml');
      await loadThumbnail();

      // Stop checking after 5 attempts or when we get a real thumbnail
      if (checkCount >= 5 || (thumbnailUrl && !thumbnailUrl.includes('svg+xml'))) {
        clearInterval(interval);
      }
    }, 3000); // Check every 3 seconds

    // Cleanup
    return () => clearInterval(interval);
  });

  async function loadThumbnail() {
    const thumbnail = await localAssetStore.getThumbnail(asset.id);
    if (thumbnail) {
      thumbnailUrl = thumbnail;
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

  $: folderBadge = getFolderBadge();
</script>

<div
  class="glass-card cursor-pointer group overflow-hidden animate-fade-in"
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
>
  <!-- Thumbnail -->
  <div class="relative aspect-video overflow-hidden">
    {#if thumbnailUrl}
      <img
        src={thumbnailUrl}
        alt={asset.name}
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
    {:else}
      <!-- Placeholder 3D Icon -->
      <div class="absolute inset-0 flex items-center justify-center">
        <svg class="w-20 h-20 text-white/30 group-hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
    {/if}

    <!-- Overlay on hover -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
      <div class="flex space-x-3">
        <div class="glass-button p-3 rounded-full">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
      </div>
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
        <div class="folder-badge {theme?.colors.accentPrimary} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 text-white">
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
  }

  /* Theme-specific colors for glassmorphism */
  .folder-badge.bg-indigo-600 {
    background-color: rgba(79, 70, 229, 0.3) !important;
  }

  .folder-badge.bg-purple-600 {
    background-color: rgba(147, 51, 234, 0.3) !important;
  }

  .folder-badge.bg-violet-500 {
    background-color: rgba(139, 92, 246, 0.3) !important;
  }
</style>
