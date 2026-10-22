import { invoke } from '@tauri-apps/api/core';
import type {
  Provider,
  AddProviderXtream,
  AddProviderM3U,
  Category,
  Channel,
  EpgProgram,
  EpgSource,
  Override,
  CustomGroup,
  CustomPlaylist,
  SyncResult,
  EpgSyncResult,
  ProxyResponse,
  AutoMatchResult,
  AppSettings,
} from '../types';

/**
 * Returns true if running inside the native Tauri runtime where window.__TAURI_INTERNALS__ exists.
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// ─── In-Memory / LocalStorage Mock Layer for Browser Preview ───
const STORAGE_PREFIX = 'iptv_player_';

const initialDemoProviders: Provider[] = [
  {
    id: 1,
    name: 'Demo Public Streams',
    type: 'm3u',
    user_agent: 'VLC/3.0.20',
    epg_time_offset_min: 0,
    created_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    account_status: 'Active',
  },
];

const initialDemoCategories: Category[] = [
  { id: 1, provider_id: 1, name: 'Live & Entertainment', type: 'live', sort_order: 0, channel_count: 2 },
  { id: 2, provider_id: 1, name: 'Movies & Animation', type: 'live', sort_order: 1, channel_count: 2 },
  { id: 3, provider_id: 1, name: 'VOD Trailers', type: 'vod', sort_order: 2, channel_count: 1 },
];

const initialDemoChannels: Channel[] = [
  {
    id: 1,
    provider_id: 1,
    category_id: 1,
    name: 'Mux Big Buck Bunny (HLS)',
    tvg_id: 'mux.bbb',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    stream_type: 'live',
    container_extension: 'm3u8',
    sort_order: 0,
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg',
  },
  {
    id: 2,
    provider_id: 1,
    category_id: 1,
    name: 'Apple BipBop Sample (HLS)',
    tvg_id: 'apple.bipbop',
    stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    stream_type: 'live',
    container_extension: 'm3u8',
    sort_order: 1,
  },
  {
    id: 3,
    provider_id: 1,
    category_id: 2,
    name: 'Tears of Steel 4K',
    tvg_id: 'tos.4k',
    stream_url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    stream_type: 'live',
    container_extension: 'm3u8',
    sort_order: 2,
  },
  {
    id: 4,
    provider_id: 1,
    category_id: 2,
    name: 'Sintel Open Movie',
    tvg_id: 'sintel.hd',
    stream_url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    stream_type: 'live',
    container_extension: 'm3u8',
    sort_order: 3,
  },
];

function getStored<T>(key: string, defaultVal: T): T {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
}

// ─── API Methods ───

export async function getProviders(): Promise<Provider[]> {
  if (isTauri()) {
    return invoke<Provider[]>('get_providers');
  }
  return getStored<Provider[]>('providers', initialDemoProviders);
}

export async function addXtreamProvider(data: AddProviderXtream): Promise<Provider> {
  if (isTauri()) {
    return invoke<Provider>('add_xtream_provider', {
      name: data.name,
      serverUrl: data.server_url,
      username: data.username,
      password: data.password,
      userAgent: data.user_agent,
    });
  }
  const providers = getStored<Provider[]>('providers', initialDemoProviders);
  const newProvider: Provider = {
    id: Date.now(),
    name: data.name,
    type: 'xtream',
    server_url: data.server_url,
    username: data.username,
    password: data.password,
    user_agent: data.user_agent || 'VLC/3.0.20',
    epg_time_offset_min: 0,
    created_at: new Date().toISOString(),
    account_status: 'Active',
    max_connections: 2,
    active_connections: 1,
  };
  providers.push(newProvider);
  setStored('providers', providers);
  return newProvider;
}

export async function addM3uProvider(data: AddProviderM3U): Promise<Provider> {
  if (isTauri()) {
    return invoke<Provider>('add_m3u_provider', {
      name: data.name,
      m3uUrl: data.m3u_url,
      m3uLocalPath: data.m3u_local_path,
      userAgent: data.user_agent,
      epgUrl: data.epg_url,
    });
  }
  const providers = getStored<Provider[]>('providers', initialDemoProviders);
  const newProvider: Provider = {
    id: Date.now(),
    name: data.name,
    type: 'm3u',
    m3u_url: data.m3u_url,
    m3u_local_path: data.m3u_local_path,
    user_agent: data.user_agent || 'VLC/3.0.20',
    epg_url: data.epg_url,
    epg_time_offset_min: 0,
    created_at: new Date().toISOString(),
  };
  providers.push(newProvider);
  setStored('providers', providers);
  return newProvider;
}

export async function deleteProvider(id: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('delete_provider', { providerId: id });
  }
  const providers = getStored<Provider[]>('providers', initialDemoProviders).filter((p) => p.id !== id);
  setStored('providers', providers);
}

export async function syncProvider(id: number): Promise<SyncResult> {
  if (isTauri()) {
    return invoke<SyncResult>('sync_provider', { providerId: id });
  }
  return {
    categories_count: initialDemoCategories.length,
    channels_count: initialDemoChannels.length,
  };
}

export async function getCategories(providerId: number, contentType: string = 'all'): Promise<Category[]> {
  if (isTauri()) {
    return invoke<Category[]>('get_categories', { providerId, contentType });
  }
  const cats = getStored<Category[]>('categories', initialDemoCategories);
  if (contentType === 'all' || !contentType) return cats;
  return cats.filter((c) => c.type === contentType);
}

export async function deleteCategory(categoryId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('delete_category', { categoryId });
  }
  const cats = getStored<Category[]>('categories', initialDemoCategories).filter(
    (c) => c.id !== categoryId
  );
  setStored('categories', cats);
}

export async function reorderCategories(
  providerId: number,
  categoryIds: number[]
): Promise<void> {
  if (isTauri()) {
    return invoke<void>('reorder_categories', { providerId, categoryIds });
  }
}

export async function keepOnlySwedenCategories(providerId: number): Promise<number> {
  if (isTauri()) {
    return invoke<number>('keep_only_sweden_categories', { providerId });
  }
  return 0;
}

export async function deleteChannel(channelId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('delete_channel', { channelId });
  }
  const channels = getStored<Channel[]>('channels', initialDemoChannels).filter(
    (c) => c.id !== channelId
  );
  setStored('channels', channels);
}

export async function reorderChannels(
  providerId: number,
  channelIds: number[]
): Promise<void> {
  if (isTauri()) {
    return invoke<void>('reorder_channels', { providerId, channelIds });
  }
}

export async function getChannels(providerId: number, categoryId?: number): Promise<Channel[]> {
  if (isTauri()) {
    return invoke<Channel[]>('get_channels', { providerId, categoryId });
  }
  const channels = getStored<Channel[]>('channels', initialDemoChannels);
  const overrides = getStored<Override[]>('overrides_' + providerId, []);
  const favorites = getStored<number[]>('favorites', []);

  return channels
    .filter((ch) => !categoryId || ch.category_id === categoryId)
    .map((ch) => {
      const channelOverrides = overrides.filter((o) => o.target_type === 'channel' && o.target_id === ch.id);
      const nameOv = channelOverrides.find((o) => o.override_key === 'name');
      const hiddenOv = channelOverrides.find((o) => o.override_key === 'hidden');
      const tvgOv = channelOverrides.find((o) => o.override_key === 'tvg_id');

      return {
        ...ch,
        display_name: nameOv ? nameOv.override_value : ch.name,
        is_hidden: hiddenOv?.override_value === 'true',
        is_favorite: favorites.includes(ch.id),
        custom_tvg_id: tvgOv?.override_value || ch.tvg_id,
      };
    });
}

export async function searchChannels(providerId: number, query: string): Promise<Channel[]> {
  if (isTauri()) {
    return invoke<Channel[]>('search_channels', { providerId, query });
  }
  const all = await getChannels(providerId);
  const q = query.toLowerCase();
  return all.filter((ch) => (ch.display_name || ch.name).toLowerCase().includes(q));
}

export async function getChannelStreamUrl(channelId: number): Promise<string> {
  if (isTauri()) {
    return invoke<string>('get_channel_stream_url', { channelId });
  }
  const channels = getStored<Channel[]>('channels', initialDemoChannels);
  const ch = channels.find((c) => c.id === channelId);
  return ch ? ch.stream_url : '';
}

export async function syncEpg(providerId: number): Promise<EpgSyncResult> {
  if (isTauri()) {
    return invoke<EpgSyncResult>('sync_epg', { providerId });
  }
  return { programs_count: 24 };
}

export async function getChannelEpg(channelTvgId: string, providerId: number): Promise<EpgProgram[]> {
  if (isTauri()) {
    return invoke<EpgProgram[]>('get_channel_epg', { channelTvgId, providerId });
  }
  const now = new Date();
  const programs: EpgProgram[] = [];
  for (let i = 0; i < 6; i++) {
    const start = new Date(now.getTime() + (i - 1) * 3600000);
    const end = new Date(now.getTime() + i * 3600000);
    programs.push({
      id: i + 1,
      provider_id: providerId,
      channel_tvg_id: channelTvgId,
      title: i === 1 ? 'Live Program - Main Broadcast' : `Featured Show #${i + 1}`,
      description: 'High definition broadcast feed with live commentary and coverage.',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      category: 'Entertainment',
    });
  }
  return programs;
}

export async function getNowPlaying(channelIds: number[], providerId?: number): Promise<Record<string, EpgProgram>> {
  if (isTauri()) {
    return invoke<Record<string, EpgProgram>>('get_now_playing', { channelIds, providerId });
  }
  const now = new Date();
  const start = new Date(now.getTime() - 25 * 60000);
  const end = new Date(now.getTime() + 35 * 60000);
  const res: Record<string, EpgProgram> = {};
  res['mux.bbb'] = {
    id: 101,
    provider_id: 1,
    channel_tvg_id: 'mux.bbb',
    title: 'Big Buck Bunny Open Animation',
    description: 'Blender Institute comedy project following a large rabbit.',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    category: 'Animation',
  };
  return res;
}

// ─── EPG Sources API ───

export async function getEpgSources(providerId?: number): Promise<EpgSource[]> {
  if (isTauri()) {
    return invoke<EpgSource[]>('get_epg_sources', { providerId });
  }
  return getStored<EpgSource[]>('epg_sources', []);
}

export async function addEpgSource(
  name: string,
  url: string,
  providerId?: number
): Promise<EpgSource> {
  if (isTauri()) {
    return invoke<EpgSource>('add_epg_source', { name, url, providerId });
  }
  const sources = getStored<EpgSource[]>('epg_sources', []);
  const newSource: EpgSource = {
    id: Date.now(),
    name,
    url,
    provider_id: providerId ?? null,
    last_synced_at: null,
    created_at: new Date().toISOString(),
  };
  sources.push(newSource);
  setStored('epg_sources', sources);
  return newSource;
}

export async function deleteEpgSource(sourceId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('delete_epg_source', { sourceId });
  }
  const sources = getStored<EpgSource[]>('epg_sources', []).filter((s) => s.id !== sourceId);
  setStored('epg_sources', sources);
}

export async function syncEpgSource(sourceId: number): Promise<EpgSyncResult> {
  if (isTauri()) {
    return invoke<EpgSyncResult>('sync_epg_source', { sourceId });
  }
  return { programs_count: 50 };
}

export async function syncAllEpgSources(providerId?: number): Promise<EpgSyncResult> {
  if (isTauri()) {
    return invoke<EpgSyncResult>('sync_all_epg_sources', { providerId });
  }
  return { programs_count: 100 };
}

export async function setOverride(
  providerId: number,
  targetType: string,
  targetId: number,
  key: string,
  value: string
): Promise<void> {
  if (isTauri()) {
    return invoke<void>('set_override', { providerId, targetType, targetId, key, value });
  }
  const overrides = getStored<Override[]>('overrides_' + providerId, []);
  const existingIdx = overrides.findIndex(
    (o) => o.target_type === targetType && o.target_id === targetId && o.override_key === key
  );
  if (existingIdx >= 0) {
    overrides[existingIdx].override_value = value;
  } else {
    overrides.push({
      id: Date.now(),
      provider_id: providerId,
      target_type: targetType as 'category' | 'channel',
      target_id: targetId,
      override_key: key,
      override_value: value,
    });
  }
  setStored('overrides_' + providerId, overrides);
}

export async function removeOverride(
  providerId: number,
  targetType: string,
  targetId: number,
  key: string
): Promise<void> {
  if (isTauri()) {
    return invoke<void>('remove_override', { providerId, targetType, targetId, key });
  }
  const overrides = getStored<Override[]>('overrides_' + providerId, []).filter(
    (o) => !(o.target_type === targetType && o.target_id === targetId && o.override_key === key)
  );
  setStored('overrides_' + providerId, overrides);
}

export async function getOverrides(providerId: number): Promise<Override[]> {
  if (isTauri()) {
    return invoke<Override[]>('get_overrides', { providerId });
  }
  return getStored<Override[]>('overrides_' + providerId, []);
}

export async function createCustomGroup(name: string): Promise<CustomGroup> {
  if (isTauri()) {
    return invoke<CustomGroup>('create_custom_group', { name });
  }
  const groups = getStored<CustomGroup[]>('custom_groups', []);
  const newGroup: CustomGroup = {
    id: Date.now(),
    name,
    sort_order: groups.length,
    created_at: new Date().toISOString(),
  };
  groups.push(newGroup);
  setStored('custom_groups', groups);
  return newGroup;
}

export async function deleteCustomGroup(groupId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('delete_custom_group', { groupId });
  }
  const groups = getStored<CustomGroup[]>('custom_groups', []).filter((g) => g.id !== groupId);
  setStored('custom_groups', groups);
}

export async function getCustomGroups(): Promise<CustomGroup[]> {
  if (isTauri()) {
    return invoke<CustomGroup[]>('get_custom_groups');
  }
  return getStored<CustomGroup[]>('custom_groups', []);
}

export async function addChannelToGroup(groupId: number, channelId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('add_channel_to_group', { groupId, channelId });
  }
  const map = getStored<Record<number, number[]>>('group_channels', {});
  if (!map[groupId]) map[groupId] = [];
  if (!map[groupId].includes(channelId)) map[groupId].push(channelId);
  setStored('group_channels', map);
}

export async function removeChannelFromGroup(groupId: number, channelId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('remove_channel_from_group', { groupId, channelId });
  }
  const map = getStored<Record<number, number[]>>('group_channels', {});
  if (map[groupId]) {
    map[groupId] = map[groupId].filter((id) => id !== channelId);
    setStored('group_channels', map);
  }
}

export async function toggleFavorite(channelId: number): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>('toggle_favorite', { channelId });
  }
  const favorites = getStored<number[]>('favorites', []);
  const idx = favorites.indexOf(channelId);
  let isFav = false;
  if (idx >= 0) {
    favorites.splice(idx, 1);
    isFav = false;
  } else {
    favorites.push(channelId);
    isFav = true;
  }
  setStored('favorites', favorites);
  return isFav;
}

export async function getFavorites(): Promise<Channel[]> {
  if (isTauri()) {
    return invoke<Channel[]>('get_favorites');
  }
  const favorites = getStored<number[]>('favorites', []);
  const channels = getStored<Channel[]>('channels', initialDemoChannels);
  return channels.filter((c) => favorites.includes(c.id)).map((c) => ({ ...c, is_favorite: true }));
}

export async function reorderFavorites(channelIds: number[]): Promise<void> {
  if (isTauri()) {
    return invoke<void>('reorder_favorites', { channelIds });
  }
  setStored('favorites', channelIds);
}

export async function exportPlaylist(providerId: number): Promise<string> {
  if (isTauri()) {
    return invoke<string>('export_playlist', { providerId });
  }
  const channels = await getChannels(providerId);
  let m3u = '#EXTM3U\n';
  for (const ch of channels) {
    if (ch.is_hidden) continue;
    m3u += `#EXTINF:-1 tvg-id="${ch.tvg_id || ''}" tvg-name="${ch.display_name || ch.name}" tvg-logo="${ch.logo_url || ''}",${ch.display_name || ch.name}\n`;
    m3u += `${ch.stream_url}\n`;
  }
  return m3u;
}

export async function proxyRequest(url: string, userAgent?: string): Promise<ProxyResponse> {
  if (isTauri()) {
    return invoke<ProxyResponse>('proxy_request', { url, userAgent });
  }
  const res = await fetch(url);
  const text = await res.text();
  return {
    status: res.status,
    headers: {},
    body: text,
  };
}

// ─── Custom Playlists (Categories) API ───

export async function createCustomPlaylist(name: string): Promise<CustomPlaylist> {
  if (isTauri()) {
    return invoke<CustomPlaylist>('create_custom_playlist', { name });
  }
  const playlists = getStored<CustomPlaylist[]>('custom_playlists', []);
  const newPl: CustomPlaylist = {
    id: Date.now(),
    name,
    sort_order: playlists.length,
    created_at: new Date().toISOString(),
    category_ids: [],
  };
  playlists.push(newPl);
  setStored('custom_playlists', playlists);
  return newPl;
}

export async function deleteCustomPlaylist(playlistId: number): Promise<void> {
  if (isTauri()) {
    return invoke<void>('delete_custom_playlist', { playlistId });
  }
  const playlists = getStored<CustomPlaylist[]>('custom_playlists', []).filter((p) => p.id !== playlistId);
  setStored('custom_playlists', playlists);
}

export async function getCustomPlaylists(): Promise<CustomPlaylist[]> {
  if (isTauri()) {
    return invoke<CustomPlaylist[]>('get_custom_playlists');
  }
  return getStored<CustomPlaylist[]>('custom_playlists', [
    {
      id: 1,
      name: 'Entertainment & Movies Mix',
      sort_order: 0,
      created_at: new Date().toISOString(),
      category_ids: [1, 2],
    },
  ]);
}

export async function setCustomPlaylistCategories(
  playlistId: number,
  categoryIds: number[]
): Promise<void> {
  if (isTauri()) {
    return invoke<void>('set_custom_playlist_categories', { playlistId, categoryIds });
  }
  const playlists = getStored<CustomPlaylist[]>('custom_playlists', []);
  const pl = playlists.find((p) => p.id === playlistId);
  if (pl) {
    pl.category_ids = categoryIds;
    setStored('custom_playlists', playlists);
  }
}

export async function getChannelsByCustomPlaylist(
  playlistId: number,
  providerId: number
): Promise<Channel[]> {
  if (isTauri()) {
    return invoke<Channel[]>('get_channels_by_custom_playlist', { playlistId, providerId });
  }
  const playlists = await getCustomPlaylists();
  const pl = playlists.find((p) => p.id === playlistId);
  if (!pl || !pl.category_ids?.length) return [];
  const allChannels = await getChannels(providerId);
  return allChannels.filter((ch) => ch.category_id && pl.category_ids!.includes(ch.category_id));
}

// ─── Video Clip Saving ───

export async function saveVideoClip(filename: string, base64Data: string): Promise<string> {
  if (isTauri()) {
    return invoke<string>('save_video_clip', { filename, base64Data });
  }
  // Browser fallback: trigger instant download
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteChars = atob(cleanBase64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'clip_30s.webm';
  a.click();
  URL.revokeObjectURL(url);
  return `Downloaded: ${a.download}`;
}

// ─── EPG Auto-Matching & Maintenance API ───

export async function autoMatchEpg(
  providerId: number,
  overwriteExisting: boolean = false
): Promise<AutoMatchResult> {
  if (isTauri()) {
    return invoke<AutoMatchResult>('auto_match_epg', {
      providerId,
      overwriteExisting,
    });
  }
  // Mock for browser
  return {
    matched_count: 2,
    already_matched: 1,
    total_channels: 4,
    matches: [
      {
        channel_id: 1,
        channel_name: 'Mux Big Buck Bunny (HLS)',
        matched_epg_id: 'mux.bbb',
      },
    ],
  };
}

export async function autoMatchChannelEpg(channelId: number): Promise<string | null> {
  if (isTauri()) {
    return invoke<string | null>('auto_match_channel_epg', { channelId });
  }
  return 'mux.bbb';
}

export async function clearAutoMatchedEpg(providerId?: number): Promise<number> {
  if (isTauri()) {
    return invoke<number>('clear_auto_matched_epg', { providerId });
  }
  return 0;
}

export async function getAvailableEpgChannels(): Promise<string[]> {
  if (isTauri()) {
    return invoke<string[]>('get_available_epg_channels');
  }
  return ['mux.bbb', 'apple.bipbop', 'tos.4k', 'sintel.hd', 'espn.us', 'hbo.us', 'bbc1.uk'];
}

export async function clearEpgCache(): Promise<void> {
  if (isTauri()) {
    return invoke<void>('clear_epg_cache');
  }
}

// ─── App Settings Persistence ───

export const DEFAULT_APP_SETTINGS: AppSettings = {
  bufferStallTimeout: 2200, // 2.2 seconds watchdog auto-reload
  defaultUserAgent: 'VLC/3.0.20',
  defaultViewMode: 'list',
  startupPage: 'channels',
  streamFormat: 'auto',
  epgTimeOffsetHours: 0,
  enableClipBuffer: false,
};

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('iptv_player_settings');
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem('iptv_player_settings', JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// ─── Window Always-on-Top Controls (Second Screening) ───

export async function setAlwaysOnTop(enabled: boolean): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>('set_always_on_top', { enabled });
  }
  return enabled;
}

export async function isAlwaysOnTop(): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>('is_always_on_top');
  }
  return false;
}

