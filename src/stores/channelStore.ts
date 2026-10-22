import { create } from 'zustand';
import type { Category, Channel, ViewMode, ContentType, AppPage, CustomPlaylist } from '../types';
import * as api from '../lib/api';

export interface ChannelStore {
  categories: Category[];
  selectedCategory: Category | null;
  customPlaylists: CustomPlaylist[];
  selectedCustomPlaylist: CustomPlaylist | null;
  channels: Channel[];
  searchQuery: string;
  viewMode: ViewMode;
  contentType: ContentType;
  currentPage: AppPage;
  isLoadingCategories: boolean;
  isLoadingCustomPlaylists: boolean;
  isLoadingChannels: boolean;
  error: string | null;

  setPage: (page: AppPage) => void;
  setContentType: (type: ContentType) => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: Category | null) => void;
  setSelectedCustomPlaylist: (playlist: CustomPlaylist | null) => void;
  fetchCategories: (providerId: number, contentType?: ContentType | string) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  reorderCategories: (providerId: number, categoryIds: number[]) => Promise<void>;
  fetchCustomPlaylists: () => Promise<void>;
  createCustomPlaylist: (name: string, categoryIds: number[]) => Promise<CustomPlaylist>;
  deleteCustomPlaylist: (id: number) => Promise<void>;
  fetchChannels: (providerId: number, categoryId?: number) => Promise<void>;
  searchChannels: (providerId: number, query: string) => Promise<void>;
  toggleFavorite: (channelId: number) => Promise<void>;
  updateChannelLocal: (channelId: number, updates: Partial<Channel>) => void;
  clearError: () => void;
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  categories: [],
  selectedCategory: null,
  customPlaylists: [],
  selectedCustomPlaylist: null,
  channels: [],
  searchQuery: '',
  viewMode: (typeof window !== 'undefined' && (localStorage.getItem('iptv_view_mode') as ViewMode)) || 'list',
  contentType: 'live',
  currentPage: 'channels',
  isLoadingCategories: false,
  isLoadingCustomPlaylists: false,
  isLoadingChannels: false,
  error: null,

  setPage: (page: AppPage) => {
    set({ currentPage: page });
  },

  setContentType: (type: ContentType) => {
    set({ contentType: type, selectedCategory: null, selectedCustomPlaylist: null });
  },

  setViewMode: (mode: ViewMode) => {
    try {
      localStorage.setItem('iptv_view_mode', mode);
    } catch (e) {}
    set({ viewMode: mode });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSelectedCategory: (category: Category | null) => {
    set({ selectedCategory: category, selectedCustomPlaylist: null });
  },

  setSelectedCustomPlaylist: (playlist: CustomPlaylist | null) => {
    set({ selectedCustomPlaylist: playlist, selectedCategory: null });
  },

  fetchCategories: async (providerId: number, contentType?: ContentType | string) => {
    const type = contentType || get().contentType;
    set({ isLoadingCategories: true, error: null });
    try {
      const categories = await api.getCategories(providerId, type);
      set({ categories, isLoadingCategories: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingCategories: false });
    }
  },

  deleteCategory: async (categoryId: number) => {
    try {
      await api.deleteCategory(categoryId);
      set({
        categories: get().categories.filter((c) => c.id !== categoryId),
        channels: get().channels.filter((ch) => ch.category_id !== categoryId),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      throw err;
    }
  },

  reorderCategories: async (providerId: number, categoryIds: number[]) => {
    try {
      await api.reorderCategories(providerId, categoryIds);
      const catMap = new Map(get().categories.map((c) => [c.id, c]));
      const ordered = categoryIds.map((id) => catMap.get(id)!).filter(Boolean);
      set({ categories: ordered });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      throw err;
    }
  },

  fetchCustomPlaylists: async () => {
    set({ isLoadingCustomPlaylists: true, error: null });
    try {
      const customPlaylists = await api.getCustomPlaylists();
      set({ customPlaylists, isLoadingCustomPlaylists: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingCustomPlaylists: false });
    }
  },

  createCustomPlaylist: async (name: string, categoryIds: number[]) => {
    set({ isLoadingCustomPlaylists: true, error: null });
    try {
      const newPlaylist = await api.createCustomPlaylist(name);
      if (categoryIds.length > 0) {
        await api.setCustomPlaylistCategories(newPlaylist.id, categoryIds);
        newPlaylist.category_ids = categoryIds;
      }
      const updatedList = await api.getCustomPlaylists();
      set({
        customPlaylists: updatedList,
        selectedCustomPlaylist: updatedList.find((p) => p.id === newPlaylist.id) || newPlaylist,
        selectedCategory: null,
        isLoadingCustomPlaylists: false,
      });
      return newPlaylist;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingCustomPlaylists: false });
      throw err;
    }
  },

  deleteCustomPlaylist: async (id: number) => {
    set({ isLoadingCustomPlaylists: true, error: null });
    try {
      await api.deleteCustomPlaylist(id);
      const remaining = get().customPlaylists.filter((p) => p.id !== id);
      const currentSelected = get().selectedCustomPlaylist;
      set({
        customPlaylists: remaining,
        selectedCustomPlaylist: currentSelected?.id === id ? null : currentSelected,
        isLoadingCustomPlaylists: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingCustomPlaylists: false });
      throw err;
    }
  },

  fetchChannels: async (providerId: number, categoryId?: number) => {
    set({ isLoadingChannels: true, error: null });
    try {
      const channels = await api.getChannels(providerId, categoryId);
      set({ channels, isLoadingChannels: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingChannels: false });
    }
  },

  searchChannels: async (providerId: number, query: string) => {
    set({ isLoadingChannels: true, searchQuery: query, error: null });
    try {
      if (!query.trim()) {
        const catId = get().selectedCategory?.id;
        const channels = await api.getChannels(providerId, catId);
        set({ channels, isLoadingChannels: false });
        return;
      }
      const channels = await api.searchChannels(providerId, query);
      set({ channels, isLoadingChannels: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingChannels: false });
    }
  },

  toggleFavorite: async (channelId: number) => {
    try {
      const isFav = await api.toggleFavorite(channelId);
      set({
        channels: get().channels.map((c) =>
          c.id === channelId ? { ...c, is_favorite: isFav } : c
        ),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  updateChannelLocal: (channelId: number, updates: Partial<Channel>) => {
    set({
      channels: get().channels.map((c) =>
        c.id === channelId ? { ...c, ...updates } : c
      ),
    });
  },

  clearError: () => set({ error: null }),
}));
