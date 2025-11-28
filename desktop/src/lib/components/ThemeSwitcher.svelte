<script>
  import { createEventDispatcher } from 'svelte';
  import { themeStore, themes } from '../stores/themeStore';

  const dispatch = createEventDispatcher();

  let showMenu = false;
  let currentTheme;
  let currentThemeObj;

  themeStore.subscribe(value => {
    currentTheme = value;
    currentThemeObj = themes[value];
  });

  function selectTheme(themeId) {
    themeStore.setTheme(themeId);
    showMenu = false;
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function openBackgroundCustomizer() {
    showMenu = false;
    dispatch('customizeBackground');
  }

  // Close menu when clicking outside
  function handleClickOutside(event) {
    if (showMenu && !event.target.closest('.theme-switcher')) {
      showMenu = false;
    }
  }

  // Determine if current theme is light
  $: isLightTheme = currentTheme === 'arctic';
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
    <div class="absolute right-0 mt-2 w-56 p-2 rounded-2xl z-50 animate-slide-down
      {isLightTheme ? 'theme-menu-light' : 'theme-menu-dark'}">
      <div class="text-xs font-semibold px-3 py-2
        {isLightTheme ? 'text-gray-500' : 'text-white/60'}">
        THEMES
      </div>

      {#each Object.values(themes) as theme}
        <button
          on:click={() => selectTheme(theme.id)}
          class="w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 flex items-center justify-between gap-3
            {isLightTheme
              ? (currentTheme === theme.id ? 'bg-gray-200' : 'hover:bg-gray-100')
              : (currentTheme === theme.id ? 'bg-white/10' : 'hover:bg-white/5')}"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg {theme.id === 'neon' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : theme.id === 'arctic' ? 'bg-gradient-to-br from-gray-100 to-gray-300 border border-gray-400' : 'bg-gradient-to-br from-zinc-800 to-zinc-900'}" />
            <div>
              <div class="font-medium text-sm {isLightTheme ? 'text-gray-900' : 'text-white'}">
                {theme.name}
              </div>
              <div class="text-xs {isLightTheme ? 'text-gray-500' : 'text-white/60'}">
                {theme.font}
              </div>
            </div>
          </div>

          {#if currentTheme === theme.id}
            <svg class="w-5 h-5 {isLightTheme ? 'text-blue-500' : 'text-green-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </button>
      {/each}

      <!-- Separator -->
      <div class="my-2 border-t {isLightTheme ? 'border-gray-200' : 'border-white/10'}"></div>

      <!-- Customize Background Option -->
      <button
        on:click={openBackgroundCustomizer}
        class="w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 flex items-center gap-3
          {isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/5'}"
      >
        <svg class="w-5 h-5 {isLightTheme ? 'text-gray-700' : 'text-white/70'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div class="font-medium text-sm {isLightTheme ? 'text-gray-900' : 'text-white'}">
          Customize Background...
        </div>
      </button>
    </div>
  {/if}
</div>

<style>
  /* Dark theme menu */
  .theme-menu-dark {
    background: rgba(20, 20, 30, 0.85);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow:
      0 8px 32px 0 rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  }

  /* Light theme menu */
  .theme-menu-light {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow:
      0 8px 32px 0 rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(0, 0, 0, 0.05) inset;
  }

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
