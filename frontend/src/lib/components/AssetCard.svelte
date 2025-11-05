<script>
  import { createEventDispatcher } from 'svelte';
  import { pb } from '../pocketbase';

  export let asset;

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('view', asset);
  }

  function handleDelete(e) {
    e.stopPropagation();
    dispatch('delete', asset);
  }

  // Get thumbnail URL or use placeholder
  function getThumbnailUrl() {
    if (asset.thumbnail) {
      return pb.files.getUrl(asset, asset.thumbnail);
    }
    return null;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div
  class="glass-card cursor-pointer group overflow-hidden animate-fade-in"
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
>
  <!-- Thumbnail -->
  <div class="relative aspect-video bg-gradient-to-br from-indigo-900/50 to-purple-900/50 overflow-hidden">
    {#if getThumbnailUrl()}
      <img
        src={getThumbnailUrl()}
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

    <!-- File format badge -->
    <div class="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
      {asset.file?.split('.').pop()?.toUpperCase() || 'GLB'}
    </div>
  </div>

  <!-- Content -->
  <div class="p-4 space-y-3">
    <!-- Title -->
    <h3 class="font-bold text-lg truncate group-hover:text-indigo-300 transition-colors">
      {asset.name}
    </h3>

    <!-- Description -->
    {#if asset.description}
      <p class="text-sm text-white/70 line-clamp-2">
        {asset.description}
      </p>
    {/if}

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
      <div class="flex items-center space-x-2">
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xs font-bold">
          {asset.expand?.user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span class="text-xs text-white/60">{formatDate(asset.created)}</span>
      </div>

      <!-- Delete Button -->
      <button
        on:click={handleDelete}
        class="p-2 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
        title="Delete asset"
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
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
