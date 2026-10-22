import React, { useState } from 'react';
import {
  Tv,
  Play,
  Star,
  EyeOff,
  MoreVertical,
  Volume2,
  Clock,
  Edit,
} from 'lucide-react';
import type { Channel } from '../../types';
import { cn, getEpgProgress, formatTimeRange } from '../../lib/utils';

interface ChannelCardProps {
  channel: Channel;
  viewMode?: 'grid' | 'list';
  isCurrentlyPlaying?: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onEdit?: () => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  viewMode = 'grid',
  isCurrentlyPlaying = false,
  onPlay,
  onToggleFavorite,
  onEdit,
}) => {
  const [imgError, setImgError] = useState(false);
  const displayName = channel.display_name || channel.name;

  const nowProgram = channel.now_playing;
  const progress = nowProgram
    ? getEpgProgress(nowProgram.start_time, nowProgram.end_time)
    : 0;

  if (viewMode === 'list') {
    return (
      <div
        onClick={onPlay}
        className={cn(
          'group relative flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 select-none',
          'bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 hover:bg-white/[0.08]',
          isCurrentlyPlaying && 'bg-accent-500/20 border-accent-500/50 shadow-lg shadow-accent-500/10'
        )}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Logo or placeholder */}
          <div className="relative w-12 h-12 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {channel.logo_url && !imgError ? (
              <img
                src={channel.logo_url}
                alt={displayName}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-white/40">
                <Tv className="w-5 h-5" />
              </div>
            )}
            {/* Play hover badge */}
            <div className="absolute inset-0 bg-accent-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4
                className={cn(
                  'text-sm font-semibold truncate',
                  isCurrentlyPlaying ? 'text-accent-400 font-bold' : 'text-white group-hover:text-white'
                )}
              >
                {displayName}
              </h4>
              {channel.is_hidden && (
                <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                  <EyeOff className="w-2.5 h-2.5" />
                  Hidden
                </span>
              )}
            </div>

            {nowProgram ? (
              <div className="mt-1">
                <div className="flex items-center justify-between text-xs text-white/60 mb-1 max-w-md">
                  <span className="truncate">{nowProgram.title}</span>
                  <span className="text-[11px] text-white/40 font-mono ml-2 shrink-0">
                    {formatTimeRange(nowProgram.start_time, nowProgram.end_time)}
                  </span>
                </div>
                <div className="w-full max-w-md h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 truncate mt-0.5">No program guide data</p>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div
          className="flex items-center gap-1 ml-4"
          onClick={(e) => e.stopPropagation()}
        >
          {isCurrentlyPlaying && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-500/20 text-accent-400 border border-accent-500/40 text-xs font-semibold mr-2 animate-pulse">
              <Volume2 className="w-3.5 h-3.5" />
              Live
            </div>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title="Edit Channel"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onToggleFavorite}
            className={cn(
              'p-2 rounded-lg transition-colors',
              channel.is_favorite
                ? 'text-amber-400 fill-amber-400 hover:text-amber-300'
                : 'text-white/30 hover:text-white hover:bg-white/10'
            )}
            title={channel.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={cn('w-4 h-4', channel.is_favorite && 'fill-amber-400')}
            />
          </button>
        </div>
      </div>
    );
  }

  // Grid view card
  return (
    <div
      onClick={onPlay}
      className={cn(
        'group relative flex flex-col justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-200 select-none overflow-hidden',
        'bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.08] hover:scale-[1.02] shadow-xl shadow-black/25',
        isCurrentlyPlaying && 'bg-accent-500/20 border-accent-500/50 shadow-accent-500/20'
      )}
    >
      {/* Top row: Favorite & Hidden */}
      <div className="flex items-center justify-between mb-2 z-10">
        <div>
          {channel.is_hidden && (
            <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
              <EyeOff className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
              title="Edit Channel"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onToggleFavorite}
            className={cn(
              'p-1 rounded-md transition-colors',
              channel.is_favorite
                ? 'text-amber-400 fill-amber-400'
                : 'text-white/30 hover:text-white hover:bg-white/10'
            )}
            title={channel.is_favorite ? 'Favorited' : 'Favorite'}
          >
            <Star
              className={cn('w-4 h-4', channel.is_favorite && 'fill-amber-400')}
            />
          </button>
        </div>
      </div>

      {/* Center Logo & Play Overlay */}
      <div className="relative w-full aspect-video rounded-xl bg-black/40 border border-white/5 flex items-center justify-center p-3 overflow-hidden mb-3">
        {channel.logo_url && !imgError ? (
          <img
            src={channel.logo_url}
            alt={displayName}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain filter drop-shadow-md"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white/30">
            <Tv className="w-8 h-8 mb-1" />
            <span className="text-[11px] font-semibold tracking-wider text-white/50 text-center uppercase truncate max-w-[90px]">
              {displayName.slice(0, 8)}
            </span>
          </div>
        )}

        {/* Hover play icon */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-accent-500 text-white flex items-center justify-center shadow-lg shadow-accent-500/40">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Live indicator if active */}
        {isCurrentlyPlaying && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-live text-white rounded text-[10px] font-bold tracking-wider uppercase animate-pulse">
            <Volume2 className="w-3 h-3" />
            Playing
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="min-w-0">
        <h4
          className={cn(
            'text-xs font-semibold truncate',
            isCurrentlyPlaying ? 'text-accent-400' : 'text-white'
          )}
          title={displayName}
        >
          {displayName}
        </h4>

        {nowProgram ? (
          <div className="mt-1.5">
            <p className="text-[11px] text-white/60 truncate" title={nowProgram.title}>
              {nowProgram.title}
            </p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-accent-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-white/30 truncate mt-1">No guide available</p>
        )}
      </div>
    </div>
  );
};
