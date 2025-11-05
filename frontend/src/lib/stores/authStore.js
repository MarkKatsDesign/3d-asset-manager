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
        return { success: false, error: error.message };
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
        return { success: false, error: error.message };
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
