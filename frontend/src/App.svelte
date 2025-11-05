<script>
  import { onMount } from 'svelte';
  import { authStore } from './lib/stores/authStore';
  import { assetStore } from './lib/stores/assetStore';
  import Auth from './lib/components/Auth.svelte';
  import Navbar from './lib/components/Navbar.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import AssetGrid from './lib/components/AssetGrid.svelte';
  import AssetViewer from './lib/components/AssetViewer.svelte';
  import UploadModal from './lib/components/UploadModal.svelte';

  let showUploadModal = false;
  let selectedAsset = null;

  onMount(() => {
    // Load assets if authenticated
    if ($authStore.isAuthenticated) {
      assetStore.loadAssets();
    }
  });

  // Reactive: Load assets when user logs in
  $: if ($authStore.isAuthenticated) {
    assetStore.loadAssets();
  }

  function handleUpload() {
    showUploadModal = true;
  }

  function handleCloseUpload() {
    showUploadModal = false;
  }

  function handleViewAsset(event) {
    selectedAsset = event.detail;
  }

  function handleCloseViewer() {
    selectedAsset = null;
  }
</script>

<main class="min-h-screen">
  {#if !$authStore.isAuthenticated}
    <!-- Authentication Screen -->
    <Auth />
  {:else}
    <!-- Main Application -->
    <Navbar on:upload={handleUpload} />

    <div class="pt-24 pb-12 px-8 max-w-[1920px] mx-auto">
      <!-- Header Section -->
      <div class="mb-12 text-center space-y-6">
        <div class="space-y-2">
          <h1 class="text-5xl md:text-6xl font-bold gradient-text animate-fade-in">
            Your 3D Assets
          </h1>
          <p class="text-xl text-white/70 animate-fade-in" style="animation-delay: 0.1s;">
            Manage, preview, and organize your 3D models in one beautiful place
          </p>
        </div>

        <!-- Search Bar -->
        <div class="flex justify-center animate-fade-in" style="animation-delay: 0.2s;">
          <SearchBar />
        </div>

        <!-- Stats -->
        <div class="flex justify-center gap-8 text-center animate-fade-in" style="animation-delay: 0.3s;">
          <div class="glass-card px-6 py-3 inline-block">
            <p class="text-3xl font-bold gradient-text">{$assetStore.assets.length}</p>
            <p class="text-sm text-white/60">Total Assets</p>
          </div>
          <div class="glass-card px-6 py-3 inline-block">
            <p class="text-3xl font-bold gradient-text">
              {assetStore.getFilteredAssets($assetStore).length}
            </p>
            <p class="text-sm text-white/60">Filtered</p>
          </div>
        </div>
      </div>

      <!-- Asset Grid -->
      <AssetGrid
        on:view={handleViewAsset}
        on:upload={handleUpload}
      />
    </div>
  {/if}

  <!-- Modals -->
  {#if showUploadModal}
    <UploadModal onClose={handleCloseUpload} />
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
