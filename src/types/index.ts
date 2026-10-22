// ─── Provider Types ───
export type ProviderType = "xtream" | "m3u";

export interface Provider {
  id: number;
  name: string;
  type: ProviderType;
  server_url?: string;
  username?: string;
  password?: string;
  m3u_url?: string;
  m3u_local_path?: string;
  user_agent: string;
  epg_url?: string;
  epg_time_offset_min: number;
  account_status?: string;
  account_expiry?: string;
  max_connections?: number;
  active_connections?: number;
  last_synced_at?: string;
  created_at: string;
}

export interface AddProviderXtream {
  name: string;
  server_url: string;
  username: string;
  password: string;
  user_agent?: string;
}

export interface AddProviderM3U {
  name: string;
  m3u_url?: string;
  m3u_local_path?: string;
  user_agent?: string;
  epg_url?: string;
}

// ─── Category Types ───
export interface Category {
  id: number;
  provider_id: number;
  remote_id?: string;
  name: string;
  type: "live" | "vod" | "series";
  sort_order: number;
  channel_count?: number;
  is_hidden?: boolean;
}

// ─── Channel Types ───
export interface Channel {
  id: number;
  provider_id: number;
  category_id?: number;
  remote_id?: string;
  tvg_id?: string;
  name: string;
  logo_url?: string;
  stream_url: string;
  stream_type: string;
  container_extension?: string;
  sort_order: number;
  // Applied overrides
  display_name?: string;
  is_hidden?: boolean;
  is_favorite?: boolean;
  custom_tvg_id?: string;
  // EPG data (joined)
  now_playing?: EpgProgram;
  up_next?: EpgProgram;
}

// ─── EPG Types ───
export interface EpgProgram {
  id: number;
  provider_id: number;
  channel_tvg_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category?: string;
  progress?: number; // 0-100 computed on frontend
}

export interface EpgSource {
  id: number;
  name: string;
  url: string;
  provider_id?: number | null;
  last_synced_at?: string | null;
  created_at: string;
}

// ─── Override Types ───
export type OverrideTargetType = "category" | "channel";

export interface Override {
  id: number;
  provider_id: number;
  target_type: OverrideTargetType;
  target_id: number;
  override_key: string;
  override_value?: string;
}

// Override keys
export type OverrideKey =
  | "hidden"       // "true" / "false"
  | "name"         // custom display name
  | "sort_order"   // custom sort position
  | "tvg_id"       // custom EPG mapping
  | "logo_url";    // custom logo

// ─── Custom Group Types ───
export interface CustomGroup {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
  channels?: Channel[];
}

// ─── Custom Playlist Types (Consisting of Categories) ───
export interface CustomPlaylist {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
  category_ids?: number[];
  categories?: Category[];
}

// ─── Favorite Types ───
export interface Favorite {
  id: number;
  channel_id: number;
  sort_order: number;
}

// ─── Xtream Account Info ───
export interface XtreamAccountInfo {
  username: string;
  password: string;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
}

// ─── App State ───
export type ViewMode = "grid" | "list";
export type ContentType = "live" | "vod" | "series";
export type AppPage = "providers" | "channels" | "player" | "epg" | "editor" | "settings";

export interface PlayerState {
  isPlaying: boolean;
  currentChannel: Channel | null;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  error: string | null;
}

// ─── IPC Command Payloads ───
export interface SyncResult {
  categories_count: number;
  channels_count: number;
}

export interface EpgSyncResult {
  programs_count: number;
}

export interface ChannelMatchInfo {
  channel_id: number;
  channel_name: string;
  original_tvg_id?: string;
  matched_epg_id: string;
}

export interface AutoMatchResult {
  matched_count: number;
  already_matched: number;
  total_channels: number;
  matches: ChannelMatchInfo[];
}

export interface AppSettings {
  bufferStallTimeout: number; // ms, 0 = disabled
  defaultUserAgent: string;
  defaultViewMode: ViewMode;
  startupPage: "channels" | "epg" | "providers";
  streamFormat: "auto" | "m3u8" | "ts";
  epgTimeOffsetHours: number;
  enableClipBuffer?: boolean;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}
