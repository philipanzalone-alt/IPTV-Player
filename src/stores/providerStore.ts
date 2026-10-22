import { create } from 'zustand';
import type { Provider, AddProviderXtream, AddProviderM3U } from '../types';
import * as api from '../lib/api';

export interface ProviderStore {
  providers: Provider[];
  selectedProvider: Provider | null;
  isLoading: boolean;
  isSyncingId: number | null;
  error: string | null;
  fetchProviders: () => Promise<void>;
  addXtreamProvider: (data: AddProviderXtream) => Promise<void>;
  addM3uProvider: (data: AddProviderM3U) => Promise<void>;
  deleteProvider: (id: number) => Promise<void>;
  syncProvider: (id: number) => Promise<void>;
  selectProvider: (provider: Provider | null) => void;
  clearError: () => void;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  selectedProvider: null,
  isLoading: false,
  isSyncingId: null,
  error: null,

  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const providers = await api.getProviders();
      const currentSelected = get().selectedProvider;
      
      let nextSelected: Provider | null = null;
      if (currentSelected) {
        nextSelected = providers.find((p) => p.id === currentSelected.id) || (providers.length > 0 ? providers[0] : null);
      } else if (providers.length > 0) {
        nextSelected = providers[0];
      }

      set({ providers, selectedProvider: nextSelected, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  addXtreamProvider: async (data: AddProviderXtream) => {
    set({ isLoading: true, error: null });
    try {
      const newProvider = await api.addXtreamProvider(data);
      const providers = [...get().providers, newProvider];
      set({
        providers,
        selectedProvider: get().selectedProvider ?? newProvider,
        isLoading: false,
      });
      // Trigger background sync for the newly added provider
      get().syncProvider(newProvider.id).catch(console.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  addM3uProvider: async (data: AddProviderM3U) => {
    set({ isLoading: true, error: null });
    try {
      const newProvider = await api.addM3uProvider(data);
      const providers = [...get().providers, newProvider];
      set({
        providers,
        selectedProvider: get().selectedProvider ?? newProvider,
        isLoading: false,
      });
      // Trigger background sync for the newly added provider
      get().syncProvider(newProvider.id).catch(console.error);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  deleteProvider: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteProvider(id);
      const filtered = get().providers.filter((p) => p.id !== id);
      const selected = get().selectedProvider;
      const nextSelected = selected?.id === id ? (filtered[0] ?? null) : selected;
      set({ providers: filtered, selectedProvider: nextSelected, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  syncProvider: async (id: number) => {
    set({ isSyncingId: id, error: null });
    try {
      await api.syncProvider(id);
      // Also trigger EPG sync
      try {
        await api.syncEpg(id);
      } catch (epgErr) {
        console.warn('EPG sync note:', epgErr);
      }
      // Re-fetch provider list to update last_synced_at and status
      const providers = await api.getProviders();
      const updatedSelected = providers.find((p) => p.id === (get().selectedProvider?.id ?? id)) ?? null;
      set({ providers, selectedProvider: updatedSelected, isSyncingId: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isSyncingId: null });
      throw err;
    }
  },

  selectProvider: (provider: Provider | null) => {
    set({ selectedProvider: provider });
  },

  clearError: () => set({ error: null }),
}));
