<script>
  import { onMount, onDestroy } from 'svelte';
  import { localAssetStore } from './lib/stores/localAssetStore';
  import { folderStore } from './lib/stores/folderStore';
  import { themeStore, themes, backgroundStore } from './lib/stores/themeStore';
  import Navbar from './lib/components/Navbar.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import AssetGrid from './lib/components/AssetGrid.svelte';
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

  function handleCloseFolderManager() {
    showFolderManager = false;
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

  <div class="pt-24 pb-12 px-8 max-w-[1920px] mx-auto">
    <!-- Header Section -->
    <div class="mb-12 text-center space-y-6">
      <div class="space-y-2">
        <h1 class="text-5xl md:text-6xl font-bold gradient-text animate-fade-in">
          Your 3D Assets
        </h1>
        <p class="text-xl {theme?.colors.textSecondary} animate-fade-in" style="animation-delay: 0.1s;">
          Preview and organize your local 3D models
        </p>
      </div>

      <!-- Search Bar -->
      <div class="flex justify-center animate-fade-in" style="animation-delay: 0.2s;">
        <SearchBar />
      </div>

      <!-- Stats -->
      <div class="flex justify-center gap-8 text-center animate-fade-in" style="animation-delay: 0.3s;">
        <div class="glass-card px-6 py-3 inline-block">
          <p class="text-3xl font-bold gradient-text">{$localAssetStore.assets.length}</p>
          <p class="text-sm {theme?.colors.textMuted}">Total Assets</p>
        </div>
        <div class="glass-card px-6 py-3 inline-block">
          <p class="text-3xl font-bold gradient-text">
            {localAssetStore.getFilteredAssets($localAssetStore).length}
          </p>
          <p class="text-sm {theme?.colors.textMuted}">Filtered</p>
        </div>
        <div class="glass-card px-6 py-3 inline-block">
          <p class="text-3xl font-bold gradient-text">{$folderStore.folders.length}</p>
          <p class="text-sm {theme?.colors.textMuted}">Watched Folders</p>
        </div>
      </div>
    </div>

    <!-- Asset Grid -->
    <AssetGrid
      on:view={handleViewAsset}
      on:manageFolders={handleManageFolders}
    />
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
