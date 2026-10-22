import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Radio,
  Tv,
  Info,
  Clock,
  RotateCw,
  Scissors,
  Loader2,
  Pin,
  PinOff,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { formatTimeRange, formatTime, getEpgProgress, cn } from '../../lib/utils';

interface PlayerControlsProps {
  onToggleEpgInfo?: () => void;
  showEpgInfo?: boolean;
  onReloadStream?: () => void;
  onClip?: () => void;
  isClipping?: boolean;
  isAlwaysOnTop?: boolean;
  onToggleAlwaysOnTop?: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  onToggleEpgInfo,
  showEpgInfo,
  onReloadStream,
  onClip,
  isClipping = false,
  isAlwaysOnTop = false,
  onToggleAlwaysOnTop,
}) => {
  const {
    currentChannel,
    isPlaying,
    volume,
    isMuted,
    isFullscreen,
    isOverlayVisible,
    togglePlay,
    setVolume,
    toggleMute,
    toggleFullscreen,
    nextChannel,
    previousChannel,
    stopPlayback,
    setOverlayVisible,
  } = usePlayerStore();

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = () => {
    setOverlayVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setOverlayVisible(false);
      }
    }, 3500);
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isPlaying]);

  if (!currentChannel) return null;

  const displayName = currentChannel.display_name || currentChannel.name;
  const nowProgram = currentChannel.now_playing;
  const progress = nowProgram
    ? getEpgProgress(nowProgram.start_time, nowProgram.end_time)
    : 0;

  return (
    <div
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className={cn(
        'absolute inset-0 z-30 flex flex-col justify-between pointer-events-none transition-opacity duration-300',
        isOverlayVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Top Bar Overlay */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
            {currentChannel.logo_url ? (
              <img
                src={currentChannel.logo_url}
                alt={displayName}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Tv className="w-6 h-6 text-white/50" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-live text-white font-bold text-[10px] uppercase tracking-wider animate-pulse">
                <Radio className="w-3 h-3" />
                Live
              </span>
              <h2 className="text-lg font-bold text-white drop-shadow-md">{displayName}</h2>
            </div>
            {nowProgram ? (
              <p className="text-xs text-white/80 drop-shadow mt-0.5">
                {nowProgram.title} &bull;{' '}
                <span className="text-white/60 font-mono">
                  {formatTimeRange(nowProgram.start_time, nowProgram.end_time)}
                </span>
              </p>
            ) : (
              <p className="text-xs text-white/40 drop-shadow mt-0.5">Live Stream</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleAlwaysOnTop && (
            <button
              onClick={onToggleAlwaysOnTop}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                isAlwaysOnTop
                  ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/30'
                  : 'bg-black/40 hover:bg-black/60 text-white/70 hover:text-white border border-white/10'
              )}
              title={
                isAlwaysOnTop
                  ? 'Always on Top: ON (Click or press P to disable)'
                  : 'Always on Top: OFF (Click or press P to pin for second screen)'
              }
            >
              {isAlwaysOnTop ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
            </button>
          )}

          {onToggleEpgInfo && (
            <button
              onClick={onToggleEpgInfo}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                showEpgInfo
                  ? 'bg-accent-500 text-white'
                  : 'bg-black/40 hover:bg-black/60 text-white/70 hover:text-white border border-white/10'
              )}
              title="EPG Guide Info"
            >
              <Info className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={stopPlayback}
            className="p-2.5 rounded-xl bg-black/40 hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/10 transition-colors active:scale-95"
            title="Close Player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Area (docked at the bottom) */}
      <div className="flex flex-col bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-auto pt-8">
        {/* Program Progress / Time Bar */}
        {nowProgram && (
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-white/70 mb-1.5 px-0.5">
              <span className="font-semibold text-indigo-400">{formatTime(nowProgram.start_time)}</span>
              <span className="text-white/60 truncate mx-3 text-xs font-sans font-medium">{nowProgram.title}</span>
              <span className="font-semibold text-white/50">{formatTime(nowProgram.end_time)}</span>
            </div>
            <div className="w-full h-1.5 bg-white/15 hover:h-2 rounded-full overflow-hidden backdrop-blur-sm transition-all cursor-default">
              <div
                className="h-full bg-indigo-500 shadow-md shadow-indigo-500/50 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div className="flex items-center justify-between p-6 pt-2">
          {/* Left: Playback controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={previousChannel}
              className="btn-ghost bg-black/40 border border-white/10"
              title="Previous Channel (Left Arrow)"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 transition-all"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            <button
              onClick={nextChannel}
              className="btn-ghost bg-black/40 border border-white/10"
              title="Next Channel (Right Arrow)"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {onReloadStream && (
              <button
                onClick={onReloadStream}
                className="btn-ghost bg-black/40 border border-white/10"
                title="Reload Stream (R)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            {onClip && (
              <button
                onClick={onClip}
                disabled={isClipping}
                className="btn-secondary bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30 font-semibold text-xs shadow-md"
                title="Clip last 30 seconds of video to disk (C)"
              >
                {isClipping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Scissors className="w-4 h-4 text-accent-400" />
                )}
                <span>Clip 30s</span>
              </button>
            )}
          </div>

          {/* Right: Volume & Fullscreen */}
          <div className="flex items-center gap-4">
            {/* Volume Group */}
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <button
                onClick={toggleMute}
                className="text-white/70 hover:text-white transition-colors"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 accent-indigo-500 h-1.5 cursor-pointer rounded-lg bg-white/20"
              />
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-black/40 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
