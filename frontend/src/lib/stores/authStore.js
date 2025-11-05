import { writable } from 'svelte/store';
import { pb } from '../pocketbase';

function createAuthStore() {
  const { subscribe, set } = writable({
    isAuthenticated: pb.authStore.isValid,
    user: pb.authStore.model
  });

  // Listen to auth changes
  pb.authStore.onChange((token, model) => {
    set({
      isAuthenticated: !!token,
      user: model
    });
  });

  // Helper to parse PocketBase errors
  const parseError = (error) => {
    if (error.response?.data) {
      const data = error.response.data;
      // Handle field-specific errors
      if (data.email) {
        return `Email error: ${data.email.message}`;
      }
      if (data.password) {
        return `Password error: ${data.password.message}`;
      }
      if (data.passwordConfirm) {
        return `Password confirmation error: ${data.passwordConfirm.message}`;
      }
      if (data.name) {
        return `Name error: ${data.name.message}`;
      }
      // Handle general error message
      if (data.message) {
        return data.message;
      }
    }

    // Handle common authentication errors
    if (error.status === 400) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (error.status === 404) {
      return 'No account found with this email address. Please sign up first.';
    }
    if (error.status === 429) {
      return 'Too many attempts. Please try again later.';
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  };

  return {
    subscribe,
    login: async (email, password) => {
      try {
        const authData = await pb.collection('users').authWithPassword(email, password);
        set({
          isAuthenticated: true,
          user: authData.record
        });
        return { success: true };
      } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: parseError(error) };
      }
    },
    register: async (email, password, name) => {
      try {
        const data = {
          email,
          password,
          passwordConfirm: password,
          name
        };
        await pb.collection('users').create(data);
        // Auto login after registration
        return await createAuthStore().login(email, password);
      } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: parseError(error) };
      }
    },
    logout: () => {
      pb.authStore.clear();
      set({
        isAuthenticated: false,
        user: null
      });
    }
  };
}

export const authStore = createAuthStore();
