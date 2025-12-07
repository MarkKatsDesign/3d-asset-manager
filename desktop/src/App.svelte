<!--
  3D Asset Manager
  Copyright (C) 2025 Mark Kats

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

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
      // Only try to play if video is ready (readyState > 0)
      if (videoElement.readyState > 0) {
        videoElement.play().catch(err => {
          // Silently ignore errors - video might not be loaded yet
        });
      }
    }
  }

  function handleVideoError(event) {
    // Video failed to load - log for debugging
    if (import.meta.env.DEV) {
      console.error('Video load error:', videoElement?.src);
    }
  }

  function handleVideoLoaded() {
    // Video is loaded and ready - ensure it plays
    if (videoElement && background?.videoEnabled !== false) {
      videoElement.play().catch(() => {
        // Ignore autoplay errors
      });
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
    {#if background.type === 'video'}
      {#key background.source}
        <video
          bind:this={videoElement}
          src={background.source}
          autoplay
          loop
          muted
          playsinline
          preload="auto"
          on:error={handleVideoError}
          on:loadeddata={handleVideoLoaded}
          on:canplay={handleVideoLoaded}
          class="w-full h-full object-cover"
          style="opacity: {background.opacity}; filter: blur({background.blur}px);"
        />
      {/key}
    {:else if background.type === 'image'}
      <div
        class="w-full h-full bg-cover bg-center"
        style="background-image: url('{background.source}'); opacity: {background.opacity}; filter: blur({background.blur}px);"
      />
    {/if}
  </div>
{/if}

<main class="min-h-screen relative {theme?.colors.textPrimary} transition-colors duration-500" style="font-family: '{theme?.font}', system-ui, sans-serif;">
  <!-- Background gradient layer that extends full height -->
  {#if background?.type === 'gradient'}
    <div class="fixed inset-0 -z-20 bg-gradient-to-br {theme?.colors.bgPrimary}"></div>
  {/if}

  <!-- Main Application -->
  <Navbar on:manageFolders={handleManageFolders} on:customizeBackground={handleCustomizeBackground} />

  <div class="pt-24 pb-12 px-8 max-w-[1920px] mx-auto">
    <!-- Compact Single-Line Header -->
    <div class="mb-8 animate-fade-in">
      <!-- Main Header Row -->
      <div class="flex items-center justify-between gap-6 mb-6">
        <!-- Left: Title -->
        <div class="flex items-center gap-6 min-w-0">
          <h1 class="text-2xl md:text-3xl font-bold gradient-text whitespace-nowrap">
            Your 3D Assets
          </h1>
          <!-- Inline Stats -->
          <div class="hidden lg:flex items-center gap-4 text-sm {theme?.colors.textMuted}">
            <span class="glass-card px-4 py-2">
              <span class="font-semibold gradient-text">{$localAssetStore.assets.length}</span> total
            </span>
            <span class="glass-card px-4 py-2">
              <span class="font-semibold gradient-text">{localAssetStore.getFilteredAssets($localAssetStore).length}</span> filtered
            </span>
            <span class="glass-card px-4 py-2">
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
