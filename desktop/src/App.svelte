<script>
  import { onMount, onDestroy } from 'svelte';
  import { localAssetStore } from './lib/stores/localAssetStore';
  import { folderStore } from './lib/stores/folderStore';
  import Navbar from './lib/components/Navbar.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import AssetGrid from './lib/components/AssetGrid.svelte';
  import AssetViewer from './lib/components/AssetViewer.svelte';
  import FolderManager from './lib/components/FolderManager.svelte';

  let showFolderManager = false;
  let selectedAsset = null;

  onMount(async () => {
    // Initialize local asset store
    await localAssetStore.init();
    // Load watched folders
    await folderStore.loadFolders();
  });

  onDestroy(() => {
    localAssetStore.cleanup();
  });

  function handleManageFolders() {
    showFolderManager = true;
  }

  function handleCloseFolderManager() {
    showFolderManager = false;
  }

  function handleViewAsset(event) {
    selectedAsset = event.detail;
  }

  function handleCloseViewer() {
    selectedAsset = null;
  }
</script>

<main class="min-h-screen">
  <!-- Main Application -->
  <Navbar on:manageFolders={handleManageFolders} />

  <div class="pt-24 pb-12 px-8 max-w-[1920px] mx-auto">
    <!-- Header Section -->
    <div class="mb-12 text-center space-y-6">
      <div class="space-y-2">
        <h1 class="text-5xl md:text-6xl font-bold gradient-text animate-fade-in">
          Your 3D Assets
        </h1>
        <p class="text-xl text-white/70 animate-fade-in" style="animation-delay: 0.1s;">
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
          <p class="text-sm text-white/60">Total Assets</p>
        </div>
        <div class="glass-card px-6 py-3 inline-block">
          <p class="text-3xl font-bold gradient-text">
            {localAssetStore.getFilteredAssets($localAssetStore).length}
          </p>
          <p class="text-sm text-white/60">Filtered</p>
        </div>
        <div class="glass-card px-6 py-3 inline-block">
          <p class="text-3xl font-bold gradient-text">{$folderStore.folders.length}</p>
          <p class="text-sm text-white/60">Watched Folders</p>
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

  {#if selectedAsset}
    <AssetViewer asset={selectedAsset} onClose={handleCloseViewer} />
  {/if}
</main>

<style>
  :global(body) {
    overflow-x: hidden;
  }
</style>
