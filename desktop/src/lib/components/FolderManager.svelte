<script>
  import { folderStore } from '../stores/folderStore';
  import { localAssetStore } from '../stores/localAssetStore';

  export let onClose;

  let adding = false;
  let processing = false;
  let processingStatus = '';
  let confirmModal = {
    show: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
    isDanger: false
  };

  async function handleAddFolder() {
    adding = true;
    processing = true;
    processingStatus = 'Adding folder...';

    const result = await folderStore.addFolder();
    adding = false;

    if (result.success && !result.cancelled) {
      // Refresh assets after adding folder
      processingStatus = 'Scanning for models...';
      await localAssetStore.loadAssets();

      // Reload folder list to update counts
      await folderStore.loadFolders();

      // Wait for thumbnail generation to complete
      processingStatus = 'Generating thumbnails...';

      // Subscribe to thumbnail progress
      const unsubscribe = localAssetStore.subscribe((state) => {
        if (state.thumbnailProgress.isGenerating) {
          processingStatus = `Generating thumbnails... (${state.thumbnailProgress.current}/${state.thumbnailProgress.total})`;
        } else if (state.thumbnailProgress.total > 0) {
          // Thumbnail generation complete
          processing = false;
          processingStatus = '';
          unsubscribe();
        }
      });

      // Fallback timeout (if no thumbnails needed)
      setTimeout(() => {
        if (!$localAssetStore.thumbnailProgress.isGenerating && $localAssetStore.thumbnailProgress.total === 0) {
          processing = false;
          processingStatus = '';
          unsubscribe();
        }
      }, 2000);
    } else {
      processing = false;
      processingStatus = '';
    }
  }

  function showConfirmModal(title, message, onConfirm, isDanger = false) {
    confirmModal = {
      show: true,
      title,
      message,
      confirmText: isDanger ? 'Remove' : 'Confirm',
      cancelText: 'Cancel',
      onConfirm,
      isDanger
    };
  }

  function closeConfirmModal() {
    confirmModal.show = false;
  }

  async function handleConfirm() {
    if (confirmModal.onConfirm) {
      await confirmModal.onConfirm();
    }
    closeConfirmModal();
  }

  async function handleRemoveFolder(id) {
    showConfirmModal(
      'Remove Folder?',
      'This folder will be removed from your library. Your files won\'t be deleted from your computer.',
      async () => {
        const result = await folderStore.removeFolder(id);
        if (result.success) {
          await localAssetStore.loadAssets();
        }
      },
      true
    );
  }

  async function handleToggleFolder(id, enabled) {
    await folderStore.toggleFolder(id, !enabled);
  }

  async function handleRescanFolder(id) {
    const result = await folderStore.rescanFolder(id);
    if (result.success) {
      // Add a small delay to ensure database writes are complete
      // The scan completes but assets might still be committing to DB
      setTimeout(async () => {
        await localAssetStore.loadAssets();
      }, 500);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }

  function handleOverlayClick(e) {
    // Only close if clicking directly on the overlay, not its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-overlay" on:click={handleOverlayClick} role="presentation">
  <div class="modal-content" role="dialog" aria-modal="true">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="text-3xl font-bold gradient-text">Your 3D Folders</h2>
      <button on:click={onClose} class="close-button">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="modal-body">
      <p class="text-white/80 mb-2 text-base">
        Add folders to automatically organize your 3D models. We'll scan for GLB, GLTF, OBJ, FBX, and STL files.
      </p>
      <p class="text-white/50 text-sm mb-6 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        All subfolders are automatically included
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

      <!-- Processing Status -->
      {#if processing && processingStatus}
        <div class="processing-status glass-card p-4 mb-6 flex items-center gap-3">
          <div class="loading-spinner-small"></div>
          <div class="flex-1">
            <p class="text-white/90 font-medium">{processingStatus}</p>
            <p class="text-white/50 text-sm mt-1">
              {#if processingStatus.includes('Scanning')}
                Finding all 3D models in folder and subfolders...
              {:else if processingStatus.includes('thumbnails')}
                This may take a while for large or complex models. Thumbnails will appear as they're ready.
              {/if}
            </p>
          </div>
        </div>
      {/if}

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
                  class="mt-1 p-1 rounded-lg transition-colors {folder.enabled ? 'hover:bg-green-500/10' : 'hover:bg-gray-500/10'}"
                  title={folder.enabled ? 'Click to hide this folder' : 'Click to show this folder'}
                >
                  {#if folder.enabled}
                    <!-- Eye open (visible) -->
                    <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  {:else}
                    <!-- Eye closed (hidden) -->
                    <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  {/if}
                </button>

                <div class="flex-1 min-w-0">
                  <p class="text-base font-medium text-white/95 truncate mb-1" title={folder.path}>
                    {folder.path.split(/[/\\]/).pop() || folder.path}
                  </p>
                  <p class="font-mono text-xs text-white/40 truncate mb-2" title={folder.path}>
                    {folder.path}
                  </p>
                  <div class="flex flex-wrap gap-3 text-xs text-white/60">
                    <span class="flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      {folder.assetCount || 0} models
                    </span>
                    <span class="flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDate(folder.lastScanned)}
                    </span>
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

  <!-- Confirmation Modal -->
  {#if confirmModal.show}
    <div class="confirm-overlay" on:click={closeConfirmModal} role="presentation">
      <div class="confirm-modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <div class="confirm-header">
          <h3 class="text-xl font-bold text-white">{confirmModal.title}</h3>
        </div>
        <div class="confirm-body">
          <p class="text-white/80">{confirmModal.message}</p>
        </div>
        <div class="confirm-actions">
          <button on:click={closeConfirmModal} class="btn-secondary">
            {confirmModal.cancelText}
          </button>
          <button
            on:click={handleConfirm}
            class="btn-primary {confirmModal.isDanger ? 'btn-danger' : ''}"
          >
            {confirmModal.confirmText}
          </button>
        </div>
      </div>
    </div>
  {/if}
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

  .loading-spinner-small {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }

  .processing-status {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    border-color: rgba(99, 102, 241, 0.3);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Confirmation Modal Styles */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease-out;
  }

  .confirm-modal {
    background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(15, 15, 30, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.2s ease-out;
  }

  .confirm-header {
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .confirm-body {
    padding: 1.5rem;
  }

  .confirm-actions {
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn-secondary {
    padding: 0.625rem 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
    transition: all 0.2s;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .btn-danger {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
    border-color: rgba(220, 38, 38, 0.5) !important;
  }

  .btn-danger:hover {
    background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%) !important;
    border-color: rgba(220, 38, 38, 0.7) !important;
    transform: translateY(-1px);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
