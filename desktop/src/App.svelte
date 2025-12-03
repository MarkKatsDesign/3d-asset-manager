<script>
  import { onMount, onDestroy } from 'svelte';
  import { localAssetStore } from './lib/stores/localAssetStore';
  import { folderStore } from './lib/stores/folderStore';
  import { themeStore, themes, backgroundStore } from './lib/stores/themeStore';
  import Navbar from './lib/components/Navbar.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import FilterToolbar from './lib/components/FilterToolbar.svelte';
  import AssetGrid from './lib/components/AssetGrid.svelte';
  import GroupedAssetGrid from './lib/components/GroupedAssetGrid.svelte';
  import AssetViewer from './lib/components/AssetViewer.svelte';
  import FolderManager from './lib/components/FolderManager.svelte';
  import BackgroundCustomizer from './lib/components/BackgroundCustomizer.svelte';

  let showFolderManager = false;
  let showBackgroundCustomizer = false;
  let selectedAsset = null;
  let theme;
  let background;
  let videoElement;

  themeStore.subscribe(value => {
    theme = themes[value];
    // Update body data-theme attribute
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-theme', value);
    }
  });

  backgroundStore.subscribe(value => {
    background = value;
  });

  onMount(async () => {
    // Initialize local asset store
    await localAssetStore.init();
    // Load watched folders
    await folderStore.loadFolders();

    // Handle window focus/blur for video pause
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
  });

  onDestroy(() => {
    localAssetStore.cleanup();
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
  });

  function handleWindowBlur() {
    if (background?.type === 'video' && background?.pauseWhenInactive && videoElement) {
      videoElement.pause();
    }
  }

  function handleWindowFocus() {
    if (background?.type === 'video' && background?.videoEnabled && videoElement) {
      videoElement.play();
    }
  }

  function handleManageFolders() {
    showFolderManager = true;
  }

  async function handleCloseFolderManager() {
    showFolderManager = false;
    // Reload assets after closing folder manager (in case folders were rescanned)
    await localAssetStore.loadAssets();
  }

  function handleCustomizeBackground() {
    showBackgroundCustomizer = true;
  }

  function handleCloseBackgroundCustomizer() {
    showBackgroundCustomizer = false;
  }

  function handleViewAsset(event) {
    selectedAsset = event.detail;
  }

  function handleCloseViewer() {
    selectedAsset = null;
  }
</script>

<!-- Custom Background Layer -->
{#if background?.type !== 'gradient' && background?.source}
  <div class="fixed inset-0 -z-10">
    {#if background.type === 'video' && background.videoEnabled}
      <video
        bind:this={videoElement}
        src={background.source}
        autoplay
        loop
        muted
        class="w-full h-full object-cover"
        style="opacity: {background.opacity}; filter: blur({background.blur}px);"
      />
    {:else if background.type === 'image'}
      <div
        class="w-full h-full bg-cover bg-center"
        style="background-image: url('{background.source}'); opacity: {background.opacity}; filter: blur({background.blur}px);"
      />
    {/if}
  </div>
{/if}

<main class="min-h-screen {background?.type === 'gradient' ? `bg-gradient-to-br ${theme?.colors.bgPrimary}` : ''} {theme?.colors.textPrimary} transition-colors duration-500" style="font-family: '{theme?.font}', system-ui, sans-serif;">
  <!-- Main Application -->
  <Navbar on:manageFolders={handleManageFolders} on:customizeBackground={handleCustomizeBackground} />

  <div class="pt-20 pb-8 px-8 max-w-[1920px] mx-auto">
    <!-- Compact Single-Line Header -->
    <div class="mb-6 animate-fade-in">
      <!-- Main Header Row -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <!-- Left: Title -->
        <div class="flex items-center gap-4 min-w-0">
          <h1 class="text-2xl md:text-3xl font-bold gradient-text whitespace-nowrap">
            Your 3D Assets
          </h1>
          <!-- Inline Stats -->
          <div class="hidden lg:flex items-center gap-3 text-sm {theme?.colors.textMuted}">
            <span class="glass-card px-3 py-1">
              <span class="font-semibold gradient-text">{$localAssetStore.assets.length}</span> total
            </span>
            <span class="glass-card px-3 py-1">
              <span class="font-semibold gradient-text">{localAssetStore.getFilteredAssets($localAssetStore).length}</span> filtered
            </span>
            <span class="glass-card px-3 py-1">
              <span class="font-semibold gradient-text">{$folderStore.folders.length}</span> folders
            </span>
          </div>
        </div>

        <!-- Right: Search Bar -->
        <div class="flex-1 max-w-md">
          <SearchBar />
        </div>
      </div>

      <!-- Filter Toolbar Row -->
      <FilterToolbar />
    </div>

    <!-- Asset Grid or Grouped View -->
    {#if $localAssetStore.viewMode === 'grouped'}
      <GroupedAssetGrid
        on:view={handleViewAsset}
        on:manageFolders={handleManageFolders}
      />
    {:else}
      <AssetGrid
        on:view={handleViewAsset}
        on:manageFolders={handleManageFolders}
      />
    {/if}
  </div>

  <!-- Modals -->
  {#if showFolderManager}
    <FolderManager onClose={handleCloseFolderManager} />
  {/if}

  {#if showBackgroundCustomizer}
    <BackgroundCustomizer onClose={handleCloseBackgroundCustomizer} />
  {/if}

  {#if selectedAsset}
    <AssetViewer asset={selectedAsset} onClose={handleCloseViewer} />
  {/if}
</main>

<style>
  :global(body) {
    overflow-x: hidden;
  }
</style>
