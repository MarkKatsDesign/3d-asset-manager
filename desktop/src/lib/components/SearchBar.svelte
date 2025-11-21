<script>
  import { localAssetStore } from '../stores/localAssetStore';

  let searchQuery = '';

  $: localAssetStore.setSearchQuery(searchQuery);
</script>

<div class="w-full max-w-2xl">
  <div class="relative">
    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <svg class="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search assets by name or description..."
      class="glass-input w-full pl-12 pr-4 text-lg"
    />
    {#if searchQuery}
      <button
        on:click={() => searchQuery = ''}
        class="absolute inset-y-0 right-0 pr-4 flex items-center text-white/50 hover:text-white transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>
</div>
