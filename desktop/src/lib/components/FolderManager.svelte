<script>
  import { folderStore } from '../stores/folderStore';
  import { localAssetStore } from '../stores/localAssetStore';

  export let onClose;

  let adding = false;

  async function handleAddFolder() {
    adding = true;
    const result = await folderStore.addFolder();
    adding = false;

    if (result.success && !result.cancelled) {
      // Refresh assets after adding folder
      await localAssetStore.loadAssets();
    }
  }

  async function handleRemoveFolder(id) {
    if (confirm('Remove this folder from being watched? (Assets will be removed from the library)')) {
      const result = await folderStore.removeFolder(id);
      if (result.success) {
        await localAssetStore.loadAssets();
      }
    }
  }

  async function handleToggleFolder(id, enabled) {
    await folderStore.toggleFolder(id, !enabled);
  }

  async function handleRescanFolder(id) {
    const result = await folderStore.rescanFolder(id);
    if (result.success) {
      await localAssetStore.loadAssets();
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }
</script>

<div class="modal-overlay" on:click={onClose}>
  <div class="modal-content" on:click|stopPropagation>
    <!-- Header -->
    <div class="modal-header">
      <h2 class="text-3xl font-bold gradient-text">Manage Watched Folders</h2>
      <button on:click={onClose} class="close-button">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="modal-body">
      <p class="text-white/70 mb-6">
        Add folders containing 3D models to automatically discover and preview them.
        Supported formats: GLB, GLTF
      </p>

      <!-- Add Folder Button -->
      <button
        on:click={handleAddFolder}
        disabled={adding}
        class="btn-primary w-full mb-6"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {adding ? 'Adding...' : 'Add Folder'}
      </button>

      <!-- Folders List -->
      {#if $folderStore.loading}
        <div class="text-center py-8">
          <div class="loading-spinner"></div>
          <p class="text-white/60 mt-4">Loading folders...</p>
        </div>
      {:else if $folderStore.folders.length === 0}
        <div class="empty-state">
          <svg class="w-16 h-16 mx-auto mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p class="text-white/60 text-center">No watched folders yet</p>
          <p class="text-white/40 text-sm text-center mt-2">Add a folder to start discovering 3D models</p>
        </div>
      {:else}
        <div class="space-y-3 max-h-96 overflow-y-auto">
          {#each $folderStore.folders as folder (folder.id)}
            <div class="folder-item glass-card">
              <div class="flex items-start gap-3 flex-1">
                <!-- Enable/Disable Toggle -->
                <button
                  on:click={() => handleToggleFolder(folder.id, folder.enabled)}
                  class="mt-1"
                  title={folder.enabled ? 'Disable watching' : 'Enable watching'}
                >
                  {#if folder.enabled}
                    <svg class="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  {:else}
                    <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  {/if}
                </button>

                <div class="flex-1 min-w-0">
                  <p class="font-mono text-sm text-white/90 truncate" title={folder.path}>
                    {folder.path}
                  </p>
                  <div class="flex gap-4 mt-1 text-xs text-white/50">
                    <span>{folder.assetCount || 0} assets</span>
                    <span>Last scanned: {formatDate(folder.lastScanned)}</span>
                  </div>
                </div>
              </div>

              <div class="flex gap-2">
                <!-- Rescan Button -->
                <button
                  on:click={() => handleRescanFolder(folder.id)}
                  class="btn-icon"
                  title="Rescan folder"
                  disabled={!folder.enabled}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <!-- Remove Button -->
                <button
                  on:click={() => handleRemoveFolder(folder.id)}
                  class="btn-icon text-red-400 hover:text-red-300"
                  title="Remove folder"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }

  .modal-content {
    background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(15, 15, 30, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.5rem;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    padding: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    max-height: calc(90vh - 120px);
  }

  .close-button {
    padding: 0.5rem;
    color: rgba(255, 255, 255, 0.6);
    transition: color 0.2s;
    border-radius: 0.5rem;
  }

  .close-button:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .folder-item {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: transform 0.2s;
  }

  .folder-item:hover {
    transform: translateY(-2px);
  }

  .btn-icon {
    padding: 0.5rem;
    color: rgba(255, 255, 255, 0.6);
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .btn-icon:hover:not(:disabled) {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-icon:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .empty-state {
    padding: 3rem 1rem;
    text-align: center;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #4ade80;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
