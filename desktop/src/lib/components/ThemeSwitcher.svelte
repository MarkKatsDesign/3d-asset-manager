<script>
  import { themeStore, themes } from '../stores/themeStore';

  let showMenu = false;
  let currentTheme;

  themeStore.subscribe(value => {
    currentTheme = value;
  });

  function selectTheme(themeId) {
    themeStore.setTheme(themeId);
    showMenu = false;
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }

  // Close menu when clicking outside
  function handleClickOutside(event) {
    if (showMenu && !event.target.closest('.theme-switcher')) {
      showMenu = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="theme-switcher relative">
  <button
    on:click|stopPropagation={toggleMenu}
    class="glass-button p-2.5 rounded-xl transition-all duration-300 hover:scale-105"
    title="Change theme"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  </button>

  {#if showMenu}
    <div class="absolute right-0 mt-2 w-56 glass-card p-2 rounded-2xl z-50 animate-slide-down">
      <div class="text-xs font-semibold opacity-60 px-3 py-2">THEMES</div>

      {#each Object.values(themes) as theme}
        <button
          on:click={() => selectTheme(theme.id)}
          class="w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 flex items-center justify-between gap-3
            {currentTheme === theme.id ? 'bg-white/10' : 'hover:bg-white/5'}"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg {theme.id === 'cyberpunk' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : theme.id === 'macosLight' ? 'bg-gradient-to-br from-gray-100 to-gray-300 border border-gray-400' : 'bg-gradient-to-br from-zinc-800 to-zinc-900'}" />
            <div>
              <div class="font-medium text-sm">{theme.name}</div>
              <div class="text-xs opacity-60">{theme.font}</div>
            </div>
          </div>

          {#if currentTheme === theme.id}
            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-down {
    animation: slide-down 0.2s ease-out;
  }
</style>
