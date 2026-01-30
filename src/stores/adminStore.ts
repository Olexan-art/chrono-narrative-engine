import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AdminState {
  isAuthenticated: boolean;
  password: string;
  setPassword: (password: string) => void;
  setAuthenticated: (authenticated: boolean) => void;
  logout: () => void;
}

// Persist admin auth within the current browser session so it survives refresh/navigation.
// (Session storage reduces risk vs localStorage while still fixing the UX issue.)
export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      password: '',
      setPassword: (password) => set({ password }),
      setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
      logout: () => set({ isAuthenticated: false, password: '' }),
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          // SSR-safe in-memory fallback
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          } as unknown as Storage;
        }
        return sessionStorage;
      }),
    },
  ),
);
