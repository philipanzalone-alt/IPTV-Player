import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  List as ListIcon,
  Search,
  RefreshCw,
  Tv,
  Loader2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Database,
} from 'lucide-react';
import { useChannelStore } from '../../stores/channelStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useEditorStore } from '../../stores/editorStore';
import { useChannels } from '../../hooks/useChannels';
import { useEPG } from '../../hooks/useEPG';
import { ChannelCard } from './ChannelCard';
import { CategoryList } from './CategoryList';
import { EpgSourcesModal } from '../epg/EpgSourcesModal';
import type { Channel } from '../../types';
import { cn } from '../../lib/utils';

const CHANNELS_PER_PAGE = 48;

export const ChannelGrid: React.FC = () => {
  const { viewMode, setViewMode, selectedCategory, searchQuery, setSearchQuery } =
    useChannelStore();
  const { currentChannel, playChannel } = usePlayerStore();
  const { openEditPanel, toggleFavorite } = useEditorStore();

  const { channels, isLoading, error, refetch } = useChannels();
  const [currentPage, setCurrentPage] = useState(1);
  const [isEpgModalOpen, setIsEpgModalOpen] = useState(false);

  // Paginated channels slice
  const totalPages = Math.max(1, Math.ceil(channels.length / CHANNELS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedChannels = useMemo(() => {
    const start = (activePage - 1) * CHANNELS_PER_PAGE;
    return channels.slice(start, start + CHANNELS_PER_PAGE);
  }, [channels, activePage]);

  // Hook EPG for the visible channels
  const { nowPlaying } = useEPG(paginatedChannels);

  // Merge now_playing into channels (matching channel database id, tvg_id, or name)
  const channelsWithEpg = useMemo(() => {
    return paginatedChannels.map((c) => {
      const prog =
        nowPlaying[c.id] ||
        nowPlaying[String(c.id)] ||
        (c.custom_tvg_id ? nowPlaying[c.custom_tvg_id] : null) ||
        (c.custom_tvg_id ? nowPlaying[c.custom_tvg_id.toLowerCase()] : null) ||
        (c.tvg_id ? nowPlaying[c.tvg_id] : null) ||
        (c.tvg_id ? nowPlaying[c.tvg_id.toLowerCase()] : null) ||
        (c.display_name ? nowPlaying[c.display_name] : null) ||
        (c.display_name ? nowPlaying[c.display_name.toLowerCase()] : null) ||
        (c.name ? nowPlaying[c.name] : null) ||
        (c.name ? nowPlaying[c.name.toLowerCase()] : null) ||
        c.now_playing;
      return {
        ...c,
        now_playing: prog,
      };
    });
  }, [paginatedChannels, nowPlaying]);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Category Sidebar */}
      <CategoryList />

      {/* Main Channel Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-900/60">
        {/* Top Filter & View Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-950/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {selectedCategory?.name || (searchQuery ? `Search: "${searchQuery}"` : 'All Channels')}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/70">
              {channels.length} {channels.length === 1 ? 'channel' : 'channels'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* EPG Sources Manager */}
            <button
              onClick={() => setIsEpgModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold transition-colors"
              title="Add & Manage EPG XMLTV Sources"
            >
              <Database className="w-3.5 h-3.5 text-accent-400" />
              <span>EPG Sources</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  viewMode === 'grid'
                    ? 'bg-accent-500 text-white shadow-md'
                    : 'text-white/40 hover:text-white'
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  viewMode === 'list'
                    ? 'bg-accent-500 text-white shadow-md'
                    : 'text-white/40 hover:text-white'
                )}
                title="List View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh channels */}
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
              title="Refresh Channels"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin text-accent-400')} />
            </button>
          </div>
        </div>

        {/* Channels Content */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {isLoading && channels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center min-h-[300px]">
              <Loader2 className="w-8 h-8 text-accent-500 animate-spin mb-3" />
              <p className="text-sm text-white/40">Loading channels...</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/[0.02] border border-white/5 min-h-[350px]">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-3">
                <Tv className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Channels Found</h3>
              <p className="text-xs text-white/40 max-w-sm">
                {searchQuery
                  ? `No channels match your query "${searchQuery}". Try clearing search or selecting a different category.`
                  : 'This category does not have any channels yet or they are currently hidden.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-accent-400 bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/30 rounded-xl transition-all"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {channelsWithEpg.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  viewMode="grid"
                  isCurrentlyPlaying={currentChannel?.id === channel.id}
                  onPlay={() => playChannel(channel, channels)}
                  onToggleFavorite={() => toggleFavorite(channel.id)}
                  onEdit={() => openEditPanel(channel)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              {channelsWithEpg.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  viewMode="list"
                  isCurrentlyPlaying={currentChannel?.id === channel.id}
                  onPlay={() => playChannel(channel, channels)}
                  onToggleFavorite={() => toggleFavorite(channel.id)}
                  onEdit={() => openEditPanel(channel)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-surface-950/40 backdrop-blur-md">
            <span className="text-xs text-white/50">
              Showing {(activePage - 1) * CHANNELS_PER_PAGE + 1} -{' '}
              {Math.min(activePage * CHANNELS_PER_PAGE, channels.length)} of {channels.length} channels
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={activePage === 1}
                className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold px-2 text-white/80">
                Page {activePage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={activePage === totalPages}
                className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EPG Sources Modal */}
      <EpgSourcesModal
        isOpen={isEpgModalOpen}
        onClose={() => setIsEpgModalOpen(false)}
      />
    </div>
  );
};
