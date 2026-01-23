import { create } from 'zustand';

interface AdminState {
  isAuthenticated: boolean;
  password: string;
  setPassword: (password: string) => void;
  setAuthenticated: (authenticated: boolean) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAuthenticated: false,
  password: '',
  setPassword: (password) => set({ password }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  logout: () => set({ isAuthenticated: false, password: '' }),
}));
