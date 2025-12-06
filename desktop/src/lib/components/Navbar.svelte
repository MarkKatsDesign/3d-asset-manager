<script>
  import { createEventDispatcher } from 'svelte';
  import { folderStore } from '../stores/folderStore';
  import { localAssetStore } from '../stores/localAssetStore';
  import ThemeSwitcher from './ThemeSwitcher.svelte';

  const dispatch = createEventDispatcher();

  let isRegenerating = false;

  function handleManageFoldersClick() {
    dispatch('manageFolders');
  }

  function handleCustomizeBackground() {
    dispatch('customizeBackground');
  }

  async function handleRegenerateThumbnails() {
    if (isRegenerating) return;

    const confirmed = confirm('This will regenerate all thumbnails with improved lighting and framing. You\'ll see thumbnails update in real-time. Continue?');
    if (!confirmed) return;

    isRegenerating = true;

    try {
      const result = await localAssetStore.regenerateAllThumbnails();
      if (result.success) {
        alert(`Thumbnail regeneration complete!\n\n✓ Successful: ${result.successful}\n✗ Failed: ${result.failed}\n\nAll thumbnails have been updated!`);
      } else {
        alert(`Error regenerating thumbnails: ${result.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error regenerating thumbnails: ${error.message}`);
    } finally {
      isRegenerating = false;
    }
  }
</script>

<nav class="navbar-container fixed top-0 left-0 right-0 z-[100]">
  <div class="navbar-glass rounded-b-3xl">
    <div class="max-w-[1920px] mx-auto px-8 py-3">
      <div class="flex items-center justify-between">
        <!-- Logo & Brand -->
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl overflow-hidden shadow-lg">
            <img src="../../resources/icon.png" alt="Forma Logo" class="w-full h-full object-cover" />
          </div>
          <h1 class="text-xl font-bold gradient-text">Forma</h1>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-3">

          <!-- Theme Switcher -->
          <ThemeSwitcher on:customizeBackground={handleCustomizeBackground} />

          <!-- Regenerate Thumbnails Button (Icon Only) -->
          <button
            on:click={handleRegenerateThumbnails}
            disabled={isRegenerating}
            class="glass-button p-2.5 {isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}"
            title="{isRegenerating ? 'Regenerating thumbnails...' : 'Regenerate all thumbnails'}"
          >
            <svg class="w-5 h-5 {isRegenerating ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <!-- Manage Folders Button -->
          <button
            on:click={handleManageFoldersClick}
            class="glass-button flex items-center space-x-2 font-medium"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Manage Folders</span>
          </button>
        </div>
      </div>
    </div>
    <!-- Soft gradient fade at bottom -->
    <div class="navbar-gradient"></div>
  </div>
</nav>

<style>
  .navbar-glass {
    position: relative;
    overflow: visible;
    /* Ultra-transparent background to show gradient */
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    /* Very subtle border */
    border: 1px solid rgba(255, 255, 255, 0.08);
    /* No shadow */
    box-shadow: none;
    /* Prevent any hover effects */
    transition: none;
  }

  .navbar-gradient {
    position: absolute;
    bottom: -20px;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.03), transparent);
    pointer-events: none;
    border-radius: 0 0 24px 24px;
    z-index: -1;
  }

  /* Disable hover effects on navbar */
  .navbar-glass:hover {
    transform: none !important;
    background: rgba(255, 255, 255, 0.03) !important;
    box-shadow: none !important;
  }

  /* Arctic theme - slightly more visible but still transparent */
  :global(body[data-theme="arctic"]) .navbar-glass {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  :global(body[data-theme="arctic"]) .navbar-glass:hover {
    background: rgba(255, 255, 255, 0.12) !important;
  }

  /* Arctic theme gradient */
  :global(body[data-theme="arctic"]) .navbar-gradient {
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.08), transparent);
  }
</style>
