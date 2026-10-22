import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Channel } from '../types';
import { useProviderStore } from '../stores/providerStore';
import { useChannelStore } from '../stores/channelStore';
import { useEditorStore } from '../stores/editorStore';
import * as api from '../lib/api';

export interface UseChannelsResult {
  channels: Channel[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseChannelsOptions {
  categoryId?: number | 'all';
  showHidden?: boolean;
}

export function useChannels(
  optionsOrShowHidden: UseChannelsOptions | boolean = false
): UseChannelsResult {
  const options =
    typeof optionsOrShowHidden === 'boolean'
      ? { showHidden: optionsOrShowHidden }
      : optionsOrShowHidden;

  const showHidden = options.showHidden ?? false;
  const explicitCategoryId = options.categoryId;

  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedCategory = useChannelStore((s) => s.selectedCategory);
  const selectedCustomPlaylist = useChannelStore((s) => s.selectedCustomPlaylist);
  const searchQuery = useChannelStore((s) => s.searchQuery);
  const overrides = useEditorStore((s) => s.overrides);
  const favorites = useEditorStore((s) => s.favorites);
  const fetchOverrides = useEditorStore((s) => s.fetchOverrides);

  const [rawChannels, setRawChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load overrides when provider changes
  useEffect(() => {
    if (selectedProvider) {
      fetchOverrides(selectedProvider.id);
    }
  }, [selectedProvider?.id, fetchOverrides]);

  const loadChannels = useCallback(async () => {
    if (!selectedProvider) {
      setRawChannels([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result: Channel[] = [];

      // If categoryId option was explicitly passed (e.g. from TV Guide)
      if (explicitCategoryId !== undefined) {
        if (explicitCategoryId === 'all') {
          result = await api.getChannels(selectedProvider.id);
        } else {
          result = await api.getChannels(selectedProvider.id, explicitCategoryId);
        }
      } else if (selectedCustomPlaylist) {
        // Priority 1: Custom Playlist consisting of categories
        result = await api.getChannelsByCustomPlaylist(
          selectedCustomPlaylist.id,
          selectedProvider.id
        );
        if (searchQuery.trim().length > 0) {
          const query = searchQuery.trim().toLowerCase();
          result = result.filter(
            (ch) =>
              ch.name.toLowerCase().includes(query) ||
              (ch.display_name && ch.display_name.toLowerCase().includes(query))
          );
        }
      } else if (selectedCategory?.remote_id === 'favorites') {
        // Special case: "Favorites" category (remote_id === 'favorites')
        result = await api.getFavorites();
      } else if (searchQuery.trim().length > 0) {
        result = await api.searchChannels(selectedProvider.id, searchQuery.trim());
      } else {
        const catId = selectedCategory?.id;
        result = await api.getChannels(selectedProvider.id, catId);
      }

      setRawChannels(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider, explicitCategoryId, selectedCategory, selectedCustomPlaylist, searchQuery]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Map channel overrides and favorites
  const channels = useMemo(() => {
    // Index overrides by target_id
    const channelOverridesMap = new Map<number, Record<string, string>>();
    for (const ov of overrides) {
      if (ov.target_type === 'channel' && ov.override_value !== undefined) {
        if (!channelOverridesMap.has(ov.target_id)) {
          channelOverridesMap.set(ov.target_id, {});
        }
        channelOverridesMap.get(ov.target_id)![ov.override_key] = ov.override_value;
      }
    }

    const favoriteIds = new Set(favorites.map((f) => f.id));

    return rawChannels
      .map((channel) => {
        const ovs = channelOverridesMap.get(channel.id);
        const displayName = ovs?.['name'] || channel.display_name || channel.name;
        const customTvgId = ovs?.['tvg_id'] || channel.custom_tvg_id || channel.tvg_id;
        const customLogo = ovs?.['logo_url'] || channel.logo_url;
        const isHidden = ovs?.['hidden'] !== undefined ? ovs['hidden'] === 'true' : !!channel.is_hidden;
        const customSortOrder = ovs?.['sort_order'] ? parseInt(ovs['sort_order'], 10) : channel.sort_order;
        const isFav = favoriteIds.has(channel.id) || !!channel.is_favorite;

        return {
          ...channel,
          name: channel.name,
          display_name: displayName,
          tvg_id: customTvgId,
          custom_tvg_id: customTvgId,
          logo_url: customLogo,
          is_hidden: isHidden,
          sort_order: isNaN(customSortOrder) ? channel.sort_order : customSortOrder,
          is_favorite: isFav,
        };
      })
      .filter((channel) => showHidden || !channel.is_hidden)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [rawChannels, overrides, favorites, showHidden]);

  return {
    channels,
    isLoading,
    error,
    refetch: loadChannels,
  };
}
