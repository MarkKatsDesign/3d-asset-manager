<script>
  import { authStore } from '../stores/authStore';

  let isLogin = true;
  let email = '';
  let password = '';
  let name = '';
  let error = '';
  let loading = false;
  let showPassword = false;

  // Password validation state
  let passwordTouched = false;
  $: passwordValid = password.length >= 8;
  $: emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSubmit() {
    error = '';

    // Client-side validation
    if (!email.trim()) {
      error = 'Please enter your email address';
      return;
    }

    if (!emailValid) {
      error = 'Please enter a valid email address';
      return;
    }

    if (!password) {
      error = 'Please enter your password';
      return;
    }

    if (!isLogin && password.length < 8) {
      error = 'Password must be at least 8 characters long';
      return;
    }

    if (!isLogin && !name.trim()) {
      error = 'Please enter your name';
      return;
    }

    loading = true;

    if (isLogin) {
      const result = await authStore.login(email, password);
      if (!result.success) {
        error = result.error;
      }
    } else {
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
    passwordTouched = false;
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function handlePasswordInput() {
    passwordTouched = true;
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
            Full Name <span class="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            bind:value={name}
            placeholder="John Doe"
            class="glass-input w-full"
            disabled={loading}
            autocomplete="name"
          />
        </div>
      {/if}

      <!-- Email Field -->
      <div>
        <label for="email" class="block text-sm font-medium mb-2">
          Email Address <span class="text-red-400">*</span>
        </label>
        <input
          type="email"
          id="email"
          bind:value={email}
          placeholder="you@example.com"
          class="glass-input w-full {email && !emailValid ? 'border-red-400/50' : ''}"
          disabled={loading}
          autocomplete="email"
        />
        {#if email && !emailValid}
          <p class="text-xs text-red-400 mt-1 flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Please enter a valid email address</span>
          </p>
        {/if}
      </div>

      <!-- Password Field -->
      <div>
        <label for="password" class="block text-sm font-medium mb-2">
          Password <span class="text-red-400">*</span>
        </label>
        <div class="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            bind:value={password}
            on:input={handlePasswordInput}
            placeholder="••••••••"
            class="glass-input w-full pr-12 {!isLogin && passwordTouched && !passwordValid ? 'border-red-400/50' : ''}"
            disabled={loading}
            autocomplete={isLogin ? "current-password" : "new-password"}
          />
          <button
            type="button"
            on:click={togglePasswordVisibility}
            class="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-colors"
            tabindex="-1"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {#if showPassword}
              <!-- Eye Slash Icon (Hide) -->
              <svg class="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            {:else}
              <!-- Eye Icon (Show) -->
              <svg class="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            {/if}
          </button>
        </div>

        {#if !isLogin}
          <!-- Password Strength Indicator -->
          <div class="mt-2 space-y-1">
            <div class="flex items-center space-x-2 text-xs">
              {#if passwordTouched}
                <div class="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    class="h-full transition-all duration-300 {passwordValid ? 'bg-green-400 w-full' : 'bg-red-400 w-1/3'}"
                  ></div>
                </div>
                <span class="{passwordValid ? 'text-green-400' : 'text-red-400'}">
                  {passwordValid ? '✓ Strong' : '✗ Too short'}
                </span>
              {/if}
            </div>
            <p class="text-xs text-white/50">
              {#if passwordTouched && !passwordValid}
                <span class="text-red-400">Password must be at least 8 characters</span>
              {:else}
                Minimum 8 characters required
              {/if}
            </p>
          </div>
        {/if}
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 animate-slide-up">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <p class="text-red-400 text-sm font-medium mb-1">Error</p>
              <p class="text-red-300 text-sm">{error}</p>
            </div>
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
