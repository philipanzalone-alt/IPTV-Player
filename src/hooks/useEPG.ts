import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Channel, EpgProgram } from '../types';
import { useProviderStore } from '../stores/providerStore';
import { useEpgStore } from '../stores/epgStore';

export interface UseEpgResult {
  nowPlaying: Record<string | number, EpgProgram>;
  epgByTvgId: Record<string, EpgProgram[]>;
  fetchChannelSchedule: (channelTvgId: string) => Promise<EpgProgram[]>;
  getProgramsForChannel: (channelTvgId: string) => EpgProgram[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useEPG(channels: Channel[]): UseEpgResult {
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const { epgByTvgId, nowPlaying, fetchNowPlaying, fetchEpgForChannel } = useEpgStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const channelIdsKey = useMemo(() => {
    return channels.map((c) => c.id).filter(Boolean).join(',');
  }, [channels]);

  const loadNowPlaying = useCallback(async () => {
    const ids = channels.map((c) => c.id).filter(Boolean);
    if (!ids.length) return;
    setIsLoading(true);
    try {
      await fetchNowPlaying(ids, selectedProvider?.id);
    } catch (err) {
      console.warn('Failed to load now playing:', err);
    } finally {
      setIsLoading(false);
    }
  }, [channels, selectedProvider?.id, fetchNowPlaying]);

  // Initial fetch and whenever channels or provider change
  useEffect(() => {
    if (!channelIdsKey) return;
    loadNowPlaying();
  }, [channelIdsKey, selectedProvider?.id, loadNowPlaying]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!channelIdsKey) return;
    const interval = setInterval(() => {
      loadNowPlaying();
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [channelIdsKey, loadNowPlaying]);

  const fetchChannelSchedule = useCallback(
    async (channelTvgId: string): Promise<EpgProgram[]> => {
      if (!selectedProvider || !channelTvgId) return [];
      return fetchEpgForChannel(channelTvgId, selectedProvider.id);
    },
    [selectedProvider, fetchEpgForChannel]
  );

  const getProgramsForChannel = useCallback(
    (channelTvgId: string): EpgProgram[] => {
      if (!channelTvgId) return [];
      return epgByTvgId[channelTvgId] || [];
    },
    [epgByTvgId]
  );

  return {
    nowPlaying,
    epgByTvgId,
    fetchChannelSchedule,
    getProgramsForChannel,
    isLoading,
    refresh: loadNowPlaying,
  };
}
