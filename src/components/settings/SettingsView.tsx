import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Server,
  Calendar,
  SlidersHorizontal,
  PlaySquare,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Tag,
  Unlink,
  Loader2,
  Tv,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  ShieldCheck,
  Monitor,
} from 'lucide-react';
import { useProviderStore } from '../../stores/providerStore';
import { useChannelStore } from '../../stores/channelStore';
import { useEpgStore } from '../../stores/epgStore';
import { useEditorStore } from '../../stores/editorStore';
import { AddProviderModal } from '../providers/AddProviderModal';
import { PlaylistEditor } from '../editor/PlaylistEditor';
import { cn } from '../../lib/utils';
import type { AppSettings, AutoMatchResult, Channel, EpgSource } from '../../types';
import * as api from '../../lib/api';

type SettingsTab = 'providers' | 'epg' | 'remapper' | 'editor' | 'player' | 'general';

export const SettingsView: React.FC = () => {
  const {
    providers,
    selectedProvider,
    selectProvider,
    syncProvider,
    deleteProvider,
    isSyncingId,
  } = useProviderStore();

  const {
    channels,
    fetchChannels,
    setViewMode,
    setPage,
  } = useChannelStore();

  const {
    epgSources,
    fetchEpgSources,
    addEpgSource,
    deleteEpgSource,
    syncEpgSource,
    syncAllSources,
    isSyncing: isEpgSyncing,
    timeOffsetMinutes,
    setTimeOffsetMinutes,
  } = useEpgStore();

  const { setOverride, removeOverride } = useEditorStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('epg');
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);

  // App Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>(api.getAppSettings());

  // EPG Sources Add Modal / Form
  const [newEpgName, setNewEpgName] = useState('');
  const [newEpgUrl, setNewEpgUrl] = useState('');
  const [isAddingEpg, setIsAddingEpg] = useState(false);

  // Auto-Match Provider State
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<AutoMatchResult | null>(null);
  const [statusNotification, setStatusNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Remapper state
  const [remapperSearch, setRemapperSearch] = useState('');
  const [remapperFilter, setRemapperFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [availableEpgIds, setAvailableEpgIds] = useState<string[]>([]);
  const [channelMatchingIds, setChannelMatchingIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchEpgSources();
    api.getAvailableEpgChannels().then(setAvailableEpgIds).catch(console.error);
  }, [fetchEpgSources]);

  useEffect(() => {
    if (selectedProvider) {
      fetchChannels(selectedProvider.id);
    }
  }, [selectedProvider, fetchChannels]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusNotification({ type, text });
    setTimeout(() => {
      setStatusNotification(null);
    }, 4500);
  };

  const handleUpdateSettings = (updates: Partial<AppSettings>) => {
    const next = { ...appSettings, ...updates };
    setAppSettings(next);
    api.saveAppSettings(next);
    if (updates.defaultViewMode) {
      setViewMode(updates.defaultViewMode);
    }
    showNotification('Settings saved successfully');
  };

  // Add EPG Source
  const handleAddEpgSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEpgName.trim() || !newEpgUrl.trim()) return;
    setIsAddingEpg(true);
    try {
      await addEpgSource(newEpgName.trim(), newEpgUrl.trim(), selectedProvider?.id);
      setNewEpgName('');
      setNewEpgUrl('');
      showNotification('EPG Source added successfully');
      await api.getAvailableEpgChannels().then(setAvailableEpgIds);
    } catch (err) {
      showNotification(`Failed to add EPG Source: ${err}`, 'error');
    } finally {
      setIsAddingEpg(false);
    }
  };

  // Auto-Match All Channels in Provider
  const handleAutoMatchProvider = async () => {
    if (!selectedProvider) {
      showNotification('Please select a provider first', 'error');
      return;
    }
    setIsAutoMatching(true);
    setMatchResult(null);
    try {
      const res = await api.autoMatchEpg(selectedProvider.id, overwriteExisting);
      setMatchResult(res);
      await fetchChannels(selectedProvider.id);
      showNotification(
        `Auto-match complete: ${res.matched_count} channels matched with high-precision EPG!`,
        'success'
      );
    } catch (err) {
      showNotification(`Auto-matching failed: ${err}`, 'error');
    } finally {
      setIsAutoMatching(false);
    }
  };

  // Clear Auto-Matched EPG Overrides
  const handleClearAutoMatches = async () => {
    if (!selectedProvider) {
      showNotification('Please select a provider first', 'error');
      return;
    }
    if (
      !window.confirm(
        'Reset all auto-matched EPG assignments for this provider? This removes fuzzy/auto overrides and reverts channels to their original playlist guide IDs.'
      )
    ) {
      return;
    }
    setIsAutoMatching(true);
    try {
      const removed = await api.clearAutoMatchedEpg(selectedProvider.id);
      await fetchChannels(selectedProvider.id);
      setMatchResult(null);
      showNotification(`Reset complete: removed ${removed} auto-matched EPG overrides.`, 'success');
    } catch (err) {
      showNotification(`Failed to reset EPG overrides: ${err}`, 'error');
    } finally {
      setIsAutoMatching(false);
    }
  };

  // Clear EPG Cache
  const handleClearEpgCache = async () => {
    if (
      !window.confirm(
        'Clear all cached EPG programs? You will need to re-sync EPG sources to display guide information.'
      )
    ) {
      return;
    }
    try {
      await api.clearEpgCache();
      showNotification('EPG guide cache cleared successfully');
      setAvailableEpgIds([]);
    } catch (err) {
      showNotification(`Failed to clear cache: ${err}`, 'error');
    }
  };

  // Remapper: Auto match single channel
  const handleRemapperSingleMatch = async (ch: Channel) => {
    setChannelMatchingIds((prev) => ({ ...prev, [ch.id]: true }));
    try {
      const matched = await api.autoMatchChannelEpg(ch.id);
      if (matched) {
        showNotification(`Matched "${ch.name}" to "${matched}"`);
        if (selectedProvider) await fetchChannels(selectedProvider.id);
      } else {
        showNotification(`No confident match found for "${ch.name}"`, 'error');
      }
    } catch (err) {
      showNotification(`Auto-match error: ${err}`, 'error');
    } finally {
      setChannelMatchingIds((prev) => ({ ...prev, [ch.id]: false }));
    }
  };

  // Remapper: Manual change
  const handleRemapperChangeTvg = async (ch: Channel, newTvg: string) => {
    if (!selectedProvider) return;
    try {
      if (newTvg.trim()) {
        await setOverride(selectedProvider.id, 'channel', ch.id, 'tvg_id', newTvg.trim());
      } else {
        await removeOverride(selectedProvider.id, 'channel', ch.id, 'tvg_id');
      }
      await fetchChannels(selectedProvider.id);
      showNotification(`EPG mapping updated for "${ch.name}"`);
    } catch (err) {
      showNotification(`Failed to update EPG mapping: ${err}`, 'error');
    }
  };

  // Filtered channels for remapper
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      const isMapped = Boolean(ch.custom_tvg_id || ch.tvg_id);
      if (remapperFilter === 'mapped' && !isMapped) return false;
      if (remapperFilter === 'unmapped' && isMapped) return false;

      if (!remapperSearch.trim()) return true;
      const q = remapperSearch.toLowerCase();
      return (
        ch.name.toLowerCase().includes(q) ||
        (ch.display_name && ch.display_name.toLowerCase().includes(q)) ||
        (ch.custom_tvg_id && ch.custom_tvg_id.toLowerCase().includes(q)) ||
        (ch.tvg_id && ch.tvg_id.toLowerCase().includes(q))
      );
    });
  }, [channels, remapperFilter, remapperSearch]);

  const mappedCount = useMemo(() => {
    return channels.filter((c) => c.custom_tvg_id || c.tvg_id).length;
  }, [channels]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-900/60 backdrop-blur-md">
      {/* Settings Header */}
      <div className="p-8 pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">App Settings & EPG</h1>
              <p className="text-xs text-white/50">
                Configure providers, TV guide auto-assignment, player watchdog & playback behavior
              </p>
            </div>
          </div>
        </div>

        {/* Global Toast */}
        {statusNotification && (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all animate-fade-in',
              statusNotification.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            )}
          >
            {statusNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            {statusNotification.text}
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 px-8 py-3 border-b border-white/5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('epg')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
            activeTab === 'epg'
              ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <Calendar className="w-4 h-4" />
          EPG Guide & Auto-Assign
        </button>

        <button
          onClick={() => setActiveTab('remapper')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
            activeTab === 'remapper'
              ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Channel EPG Remapper
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 text-white">
            {mappedCount}/{channels.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('providers')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
            activeTab === 'providers'
              ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <Server className="w-4 h-4" />
          Providers & Accounts
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 text-white">
            {providers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
            activeTab === 'editor'
              ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Playlist & Categories
        </button>

        <button
          onClick={() => setActiveTab('player')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
            activeTab === 'player'
              ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <PlaySquare className="w-4 h-4" />
          Player & Watchdog
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
            activeTab === 'general'
              ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          General & Startup
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        {/* ─── TAB 1: EPG Guide & Auto-Assign ─── */}
        {activeTab === 'epg' && (
          <div className="max-w-5xl space-y-8 animate-fade-in">
            {/* Auto-Assign EPG Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-accent-500/10 via-white/5 to-white/5 border border-accent-500/30 backdrop-blur-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-accent-500/20 text-accent-300 text-xs font-bold uppercase tracking-wider">
                      Smart Matcher
                    </span>
                    <h2 className="text-lg font-bold text-white">
                      Automatic EPG Guide Auto-Assign
                    </h2>
                  </div>
                  <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
                    Automatically scans all channels in your active provider (
                    <span className="text-white font-semibold">
                      {selectedProvider?.name || 'No provider selected'}
                    </span>
                    ), strips country prefixes, quality tags (FHD, 4K, 1080p, HEVC), and matches them
                    with the most accurate electronic guide ID.
                  </p>
                  <label className="flex items-center gap-2 mt-4 cursor-pointer text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-accent-500 focus:ring-accent-500"
                    />
                    <span>Overwrite channels that already have an assigned EPG mapping</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleClearAutoMatches}
                    disabled={isAutoMatching || !selectedProvider}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 border border-white/10 disabled:opacity-50 text-white/70 font-semibold text-xs rounded-xl transition-all"
                    title="Reset all auto-matched EPG assignments"
                  >
                    <Unlink className="w-4 h-4" />
                    Reset Matches
                  </button>

                  <button
                    onClick={handleAutoMatchProvider}
                    disabled={isAutoMatching || !selectedProvider}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/25 transition-all"
                  >
                    {isAutoMatching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Matching Channels...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Run Auto-Assign EPG
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Match Result Stats Box */}
              {matchResult && (
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[11px] text-white/40 block">Total Channels</span>
                    <span className="text-lg font-bold text-white">
                      {matchResult.total_channels}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[11px] text-emerald-300/70 block">Newly Matched</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {matchResult.matched_count}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[11px] text-white/40 block">Already Assigned</span>
                    <span className="text-lg font-bold text-white/80">
                      {matchResult.already_matched}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[11px] text-white/40 block">EPG Channels In DB</span>
                    <span className="text-lg font-bold text-accent-400">
                      {availableEpgIds.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* EPG Sources Management */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">External XMLTV EPG Sources</h3>
                  <p className="text-xs text-white/50">
                    Add custom XMLTV guide URLs (.xml, .xml.gz) to populate program schedules
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => syncAllSources()}
                    disabled={isEpgSyncing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isEpgSyncing && 'animate-spin')} />
                    Sync All Sources
                  </button>
                  <button
                    onClick={handleClearEpgCache}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-xs font-semibold border border-red-500/20 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Cache
                  </button>
                </div>
              </div>

              {/* Add Source Form */}
              <form onSubmit={handleAddEpgSource} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4">
                  <input
                    type="text"
                    placeholder="Source Name (e.g. US/UK Guide)"
                    value={newEpgName}
                    onChange={(e) => setNewEpgName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-6">
                  <input
                    type="url"
                    placeholder="XMLTV URL (e.g. https://iptv-org.github.io/epg/guides/us/tvguide.com.epg.xml.gz)"
                    value={newEpgUrl}
                    onChange={(e) => setNewEpgUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isAddingEpg}
                    className="w-full h-full min-h-[38px] flex items-center justify-center gap-1.5 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Source
                  </button>
                </div>
              </form>

              {/* Sources Table */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                {epgSources.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40">
                    No custom EPG sources added yet. Enter a URL above to load guide data.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {epgSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate">{source.name}</h4>
                          <span className="text-[11px] text-white/40 block truncate">
                            {source.url}
                          </span>
                          <span className="text-[10px] text-white/30 block mt-0.5">
                            Last synced:{' '}
                            {source.last_synced_at
                              ? new Date(source.last_synced_at).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => syncEpgSource(source.id)}
                            disabled={isEpgSyncing}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/80 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Sync
                          </button>
                          <button
                            onClick={() => deleteEpgSource(source.id)}
                            className="p-1.5 text-white/30 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Source"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Time Offset Setting */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">EPG Time Offset</h3>
                <p className="text-xs text-white/50">
                  Adjust schedule timeline timezone if guide programs display hours ahead or behind
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={Math.round(timeOffsetMinutes / 60)}
                  onChange={(e) => setTimeOffsetMinutes(parseInt(e.target.value, 10) * 60)}
                  className="px-4 py-2 bg-surface-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-accent-500 transition-all"
                >
                  {Array.from({ length: 25 }, (_, i) => i - 12).map((offset) => (
                    <option key={offset} value={offset}>
                      {offset === 0 ? 'UTC (0h)' : offset > 0 ? `+${offset} hours` : `${offset} hours`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: Channel EPG Remapper ─── */}
        {activeTab === 'remapper' && (
          <div className="max-w-6xl space-y-6 animate-fade-in">
            {/* Remapper Toolbar */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search channels by name or assigned TVG-ID..."
                    value={remapperSearch}
                    onChange={(e) => setRemapperSearch(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                  {(['all', 'mapped', 'unmapped'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setRemapperFilter(filter)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all',
                        remapperFilter === filter
                          ? 'bg-accent-500 text-white'
                          : 'text-white/60 hover:text-white'
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-white/50">
                Showing <span className="text-white font-semibold">{filteredChannels.length}</span>{' '}
                of {channels.length} channels
              </div>
            </div>

            {/* Channels Remapper Table */}
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-white/80">
                  <thead className="bg-white/5 text-white/40 uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Assigned EPG ID</th>
                      <th className="py-3 px-4">Match Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredChannels.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-white/40 text-xs">
                          No matching channels found.
                        </td>
                      </tr>
                    ) : (
                      filteredChannels.slice(0, 100).map((ch) => {
                        const effectiveTvg = ch.custom_tvg_id || ch.tvg_id;
                        const isMatching = channelMatchingIds[ch.id];

                        return (
                          <tr key={ch.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {ch.logo_url ? (
                                    <img
                                      src={ch.logo_url}
                                      alt=""
                                      className="w-full h-full object-contain p-0.5"
                                    />
                                  ) : (
                                    <Tv className="w-4 h-4 text-white/30" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-white block truncate">
                                    {ch.display_name || ch.name}
                                  </span>
                                  {ch.display_name && ch.display_name !== ch.name && (
                                    <span className="text-[10px] text-white/30 block truncate">
                                      Orig: {ch.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="relative max-w-xs">
                                <input
                                  type="text"
                                  list={`remapper-list-${ch.id}`}
                                  defaultValue={effectiveTvg || ''}
                                  placeholder="Select or enter EPG ID..."
                                  onBlur={(e) => {
                                    if (e.target.value !== (effectiveTvg || '')) {
                                      handleRemapperChangeTvg(ch, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/20 focus:outline-none focus:border-accent-500"
                                />
                                <datalist id={`remapper-list-${ch.id}`}>
                                  {availableEpgIds.map((id) => (
                                    <option key={id} value={id} />
                                  ))}
                                </datalist>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {effectiveTvg ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <Check className="w-2.5 h-2.5" />
                                  Mapped
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleRemapperSingleMatch(ch)}
                                  disabled={isMatching}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 text-xs font-medium border border-accent-500/30 transition-all disabled:opacity-50"
                                  title="Auto-detect best EPG ID match"
                                >
                                  {isMatching ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3 text-accent-400" />
                                  )}
                                  Auto-Match
                                </button>
                                {effectiveTvg && (
                                  <button
                                    onClick={() => handleRemapperChangeTvg(ch, '')}
                                    className="p-1 text-white/30 hover:text-red-400 rounded-lg transition-colors"
                                    title="Unlink EPG"
                                  >
                                    <Unlink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {filteredChannels.length > 100 && (
                <div className="p-3 bg-white/5 border-t border-white/10 text-center text-[11px] text-white/40">
                  Showing top 100 results. Use the search box above to narrow down specific channels.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: Providers & Accounts ─── */}
        {activeTab === 'providers' && (
          <div className="max-w-5xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Configured IPTV Providers</h2>
                <p className="text-xs text-white/50">
                  Manage multiple subscriptions, server credentials and synchronizations
                </p>
              </div>
              <button
                onClick={() => setIsAddProviderOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add New Provider
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((p) => {
                const isSelected = selectedProvider?.id === p.id;
                const isSyncing = isSyncingId === p.id;

                return (
                  <div
                    key={p.id}
                    className={cn(
                      'p-6 rounded-2xl border transition-all flex flex-col justify-between',
                      isSelected
                        ? 'bg-accent-500/10 border-accent-500/50 shadow-xl shadow-accent-500/10'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                              p.type === 'xtream'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            )}
                          >
                            {p.type}
                          </span>
                          <h3 className="text-base font-bold text-white">{p.name}</h3>
                        </div>
                        {isSelected && (
                          <span className="text-[11px] font-semibold text-accent-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-white/50 mb-6">
                        {p.server_url && (
                          <div className="truncate">
                            <span className="text-white/30">Server:</span> {p.server_url}
                          </div>
                        )}
                        {p.username && (
                          <div>
                            <span className="text-white/30">Username:</span> {p.username}
                          </div>
                        )}
                        {p.account_status && (
                          <div>
                            <span className="text-white/30">Status:</span>{' '}
                            <span className="text-emerald-400 font-semibold">{p.account_status}</span>
                          </div>
                        )}
                        {p.account_expiry && (
                          <div>
                            <span className="text-white/30">Expires:</span> {p.account_expiry}
                          </div>
                        )}
                        <div>
                          <span className="text-white/30">Last synced:</span>{' '}
                          {p.last_synced_at
                            ? new Date(p.last_synced_at).toLocaleString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        {!isSelected && (
                          <button
                            onClick={() => selectProvider(p)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => syncProvider(p.id)}
                          disabled={isSyncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
                          Sync
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          if (window.confirm(`Delete provider "${p.name}"?`)) {
                            deleteProvider(p.id);
                          }
                        }}
                        className="p-2 text-white/30 hover:text-red-400 rounded-lg transition-colors"
                        title="Delete Provider"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB: Playlist & Category Editor ─── */}
        {activeTab === 'editor' && (
          <div className="h-[calc(100vh-180px)] -m-8 flex flex-col overflow-hidden animate-fade-in">
            <PlaylistEditor embedded />
          </div>
        )}

        {/* ─── TAB 4: Player & Watchdog ─── */}
        {activeTab === 'player' && (
          <div className="max-w-4xl space-y-6 animate-fade-in">
            {/* Stream Buffer Stall Auto-Reload */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Buffer Stall Auto-Reload Watchdog
                  </h3>
                  <p className="text-xs text-white/50 mt-1 max-w-xl leading-relaxed">
                    Automatically re-establishes socket and stream connections when live television
                    starts buffering or stalling. Designed to fix unresponsive stream feeds seamlessly.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 shrink-0">
                  <PlaySquare className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[
                  { label: 'Disabled', value: 0 },
                  { label: '2.2s (Recommended)', value: 2200 },
                  { label: '3.5s (Relaxed)', value: 3500 },
                  { label: '5.0s (High Latency)', value: 5000 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdateSettings({ bufferStallTimeout: opt.value })}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      appSettings.bufferStallTimeout === opt.value
                        ? 'bg-accent-500/20 border-accent-500 text-white font-semibold shadow-lg shadow-accent-500/10'
                        : 'bg-black/20 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span className="text-xs block">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Default User Agent */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Default HTTP Stream User-Agent</h3>
                <p className="text-xs text-white/50 mt-1">
                  Custom client header sent when requesting HLS / MPEG-TS streams from providers
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {['VLC/3.0.20', 'TiviMate/4.7.0', 'AppleCoreMedia/1.0.0', 'IPTVSmarters/1.0.0'].map(
                  (ua) => (
                    <button
                      key={ua}
                      onClick={() => handleUpdateSettings({ defaultUserAgent: ua })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs transition-all',
                        appSettings.defaultUserAgent === ua
                          ? 'bg-accent-500/20 border-accent-500 text-accent-300 font-semibold'
                          : 'bg-black/20 border-white/5 text-white/60 hover:text-white'
                      )}
                    >
                      {ua}
                    </button>
                  )
                )}
              </div>

              <input
                type="text"
                value={appSettings.defaultUserAgent}
                onChange={(e) => handleUpdateSettings({ defaultUserAgent: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/20 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-accent-500 transition-all"
                placeholder="Custom User-Agent string..."
              />
            </div>

            {/* Preferred Stream Format */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Stream Container Preference</h3>
                <p className="text-xs text-white/50 mt-1">
                  Select container preference when both HLS (.m3u8) and MPEG-TS are supplied
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'auto', label: 'Auto (Recommended)' },
                  { id: 'm3u8', label: 'HLS (.m3u8)' },
                  { id: 'ts', label: 'MPEG-TS (.ts)' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() =>
                      handleUpdateSettings({
                        streamFormat: fmt.id as AppSettings['streamFormat'],
                      })
                    }
                    className={cn(
                      'p-3 rounded-xl border text-center transition-all',
                      appSettings.streamFormat === fmt.id
                        ? 'bg-accent-500/20 border-accent-500 text-white font-semibold'
                        : 'bg-black/20 border-white/5 text-white/60 hover:text-white'
                    )}
                  >
                    <span className="text-xs block">{fmt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 30s Video Clipping Buffer Toggle */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Background DVR Buffer (Instant 30s Clips)</h3>
                <p className="text-xs text-white/50 mt-1 max-w-xl leading-relaxed">
                  Continuously buffers video in memory for instant clipping with the scissors icon.
                  Keep turned off (recommended) for minimal CPU usage and butter-smooth playback when running on a second screen or out of focus.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!!appSettings.enableClipBuffer}
                  onChange={(e) => handleUpdateSettings({ enableClipBuffer: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-500"></div>
              </label>
            </div>
          </div>
        )}

        {/* ─── TAB 5: General & Startup ─── */}
        {activeTab === 'general' && (
          <div className="max-w-4xl space-y-6 animate-fade-in">
            {/* Startup Page Selection */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Default Startup Page</h3>
                <p className="text-xs text-white/50 mt-1">
                  Choose which screen automatically opens when starting IPTV Player
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'channels', label: 'Live TV (Channels)' },
                  { id: 'epg', label: 'TV Guide (EPG Timeline)' },
                  { id: 'providers', label: 'Providers Management' },
                ].map((pg) => (
                  <button
                    key={pg.id}
                    onClick={() =>
                      handleUpdateSettings({
                        startupPage: pg.id as AppSettings['startupPage'],
                      })
                    }
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      appSettings.startupPage === pg.id
                        ? 'bg-accent-500/20 border-accent-500 text-white font-semibold'
                        : 'bg-black/20 border-white/5 text-white/60 hover:text-white'
                    )}
                  >
                    <span className="text-xs font-semibold block">{pg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Default View Mode */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Channel Display Mode</h3>
                <p className="text-xs text-white/50 mt-1">
                  Choose whether channels are displayed in compact list view or cards grid
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'list', label: 'Compact List View (Standard)' },
                  { id: 'grid', label: 'Visual Cards Grid' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() =>
                      handleUpdateSettings({
                        defaultViewMode: mode.id as AppSettings['defaultViewMode'],
                      })
                    }
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      appSettings.defaultViewMode === mode.id
                        ? 'bg-accent-500/20 border-accent-500 text-white font-semibold'
                        : 'bg-black/20 border-white/5 text-white/60 hover:text-white'
                    )}
                  >
                    <span className="text-xs font-semibold block">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Links to Playlist Editor */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Playlist & Category Editor</h3>
                <p className="text-xs text-white/50 mt-1">
                  Organize categories, reorder channels, or create custom mixed playlists
                </p>
              </div>
              <button
                onClick={() => setPage('editor')}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
              >
                Open Editor
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      <AddProviderModal
        isOpen={isAddProviderOpen}
        onClose={() => setIsAddProviderOpen(false)}
      />
    </div>
  );
};
