<script>
  import { authStore } from '../stores/authStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let showUserMenu = false;

  function handleLogout() {
    authStore.logout();
    showUserMenu = false;
  }

  function handleUploadClick() {
    dispatch('upload');
  }
</script>

<nav class="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/10 rounded-none">
  <div class="max-w-[1920px] mx-auto px-8 py-4">
    <div class="flex items-center justify-between">
      <!-- Logo & Brand -->
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold gradient-text">3D Asset Manager</h1>
          <p class="text-xs text-white/60">Manage your 3D assets with style</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-4">
        {#if $authStore.isAuthenticated}
          <!-- Upload Button -->
          <button
            on:click={handleUploadClick}
            class="glass-button flex items-center space-x-2 font-medium"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Upload Asset</span>
          </button>

          <!-- User Menu -->
          <div class="relative">
            <button
              on:click={() => showUserMenu = !showUserMenu}
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center font-bold text-white shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              {$authStore.user?.name?.charAt(0).toUpperCase() || 'U'}
            </button>

            {#if showUserMenu}
              <div class="absolute right-0 mt-2 w-56 glass-modal animate-slide-up">
                <div class="p-4 border-b border-white/10">
                  <p class="font-semibold">{$authStore.user?.name || 'User'}</p>
                  <p class="text-sm text-white/60">{$authStore.user?.email || ''}</p>
                </div>
                <div class="p-2">
                  <button
                    on:click={handleLogout}
                    class="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center space-x-2 text-red-400"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</nav>

<!-- Click outside to close menu -->
{#if showUserMenu}
  <div
    class="fixed inset-0 z-40"
    on:click={() => showUserMenu = false}
  ></div>
{/if}
