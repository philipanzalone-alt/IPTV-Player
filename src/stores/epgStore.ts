import { create } from 'zustand';
import type { EpgProgram, EpgSource } from '../types';
import * as api from '../lib/api';

export interface EpgStore {
  // ── EPG data ──────────────────────────────────────────────────────────────
  epgByTvgId: Record<string, EpgProgram[]>;
  nowPlaying: Record<string | number, EpgProgram>;

  // ── EPG sources ───────────────────────────────────────────────────────────
  epgSources: EpgSource[];
  isLoadingSources: boolean;
  syncingSourceId: number | null;

  // ── Sync status ───────────────────────────────────────────────────────────
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isLoading: boolean;
  error: string | null;

  // ── Time offset (for regions / testing) ──────────────────────────────────
  timeOffsetMinutes: number;

  // ── Actions ───────────────────────────────────────────────────────────────
  syncProviderEpg: (providerId: number) => Promise<void>;
  fetchEpgForChannel: (channelTvgId: string, providerId: number) => Promise<EpgProgram[]>;
  /** Force-refetch EPG for a channel, bypassing the cache. */
  refetchEpgForChannel: (channelTvgId: string, providerId: number) => Promise<EpgProgram[]>;
  fetchNowPlaying: (channelIds: number[], providerId?: number) => Promise<void>;

  fetchEpgSources: (providerId?: number) => Promise<void>;
  addEpgSource: (name: string, url: string, providerId?: number) => Promise<EpgSource>;
  deleteEpgSource: (sourceId: number) => Promise<void>;
  syncEpgSource: (sourceId: number) => Promise<void>;
  syncAllSources: (providerId?: number) => Promise<void>;

  setTimeOffsetMinutes: (minutes: number) => void;
  clearEpgCache: () => void;
  clearError: () => void;
}

export const useEpgStore = create<EpgStore>((set, get) => ({
  epgByTvgId: {},
  nowPlaying: {},
  epgSources: [],
  isLoadingSources: false,
  syncingSourceId: null,
  isSyncing: false,
  lastSyncedAt: null,
  isLoading: false,
  timeOffsetMinutes: 0,
  error: null,

  // ─── Provider EPG sync (Xtream built-in EPG) ───────────────────────────────
  syncProviderEpg: async (providerId) => {
    set({ isSyncing: true, error: null });
    try {
      await api.syncEpg(providerId);
      set({ isSyncing: false, lastSyncedAt: new Date() });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), isSyncing: false });
    }
  },

  // ─── Per-channel EPG fetch (cached) ──────────────────────────────────────
  fetchEpgForChannel: async (channelTvgId, providerId) => {
    if (!channelTvgId?.trim()) return [];
    const cached = get().epgByTvgId[channelTvgId];
    if (cached && cached.length > 0) return cached;
    return get().refetchEpgForChannel(channelTvgId, providerId);
  },

  refetchEpgForChannel: async (channelTvgId, providerId) => {
    if (!channelTvgId?.trim()) return [];
    set({ isLoading: true, error: null });
    try {
      const programs = await api.getChannelEpg(channelTvgId, providerId);
      set((state) => ({
        epgByTvgId: { ...state.epgByTvgId, [channelTvgId]: programs },
        isLoading: false,
      }));
      return programs;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
      return [];
    }
  },

  // ─── Batch now-playing fetch ──────────────────────────────────────────────
  fetchNowPlaying: async (channelIds, providerId) => {
    if (!channelIds?.length) return;
    try {
      const nowPlayingMap = await api.getNowPlaying(channelIds, providerId);
      set((state) => ({
        nowPlaying: { ...state.nowPlaying, ...nowPlayingMap },
      }));
    } catch (err: unknown) {
      console.warn('[EPG] fetchNowPlaying failed:', err instanceof Error ? err.message : err);
    }
  },

  // ─── EPG source management ────────────────────────────────────────────────
  fetchEpgSources: async (providerId) => {
    set({ isLoadingSources: true, error: null });
    try {
      const sources = await api.getEpgSources(providerId);
      set({ epgSources: sources, isLoadingSources: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), isLoadingSources: false });
    }
  },

  addEpgSource: async (name, url, providerId) => {
    set({ isLoadingSources: true, error: null });
    try {
      const newSource = await api.addEpgSource(name, url, providerId);
      const updated = await api.getEpgSources(providerId);
      set({ epgSources: updated, isLoadingSources: false });
      return newSource;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), isLoadingSources: false });
      throw err;
    }
  },

  deleteEpgSource: async (sourceId) => {
    try {
      await api.deleteEpgSource(sourceId);
      set((state) => ({
        epgSources: state.epgSources.filter((s) => s.id !== sourceId),
      }));
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  syncEpgSource: async (sourceId) => {
    set({ syncingSourceId: sourceId, error: null });
    try {
      await api.syncEpgSource(sourceId);
      const updated = await api.getEpgSources();
      set({ epgSources: updated, syncingSourceId: null, lastSyncedAt: new Date() });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), syncingSourceId: null });
      throw err;
    }
  },

  syncAllSources: async (providerId) => {
    set({ isSyncing: true, error: null });
    try {
      await api.syncAllEpgSources(providerId);
      const updated = await api.getEpgSources(providerId);
      set({
        epgSources: updated,
        isSyncing: false,
        lastSyncedAt: new Date(),
      });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), isSyncing: false });
      throw err;
    }
  },

  // ─── Misc ────────────────────────────────────────────────────────────────
  setTimeOffsetMinutes: (minutes) => set({ timeOffsetMinutes: minutes }),

  clearEpgCache: () => set({ epgByTvgId: {}, nowPlaying: {} }),

  clearError: () => set({ error: null }),
}));

export default useEpgStore;
