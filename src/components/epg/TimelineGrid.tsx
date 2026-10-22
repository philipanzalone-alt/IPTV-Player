import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Tv,
  Play,
  X,
  Database,
  Search,
  Filter,
} from 'lucide-react';
import { useProviderStore } from '../../stores/providerStore';
import { useEpgStore } from '../../stores/epgStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useChannelStore } from '../../stores/channelStore';
import { useChannels } from '../../hooks/useChannels';
import { EpgSourcesModal } from './EpgSourcesModal';
import type { Channel, EpgProgram } from '../../types';
import { formatTime, formatTimeRange, cn } from '../../lib/utils';

const PIXELS_PER_MINUTE = 4; // 240px per hour, 120px per 30 minutes
const TOTAL_HOURS = 24;
const CHANNEL_COL_WIDTH = 240;

// Helper to sort and sanitize EPG programs to guarantee no overlapping blocks
function sanitizeChannelPrograms(programs: EpgProgram[]): EpgProgram[] {
  if (!programs || programs.length === 0) return [];

  // Sort by start_time ascending
  const sorted = [...programs]
    .filter((p) => p && p.start_time && p.end_time)
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

  const sanitized: EpgProgram[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = { ...sorted[i] };
    const curStart = new Date(cur.start_time).getTime();
    let curEnd = new Date(cur.end_time).getTime();

    if (isNaN(curStart) || isNaN(curEnd) || curEnd <= curStart) {
      continue;
    }

    // Check against next program to eliminate overlap
    if (i + 1 < sorted.length) {
      const nextStart = new Date(sorted[i + 1].start_time).getTime();
      if (!isNaN(nextStart) && nextStart < curEnd) {
        if (nextStart <= curStart) {
          // Duplicate start time: skip duplicate
          continue;
        }
        curEnd = nextStart;
        cur.end_time = new Date(curEnd).toISOString();
      }
    }

    sanitized.push(cur);
  }

  return sanitized;
}

