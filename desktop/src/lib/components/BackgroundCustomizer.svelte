<script>
  import { backgroundStore } from '../stores/themeStore';

  export let onClose;

  let currentSettings = { ...$backgroundStore };
  let selectedFile = null;
  let previewMode = false;

  // Extract filename from path and decode URL encoding
  function getDisplayFilename(filePath) {
    if (!filePath) return '';
    try {
      // Decode URI component to convert %3A to : and %5C to \
      const decoded = decodeURIComponent(filePath);
      // Remove the protocol prefix
      const withoutProtocol = decoded.replace('local-file://', '');
      // Extract just the filename (everything after the last slash or backslash)
      const filename = withoutProtocol.split(/[/\\]/).pop();
      return filename || withoutProtocol;
    } catch (error) {
      return filePath;
    }
  }

  // Handle file selection via Electron dialog
  async function handleFileSelect() {
    try {
      const result = await window.electronAPI.selectBackgroundFile();
      if (result.success && !result.cancelled) {
        selectedFile = result.filePath;

        // Determine if it's an image or video
        const ext = result.filePath.toLowerCase().split('.').pop();
        const isVideo = ['mp4', 'webm', 'mov'].includes(ext);

        currentSettings = {
          ...currentSettings,
          type: isVideo ? 'video' : 'image',
          source: result.filePath
        };
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  }

  function selectGradient() {
    currentSettings = {
      ...currentSettings,
      type: 'gradient',
      source: null
    };
    selectedFile = null;
  }

  function handleOpacityChange(e) {
    currentSettings = {
      ...currentSettings,
      opacity: parseFloat(e.target.value)
    };
  }

  function handleBlurChange(e) {
    currentSettings = {
      ...currentSettings,
      blur: parseInt(e.target.value)
    };
  }

  function handleApply() {
    previewMode = true;
    backgroundStore.setBackground(currentSettings);
  }

  function handleSave() {
    backgroundStore.setBackground(currentSettings);
    onClose();
  }

  function handleCancel() {
    if (previewMode) {
      // Revert to original settings
      backgroundStore.setBackground($backgroundStore);
    }
    onClose();
  }

  function handleReset() {
    backgroundStore.reset();
    currentSettings = { ...$backgroundStore };
    selectedFile = null;
    previewMode = false;
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-overlay" on:click={handleOverlayClick} role="presentation">
  <div class="modal-content" role="dialog" aria-modal="true">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="text-3xl font-bold gradient-text">Background Settings</h2>
      <button on:click={handleCancel} class="close-button">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="modal-body">
      <p class="text-white/70 mb-6">
        Customize your background with images or videos. Changes preview in real-time.
      </p>

      <!-- Background Type Selection -->
      <div class="space-y-4">
        <!-- Default Gradient Option -->
        <button
          on:click={selectGradient}
          class="option-card {currentSettings.type === 'gradient' ? 'active' : ''}"
        >
          <div class="flex items-center gap-3">
            <div class="radio-button">
              {#if currentSettings.type === 'gradient'}
                <div class="radio-dot"></div>
              {/if}
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-white">Default Gradient</h3>
              <p class="text-sm text-white/60">Use the theme's default gradient background</p>
            </div>
          </div>
        </button>

        <!-- Custom Background Option -->
        <div class="option-card {currentSettings.type !== 'gradient' ? 'active' : ''}">
          <div class="flex items-start gap-3">
            <div class="radio-button mt-1">
              {#if currentSettings.type !== 'gradient'}
                <div class="radio-dot"></div>
              {/if}
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-white">Custom Background</h3>
              <p class="text-sm text-white/60 mb-3">Upload your own image or video</p>

              <button
                on:click={handleFileSelect}
                class="btn-secondary w-full text-sm"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Choose File...
              </button>

              {#if selectedFile || currentSettings.source}
                <div class="mt-2 p-2 bg-white/5 rounded-lg" title={selectedFile || currentSettings.source}>
                  <p class="text-xs text-white/80 truncate font-mono">
                    📄 {getDisplayFilename(selectedFile || currentSettings.source)}
                  </p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      {#if currentSettings.type !== 'gradient'}
        <div class="advanced-section mt-6">
          <h3 class="text-lg font-semibold text-white mb-4">Advanced Settings</h3>

          <!-- Opacity Slider -->
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <label for="opacity-slider" class="text-sm text-white/80">Opacity</label>
              <span class="text-sm text-white/60">{Math.round(currentSettings.opacity * 100)}%</span>
            </div>
            <input
              id="opacity-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentSettings.opacity}
              on:input={handleOpacityChange}
              class="slider"
            />
          </div>

          <!-- Blur Slider -->
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <label for="blur-slider" class="text-sm text-white/80">Blur</label>
              <span class="text-sm text-white/60">{currentSettings.blur}px</span>
            </div>
            <input
              id="blur-slider"
              type="range"
              min="0"
              max="50"
              step="1"
              value={currentSettings.blur}
              on:input={handleBlurChange}
              class="slider"
            />
          </div>

          <!-- Video Options -->
          {#if currentSettings.type === 'video'}
            <div class="space-y-2">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={currentSettings.videoEnabled}
                  class="checkbox"
                />
                <span class="text-sm text-white/80">Enable video playback</span>
              </label>

              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={currentSettings.pauseWhenInactive}
                  class="checkbox"
                />
                <span class="text-sm text-white/80">Pause when window is inactive</span>
              </label>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="flex gap-3 mt-6">
        <button on:click={handleReset} class="btn-secondary flex-1">
          Reset to Default
        </button>
        <button on:click={handleApply} class="btn-secondary flex-1">
          Apply Preview
        </button>
        <button on:click={handleSave} class="btn-primary flex-1">
          Save Changes
        </button>
      </div>
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
    max-width: 600px;
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

  .option-card {
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    transition: all 0.2s;
    cursor: pointer;
    width: 100%;
    text-align: left;
  }

  .option-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .option-card.active {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.5);
  }

  .radio-button {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .radio-dot {
    width: 10px;
    height: 10px;
    background: #6366f1;
    border-radius: 50%;
  }

  .advanced-section {
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
  }

  .slider {
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    -webkit-appearance: none;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    transition: all 0.2s;
  }

  .slider::-webkit-slider-thumb:hover {
    background: #818cf8;
    transform: scale(1.1);
  }

  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .slider::-moz-range-thumb:hover {
    background: #818cf8;
    transform: scale(1.1);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #6366f1;
  }

  /* Arctic Theme (Light) Overrides */
  :global(body[data-theme="arctic"]) .modal-overlay {
    background: rgba(0, 0, 0, 0.3);
  }

  :global(body[data-theme="arctic"]) .modal-content {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  :global(body[data-theme="arctic"]) .modal-header {
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  :global(body[data-theme="arctic"]) .close-button {
    color: rgba(0, 0, 0, 0.6);
  }

  :global(body[data-theme="arctic"]) .close-button:hover {
    color: rgba(0, 0, 0, 0.9);
    background: rgba(0, 0, 0, 0.05);
  }

  :global(body[data-theme="arctic"]) .option-card {
    background: rgba(0, 0, 0, 0.03);
    border: 2px solid rgba(0, 0, 0, 0.1);
  }

  :global(body[data-theme="arctic"]) .option-card:hover {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.15);
  }

  :global(body[data-theme="arctic"]) .option-card.active {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.5);
  }

  :global(body[data-theme="arctic"]) .radio-button {
    border-color: rgba(0, 0, 0, 0.4);
  }

  :global(body[data-theme="arctic"]) .radio-dot {
    background: #3b82f6;
  }

  :global(body[data-theme="arctic"]) .advanced-section {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  :global(body[data-theme="arctic"]) .slider {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 0, 0, 0.15);
  }

  :global(body[data-theme="arctic"]) .slider::-webkit-slider-thumb {
    background: #3b82f6;
  }

  :global(body[data-theme="arctic"]) .slider::-webkit-slider-thumb:hover {
    background: #2563eb;
  }

  :global(body[data-theme="arctic"]) .slider::-moz-range-thumb {
    background: #3b82f6;
  }

  :global(body[data-theme="arctic"]) .slider::-moz-range-thumb:hover {
    background: #2563eb;
  }

  :global(body[data-theme="arctic"]) .checkbox {
    accent-color: #3b82f6;
  }

  /* Arctic Theme Text Color Overrides */
  :global(body[data-theme="arctic"]) .modal-body p,
  :global(body[data-theme="arctic"]) .modal-body h3,
  :global(body[data-theme="arctic"]) .modal-body label,
  :global(body[data-theme="arctic"]) .modal-body span {
    color: rgba(0, 0, 0, 0.9) !important;
  }

  /* Button Base Styles (All Themes) */
  :global(.btn-primary),
  :global(.btn-secondary) {
    padding: 0.625rem 1.25rem;
    border-radius: 0.75rem;
    font-weight: 500;
    transition: all 0.2s;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Arctic Theme Button Overrides */
  :global(body[data-theme="arctic"]) :global(.btn-secondary) {
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.15);
    color: rgba(0, 0, 0, 0.9);
  }

  :global(body[data-theme="arctic"]) :global(.btn-secondary:hover) {
    background: rgba(0, 0, 0, 0.1);
    border-color: rgba(0, 0, 0, 0.25);
  }

  :global(body[data-theme="arctic"]) :global(.btn-primary) {
    background: #3b82f6;
    border: 1px solid #2563eb;
    color: white;
  }

  :global(body[data-theme="arctic"]) :global(.btn-primary:hover) {
    background: #2563eb;
    border-color: #1d4ed8;
  }

  /* Neon Theme Button Overrides */
  :global(body[data-theme="neon"]) :global(.btn-secondary) {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
  }

  :global(body[data-theme="neon"]) :global(.btn-secondary:hover) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  :global(body[data-theme="neon"]) :global(.btn-primary) {
    background: #6366f1;
    border: 1px solid #818cf8;
    color: white;
  }

  :global(body[data-theme="neon"]) :global(.btn-primary:hover) {
    background: #4f46e5;
    border-color: #6366f1;
  }

  /* Graphite Theme Button Overrides */
  :global(body[data-theme="graphite"]) :global(.btn-secondary) {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.95);
  }

  :global(body[data-theme="graphite"]) :global(.btn-secondary:hover) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  :global(body[data-theme="graphite"]) :global(.btn-primary) {
    background: #3b82f6;
    border: 1px solid #60a5fa;
    color: white;
  }

  :global(body[data-theme="graphite"]) :global(.btn-primary:hover) {
    background: #2563eb;
    border-color: #3b82f6;
  }

  /* Arctic Theme - File display background */
  :global(body[data-theme="arctic"]) .modal-body > div > div > div > div > div {
    background: rgba(0, 0, 0, 0.05) !important;
  }
</style>
