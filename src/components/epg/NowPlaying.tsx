import React from 'react';
import { Radio, Clock, Calendar, ChevronRight } from 'lucide-react';
import type { EpgProgram, Channel } from '../../types';
import { formatTimeRange, formatTime, getEpgProgress } from '../../lib/utils';
import { useChannelStore } from '../../stores/channelStore';

interface NowPlayingWidgetProps {
  channel?: Channel | null;
  nowProgram?: EpgProgram | null;
  nextProgram?: EpgProgram | null;
  onOpenFullEpg?: () => void;
}

export const NowPlaying: React.FC<NowPlayingWidgetProps> = ({
  channel,
  nowProgram,
  nextProgram,
  onOpenFullEpg,
}) => {
  const setPage = useChannelStore((s) => s.setPage);

  const currentProg = nowProgram || channel?.now_playing;
  const upNextProg = nextProgram || channel?.up_next;

  const progress = currentProg
    ? getEpgProgress(currentProg.start_time, currentProg.end_time)
    : 0;

  const handleOpenEpg = () => {
    if (onOpenFullEpg) {
      onOpenFullEpg();
    } else {
      setPage('epg');
    }
  };

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl space-y-3">
      {/* Current Program */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-live">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Now Playing</span>
          </div>
          {currentProg && (
            <span className="text-[11px] font-mono text-white/50">
              {formatTimeRange(currentProg.start_time, currentProg.end_time)}
            </span>
          )}
        </div>

        <h4 className="text-sm font-bold text-white truncate">
          {currentProg ? currentProg.title : 'Live Television Broadcast'}
        </h4>

        {currentProg?.description && (
          <p className="text-xs text-white/60 line-clamp-2 mt-1">
            {currentProg.description}
          </p>
        )}

        {/* Progress Bar */}
        <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-full shadow-sm shadow-accent-500/50 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Up Next Program */}
      {upNextProg && (
        <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-white/40 uppercase">
              <Clock className="w-3 h-3" />
              <span>Up Next</span>
            </div>
            <div className="text-xs font-semibold text-white/80 truncate mt-0.5">
              {upNextProg.title}
            </div>
          </div>
          <span className="text-xs font-mono text-white/50 ml-3 shrink-0">
            {formatTime(upNextProg.start_time)}
          </span>
        </div>
      )}

      {/* Footer link to full guide */}
      <button
        onClick={handleOpenEpg}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-accent-400 hover:text-accent-300 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>Open Full TV Guide</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