export const TimelineGrid: React.FC = () => {
  const { selectedProvider } = useProviderStore();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'all'>('all');
  const [channelSearch, setChannelSearch] = useState('');

  // Load channels specifically for the active category filter (or all categories)
  const { channels, isLoading: isLoadingChannels } = useChannels({
    categoryId: selectedCategoryFilter,
  });

  const { categories, fetchCategories } = useChannelStore();
  const {
    epgByTvgId,
    isSyncing,
    lastSyncedAt,
    timeOffsetMinutes,
    syncProviderEpg,
    fetchEpgForChannel,
    refetchEpgForChannel,
    setTimeOffsetMinutes,
  } = useEpgStore();
  const { playChannel } = usePlayerStore();

  const [selectedProgram, setSelectedProgram] = useState<{
    program: EpgProgram;
    channel: Channel;
  } | null>(null);

  const [isEpgSourcesOpen, setIsEpgSourcesOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedProvider) {
      fetchCategories(selectedProvider.id);
    }
  }, [selectedProvider, fetchCategories]);

  // Timeline base time: beginning of current hour - 2 hours
  const baseTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - 2);
    return d.getTime() + timeOffsetMinutes * 60 * 1000;
  }, [timeOffsetMinutes]);

  // Generate 30-minute intervals
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    for (let i = 0; i < TOTAL_HOURS * 2; i++) {
      slots.push(new Date(baseTime + i * 30 * 60 * 1000));
    }
    return slots;
  }, [baseTime]);

  // Filter channels by search text
  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    const q = channelSearch.toLowerCase();
    return channels.filter((ch) => {
      const name = (ch.display_name || ch.name).toLowerCase();
      const tvg = (ch.custom_tvg_id || ch.tvg_id || '').toLowerCase();
      return name.includes(q) || tvg.includes(q);
    });
  }, [channels, channelSearch]);

  // Fetch EPG for channels that have tvg_id
  useEffect(() => {
    if (!selectedProvider || filteredChannels.length === 0) return;
    const tvgIds = filteredChannels
      .map((c) => c.custom_tvg_id || c.tvg_id)
      .filter((id): id is string => Boolean(id));

    const uniqueIds = Array.from(new Set(tvgIds));
    uniqueIds.forEach((tvgId) => {
      fetchEpgForChannel(tvgId, selectedProvider.id);
    });
  }, [selectedProvider, filteredChannels, fetchEpgForChannel]);

  // When auto-sync completes, refresh visible channels with fresh EPG programs
  useEffect(() => {
    if (!lastSyncedAt || !selectedProvider || filteredChannels.length === 0) return;
    const tvgIds = filteredChannels
      .map((c) => c.custom_tvg_id || c.tvg_id)
      .filter((id): id is string => Boolean(id));

    const uniqueIds = Array.from(new Set(tvgIds));
    uniqueIds.forEach((tvgId) => {
      refetchEpgForChannel(tvgId, selectedProvider.id);
    });
  }, [lastSyncedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current time position indicator
  const [nowPosition, setNowPosition] = useState<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const now = Date.now() + timeOffsetMinutes * 60 * 1000;
      const diffMinutes = (now - baseTime) / (60 * 1000);
      if (diffMinutes >= 0 && diffMinutes <= TOTAL_HOURS * 60) {
        setNowPosition(diffMinutes * PIXELS_PER_MINUTE);
      } else {
        setNowPosition(null);
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 30 * 1000);
    return () => clearInterval(interval);
  }, [baseTime, timeOffsetMinutes]);

  // Auto-scroll near current time on load
  const hasAutoScrolledRef = useRef(false);
  useEffect(() => {
    if (scrollContainerRef.current && nowPosition !== null && !hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true;
      scrollContainerRef.current.scrollLeft = Math.max(0, nowPosition - 100);
    }
  }, [nowPosition]);

  const handleSyncEpg = () => {
    if (selectedProvider) {
      syncProviderEpg(selectedProvider.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-900 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-950/60 backdrop-blur-xl gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">EPG TV Guide</h1>
            <p className="text-xs text-white/50">
              Interactive electronic programming timeline
            </p>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) =>
                setSelectedCategoryFilter(
                  e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10)
                )
              }
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="all" className="bg-surface-900">
                All Categories ({channels.length})
              </option>
              {categories
                .filter((c) => !c.is_hidden)
                .map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-surface-900">
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Channel Search */}
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Search guide..."
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
            />
          </div>

          {/* Time Offset Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <select
              value={timeOffsetMinutes}
              onChange={(e) => setTimeOffsetMinutes(parseInt(e.target.value, 10))}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="-180" className="bg-surface-900">-3 hours</option>
              <option value="-120" className="bg-surface-900">-2 hours</option>
              <option value="-60" className="bg-surface-900">-1 hour</option>
              <option value="0" className="bg-surface-900">UTC (0h)</option>
              <option value="60" className="bg-surface-900">+1 hour</option>
              <option value="120" className="bg-surface-900">+2 hours</option>
              <option value="180" className="bg-surface-900">+3 hours</option>
            </select>
          </div>

          {/* EPG Sources Manager */}
          <button
            onClick={() => setIsEpgSourcesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-semibold rounded-xl transition-all"
            title="Manage EPG XMLTV Sources"
          >
            <Database className="w-3.5 h-3.5 text-accent-400" />
            <span>EPG Sources</span>
          </button>

          {/* Sync EPG Button */}
          <button
            onClick={handleSyncEpg}
            disabled={isSyncing || !selectedProvider}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/20 transition-all"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync EPG'}
          </button>
        </div>
      </div>

      {/* Unified Timeline Grid: 100% Synchronized Vertical & Horizontal Scrolling */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative bg-surface-900/60 no-scrollbar"
      >
        <div
          className="relative inline-block min-w-full"
          style={{
            width: `${CHANNEL_COL_WIDTH + TOTAL_HOURS * 60 * PIXELS_PER_MINUTE}px`,
          }}
        >
          {/* Sticky Time Header */}
          <div className="sticky top-0 h-12 flex z-30 bg-surface-950/95 backdrop-blur-xl border-b border-white/10 shadow-md">
            {/* Top-Left Corner Cell: Sticky top AND sticky left */}
            <div
              style={{ width: `${CHANNEL_COL_WIDTH}px` }}
              className="sticky left-0 shrink-0 h-12 px-4 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-white/50 bg-surface-950 border-r border-white/10 z-40 shadow-[4px_0_12px_rgba(0,0,0,0.5)]"
            >
              <span>Channels ({filteredChannels.length})</span>
            </div>

            {/* Time interval slots */}
            <div className="flex items-center">
              {timeSlots.map((slot, idx) => (
                <div
                  key={idx}
                  style={{ width: `${30 * PIXELS_PER_MINUTE}px` }}
                  className="shrink-0 px-2 border-r border-white/10 text-xs font-mono text-white/60 flex items-center"
                >
                  {formatTime(slot)}
                </div>
              ))}
            </div>
          </div>

          {/* Current Time Red Indicator Line */}
          {nowPosition !== null && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
              style={{ left: `${CHANNEL_COL_WIDTH + nowPosition}px` }}
            >
              <div className="sticky top-12 px-1.5 py-0.5 rounded bg-live text-white font-mono text-[10px] font-bold shadow-md z-30">
                LIVE
              </div>
              <div className="w-0.5 flex-1 bg-live shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            </div>
          )}

          {/* Channel Rows */}
          <div className="divide-y divide-white/5">
            {filteredChannels.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40">
                {isLoadingChannels
                  ? 'Loading channels...'
                  : 'No channels match the active filter.'}
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const tvgId = channel.custom_tvg_id || channel.tvg_id;
                const rawPrograms = tvgId ? epgByTvgId[tvgId] || [] : [];
                const programs = sanitizeChannelPrograms(rawPrograms);

                return (
                  <div
                    key={channel.id}
                    className="flex h-16 border-b border-white/5 hover:bg-white/[0.02] group"
                  >
                    {/* Sticky Channel Column (Pins left during horizontal timeline scroll) */}
                    <div
                      onClick={() => playChannel(channel, filteredChannels)}
                      style={{ width: `${CHANNEL_COL_WIDTH}px` }}
                      className="sticky left-0 shrink-0 h-16 px-4 flex items-center gap-3 bg-surface-950/95 border-r border-white/10 z-10 cursor-pointer group-hover:bg-surface-900 transition-colors shadow-[4px_0_12px_rgba(0,0,0,0.5)]"
                      title={`Play ${channel.display_name || channel.name}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {channel.logo_url ? (
                          <img
                            src={channel.logo_url}
                            alt=""
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <Tv className="w-4 h-4 text-white/40" />
                        )}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <span className="text-xs font-semibold text-white truncate block group-hover:text-accent-400">
                          {channel.display_name || channel.name}
                        </span>
                        <span className="text-[10px] text-white/40 truncate block font-mono">
                          {channel.custom_tvg_id || channel.tvg_id || 'No EPG ID'}
                        </span>
                      </div>
                      <Play className="w-3.5 h-3.5 text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>

                    {/* Program Timeline for this Channel */}
                    <div className="relative flex-1 h-16 overflow-hidden">
                      {programs.length === 0 ? (
                        <div className="flex items-center h-full px-4 text-xs text-white/20 italic">
                          No guide information available
                        </div>
                      ) : (
                        programs.map((prog) => {
                          const startMs = new Date(prog.start_time).getTime();
                          const endMs = new Date(prog.end_time).getTime();

                          if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
                            return null;
                          }

                          const leftPx = ((startMs - baseTime) / 60000) * PIXELS_PER_MINUTE;
                          const rightPx = ((endMs - baseTime) / 60000) * PIXELS_PER_MINUTE;
                          const maxTimelinePx = TOTAL_HOURS * 60 * PIXELS_PER_MINUTE;

                          // Only render if within timeline bounds
                          if (rightPx <= 0 || leftPx >= maxTimelinePx) {
                            return null;
                          }

                          const visualLeft = Math.max(0, leftPx);
                          const visualRight = Math.min(maxTimelinePx, rightPx);
                          const visualWidth = visualRight - visualLeft;

                          if (visualWidth < 4) {
                            return null;
                          }

                          const isCurrentlyOnAir =
                            Date.now() >= startMs && Date.now() <= endMs;

                          return (
                            <div
                              key={prog.id}
                              onClick={() => setSelectedProgram({ program: prog, channel })}
                              style={{
                                left: `${visualLeft}px`,
                                width: `${Math.max(12, visualWidth - 2)}px`,
                              }}
                              className={cn(
                                'absolute top-1.5 bottom-1.5 rounded-lg px-2 py-0.5 cursor-pointer transition-all border flex flex-col justify-center min-w-0 overflow-hidden select-none',
                                isCurrentlyOnAir
                                  ? 'bg-accent-500/25 border-accent-500/50 hover:bg-accent-500/35 shadow-sm ring-1 ring-accent-500/30'
                                  : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                              )}
                              title={`${prog.title} (${formatTimeRange(prog.start_time, prog.end_time)})`}
                            >
                              <span className="text-[11px] font-bold text-white truncate block leading-tight min-w-0">
                                {prog.title}
                              </span>
                              {visualWidth >= 65 && (
                                <span className="text-[10px] text-white/50 font-mono truncate block leading-tight mt-0.5 min-w-0">
                                  {formatTimeRange(prog.start_time, prog.end_time)}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Program Details Modal */}
      {selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-lg bg-surface-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-semibold text-accent-400 uppercase tracking-wide">
                  {selectedProgram.channel.display_name || selectedProgram.channel.name}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedProgram.program.title}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-white/60 mt-1">
                  <Clock className="w-3.5 h-3.5 text-white/40" />
                  {formatTimeRange(
                    selectedProgram.program.start_time,
                    selectedProgram.program.end_time
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedProgram(null)}
                className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedProgram.program.category && (
              <div className="mb-4">
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/10 text-white/80">
                  {selectedProgram.program.category}
                </span>
              </div>
            )}

            {selectedProgram.program.description ? (
              <p className="text-xs text-white/70 leading-relaxed max-h-48 overflow-y-auto mb-6 pr-2">
                {selectedProgram.program.description}
              </p>
            ) : (
              <p className="text-xs text-white/40 italic mb-6">
                No description available for this program.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setSelectedProgram(null)}
                className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  playChannel(selectedProgram.channel, filteredChannels);
                  setSelectedProgram(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/20 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                Watch Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EPG Sources Modal */}
      <EpgSourcesModal
        isOpen={isEpgSourcesOpen}
        onClose={() => setIsEpgSourcesOpen(false)}
      />
    </div>
  );
};
