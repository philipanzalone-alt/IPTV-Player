import { create } from 'zustand';
import type { Override, OverrideKey, CustomGroup, Channel } from '../types';
import * as api from '../lib/api';

export interface EditorStore {
  overrides: Override[];
  customGroups: CustomGroup[];
  favorites: Channel[];
  selectedChannelForEdit: Channel | null;
  isOverridePanelOpen: boolean;
  isExportModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  fetchOverrides: (providerId: number) => Promise<void>;
  setOverride: (
    providerId: number,
    targetType: 'channel' | 'category',
    targetId: number,
    key: OverrideKey,
    value: string
  ) => Promise<void>;
  removeOverride: (
    providerId: number,
    targetType: 'channel' | 'category',
    targetId: number,
    key: OverrideKey
  ) => Promise<void>;
  fetchCustomGroups: () => Promise<void>;
  createCustomGroup: (name: string) => Promise<CustomGroup | null>;
  deleteCustomGroup: (groupId: number) => Promise<void>;
  addChannelToGroup: (groupId: number, channelId: number) => Promise<void>;
  removeChannelFromGroup: (groupId: number, channelId: number) => Promise<void>;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (channelId: number) => Promise<boolean>;
  openEditPanel: (channel: Channel) => void;
  closeEditPanel: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  exportPlaylist: (providerId: number) => Promise<string>;
  clearError: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  overrides: [],
  customGroups: [],
  favorites: [],
  selectedChannelForEdit: null,
  isOverridePanelOpen: false,
  isExportModalOpen: false,
  isLoading: false,
  error: null,

  fetchOverrides: async (providerId: number) => {
    set({ isLoading: true, error: null });
    try {
      const overrides = await api.getOverrides(providerId);
      set({ overrides, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  setOverride: async (
    providerId: number,
    targetType: 'channel' | 'category',
    targetId: number,
    key: OverrideKey,
    value: string
  ) => {
    try {
      await api.setOverride(providerId, targetType, targetId, key, value);
      await get().fetchOverrides(providerId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      throw err;
    }
  },

  removeOverride: async (
    providerId: number,
    targetType: 'channel' | 'category',
    targetId: number,
    key: OverrideKey
  ) => {
    try {
      await api.removeOverride(providerId, targetType, targetId, key);
      await get().fetchOverrides(providerId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      throw err;
    }
  },

  fetchCustomGroups: async () => {
    try {
      const customGroups = await api.getCustomGroups();
      set({ customGroups });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  createCustomGroup: async (name: string): Promise<CustomGroup | null> => {
    try {
      const newGroup = await api.createCustomGroup(name);
      set((state) => ({ customGroups: [...state.customGroups, newGroup] }));
      return newGroup;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  deleteCustomGroup: async (groupId: number) => {
    try {
      await api.deleteCustomGroup(groupId);
      set((state) => ({
        customGroups: state.customGroups.filter((g) => g.id !== groupId),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  addChannelToGroup: async (groupId: number, channelId: number) => {
    try {
      await api.addChannelToGroup(groupId, channelId);
      await get().fetchCustomGroups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  removeChannelFromGroup: async (groupId: number, channelId: number) => {
    try {
      await api.removeChannelFromGroup(groupId, channelId);
      await get().fetchCustomGroups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  fetchFavorites: async () => {
    try {
      const favorites = await api.getFavorites();
      set({ favorites });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  toggleFavorite: async (channelId: number): Promise<boolean> => {
    try {
      const isFav = await api.toggleFavorite(channelId);
      await get().fetchFavorites();
      return isFav;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return false;
    }
  },

  openEditPanel: (channel: Channel) => {
    set({ selectedChannelForEdit: channel, isOverridePanelOpen: true });
  },

  closeEditPanel: () => {
    set({ selectedChannelForEdit: null, isOverridePanelOpen: false });
  },

  openExportModal: () => {
    set({ isExportModalOpen: true });
  },

  closeExportModal: () => {
    set({ isExportModalOpen: false });
  },

  exportPlaylist: async (providerId: number): Promise<string> => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.exportPlaylist(providerId);
      set({ isLoading: false });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
