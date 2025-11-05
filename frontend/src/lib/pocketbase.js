import PocketBase from 'pocketbase';

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090');

// Enable auto cancellation for pending requests
pb.autoCancellation(false);

// Auth helpers
export const isAuthenticated = () => pb.authStore.isValid;
export const currentUser = () => pb.authStore.model;

// Logout helper
export const logout = () => {
  pb.authStore.clear();
};
