import { create } from 'zustand';
import type { Channel } from '../types';
import * as api from '../lib/api';

export interface PlayerStore {
  isPlaying: boolean;
  currentChannel: Channel | null;
  resolvedStreamUrl: string | null;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isOverlayVisible: boolean;
  isLoadingStream: boolean;
  error: string | null;
  playlist: Channel[];

  playChannel: (channel: Channel, playlistContext?: Channel[]) => Promise<void>;
  stopPlayback: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setFullscreen: (fullscreen: boolean) => void;
  toggleFullscreen: () => void;
  setOverlayVisible: (visible: boolean) => void;
  setError: (error: string | null) => void;
  nextChannel: () => void;
  previousChannel: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  isPlaying: false,
  currentChannel: null,
  resolvedStreamUrl: null,
  volume: 1.0,
  isMuted: false,
  isFullscreen: false,
  isOverlayVisible: true,
  isLoadingStream: false,
  error: null,
  playlist: [],

  playChannel: async (channel: Channel, playlistContext?: Channel[]) => {
    set({
      currentChannel: channel,
      playlist: playlistContext ?? get().playlist,
      isLoadingStream: true,
      error: null,
      isPlaying: true,
      isOverlayVisible: true,
    });

    try {
      let url = channel.stream_url;
      try {
        const backendUrl = await api.getChannelStreamUrl(channel.id);
        if (backendUrl && backendUrl.trim().length > 0) {
          url = backendUrl;
        }
      } catch {
        // Fall back to channel's existing stream_url
      }

      set({ resolvedStreamUrl: url, isLoadingStream: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoadingStream: false, isPlaying: false });
    }
  },

  stopPlayback: () => {
    set({
      isPlaying: false,
      currentChannel: null,
      resolvedStreamUrl: null,
      error: null,
      isFullscreen: false,
    });
  },

  togglePlay: () => {
    set({ isPlaying: !get().isPlaying });
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    set({ isMuted: !get().isMuted });
  },

  setFullscreen: (fullscreen: boolean) => {
    set({ isFullscreen: fullscreen });
  },

  toggleFullscreen: () => {
    set({ isFullscreen: !get().isFullscreen });
  },

  setOverlayVisible: (visible: boolean) => {
    set({ isOverlayVisible: visible });
  },

  setError: (error: string | null) => {
    set({ error, isLoadingStream: false });
  },

  nextChannel: () => {
    const { playlist, currentChannel } = get();
    if (!playlist.length || !currentChannel) return;
    const currentIndex = playlist.findIndex((c) => c.id === currentChannel.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    get().playChannel(playlist[nextIndex]);
  },

  previousChannel: () => {
    const { playlist, currentChannel } = get();
    if (!playlist.length || !currentChannel) return;
    const currentIndex = playlist.findIndex((c) => c.id === currentChannel.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    get().playChannel(playlist[prevIndex]);
  },
}));
