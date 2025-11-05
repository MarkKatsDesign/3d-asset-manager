<script>
  import { authStore } from '../stores/authStore';

  let isLogin = true;
  let email = '';
  let password = '';
  let name = '';
  let error = '';
  let loading = false;

  async function handleSubmit() {
    error = '';
    loading = true;

    if (isLogin) {
      const result = await authStore.login(email, password);
      if (!result.success) {
        error = result.error;
      }
    } else {
      if (!name.trim()) {
        error = 'Please enter your name';
        loading = false;
        return;
      }
      const result = await authStore.register(email, password, name);
      if (!result.success) {
        error = result.error;
      }
    }

    loading = false;
  }

  function toggleMode() {
    isLogin = !isLogin;
    error = '';
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4">
  <!-- Animated Background Elements -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-float"></div>
    <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" style="animation-delay: 2s;"></div>
  </div>

  <!-- Auth Card -->
  <div class="glass-modal w-full max-w-md relative z-10 animate-slide-up">
    <!-- Header -->
    <div class="p-8 text-center border-b border-white/10">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <h1 class="text-3xl font-bold gradient-text mb-2">
        {isLogin ? 'Welcome Back' : 'Get Started'}
      </h1>
      <p class="text-white/60">
        {isLogin ? 'Sign in to manage your 3D assets' : 'Create an account to get started'}
      </p>
    </div>

    <!-- Form -->
    <form on:submit|preventDefault={handleSubmit} class="p-8 space-y-5">
      {#if !isLogin}
        <!-- Name Field (Register only) -->
        <div>
          <label for="name" class="block text-sm font-medium mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            bind:value={name}
            placeholder="John Doe"
            class="glass-input w-full"
            required={!isLogin}
            disabled={loading}
          />
        </div>
      {/if}

      <!-- Email Field -->
      <div>
        <label for="email" class="block text-sm font-medium mb-2">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          bind:value={email}
          placeholder="you@example.com"
          class="glass-input w-full"
          required
          disabled={loading}
        />
      </div>

      <!-- Password Field -->
      <div>
        <label for="password" class="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          bind:value={password}
          placeholder="••••••••"
          class="glass-input w-full"
          required
          minlength="8"
          disabled={loading}
        />
        {#if !isLogin}
          <p class="text-xs text-white/50 mt-1">Minimum 8 characters</p>
        {/if}
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 animate-slide-up">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      {/if}

      <!-- Submit Button -->
      <button
        type="submit"
        class="w-full glass-button font-semibold text-lg py-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30"
        disabled={loading}
      >
        {#if loading}
          <div class="flex items-center justify-center space-x-2">
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
          </div>
        {:else}
          {isLogin ? 'Sign In' : 'Create Account'}
        {/if}
      </button>

      <!-- Toggle Mode -->
      <div class="text-center pt-4">
        <button
          type="button"
          on:click={toggleMode}
          class="text-white/60 hover:text-indigo-400 transition-colors text-sm"
          disabled={loading}
        >
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span class="text-indigo-400 font-semibold">
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </button>
      </div>
    </form>
  </div>
</div>
