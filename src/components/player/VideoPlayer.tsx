import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
  Loader2,
  AlertTriangle,
  RotateCw,
  X,
  Calendar,
  RefreshCw,
  Scissors,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useEpgStore } from '../../stores/epgStore';
import { PlayerControls } from './PlayerControls';
import { formatTimeRange, cn } from '../../lib/utils';
import type { EpgProgram } from '../../types';
import * as api from '../../lib/api';

export const VideoPlayer: React.FC = () => {
  const {
    currentChannel,
    resolvedStreamUrl,
    isPlaying,
    volume,
    isMuted,
    isFullscreen,
    isLoadingStream,
    error,
    setError,
    togglePlay,
    toggleFullscreen,
    setFullscreen,
    toggleMute,
    setVolume,
    nextChannel,
    previousChannel,
    stopPlayback,
  } = usePlayerStore();

  const { fetchEpgForChannel } = useEpgStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);

  // 30-second rolling buffer refs
  const chunksRef = useRef<{ timestamp: number; blob: Blob }[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isAutoReloading, setIsAutoReloading] = useState<boolean>(false);
  const [reloadAttempts, setReloadAttempts] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [showEpgInfo, setShowEpgInfo] = useState<boolean>(false);
  const [channelPrograms, setChannelPrograms] = useState<EpgProgram[]>([]);
  const [isClipping, setIsClipping] = useState<boolean>(false);
  const [clipToast, setClipToast] = useState<{ success: boolean; message: string } | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Watchdog & Timer references
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);
  const stalledSecondsRef = useRef<number>(0);
  const smoothPlaybackSecondsRef = useRef<number>(0);

  // Check always on top initial state
  useEffect(() => {
    api.isAlwaysOnTop().then(setIsPinned).catch(() => {});
  }, []);

  const handleTogglePin = useCallback(async () => {
    try {
      const next = !isPinned;
      await api.setAlwaysOnTop(next);
      setIsPinned(next);
    } catch (e) {
      console.warn('Failed to toggle always on top:', e);
    }
  }, [isPinned]);

  // Load full channel schedule when opening EPG info panel
  useEffect(() => {
    if (showEpgInfo && currentChannel?.tvg_id && currentChannel.provider_id) {
      fetchEpgForChannel(currentChannel.tvg_id, currentChannel.provider_id).then(
        (programs) => {
          setChannelPrograms(programs);
        }
      );
    }
  }, [showEpgInfo, currentChannel, fetchEpgForChannel]);

  // Clean up existing players
  const destroyCurrentPlayers = useCallback(() => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch (e) {
        console.warn('mpegts cleanup warning:', e);
      }
      mpegtsRef.current = null;
    }
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch (e) {
        console.warn('recorder cleanup warning:', e);
      }
      recorderRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('stream track cleanup warning:', e);
      }
      streamRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  // Setup stream playback
  const initializeStream = useCallback(() => {
    const video = videoRef.current;
    if (!video || !resolvedStreamUrl) return;

    destroyCurrentPlayers();
    setIsLoading(true);
    setIsBuffering(false);
    setError(null);

    const streamUrl = resolvedStreamUrl.trim();
    const isM3u8 = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
    const isMpegTs = streamUrl.endsWith('.ts') || streamUrl.includes('.ts?') || streamUrl.includes('/live/');

    try {
      if (isMpegTs && mpegts.getFeatureList().mseLivePlayback) {
        // MPEG-TS Playback with relaxed latency chasing for stable background / second-screen playback
        const player = mpegts.createPlayer(
          {
            type: 'mpegts',
            isLive: true,
            url: streamUrl,
          },
          {
            enableWorker: true,
            lazyLoad: false,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 5.0,
            liveBufferLatencyMinRemain: 1.0,
          }
        );

        player.attachMediaElement(video);
        player.load();
        const playRes = player.play();
        if (playRes && typeof (playRes as Promise<void>).catch === 'function') {
          (playRes as Promise<void>).catch((e: unknown) => {
            console.warn('mpegts autoplay error:', e);
          });
        }

        player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
          console.warn('MPEG-TS error, scheduling auto-reload:', errorType, errorDetail);
          triggerAutoReload(`MPEG-TS error (${errorType})`);
        });

        mpegtsRef.current = player;
      } else if (Hls.isSupported() && (isM3u8 || !isMpegTs)) {
        // HLS.js Playback with healthy buffer headroom for unfocused second-screen stability
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveDurationInfinity: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 8,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 5,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 5,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 6,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((err) => {
            console.warn('HLS autoplay prevented:', err);
          });
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          // Handle buffer stalls in HLS
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            console.warn('HLS buffer stalled error detected');
            triggerAutoReload('HLS buffer stalled');
            return;
          }

          if (data.fatal) {
            console.warn('Fatal HLS error encountered:', data.type, data.details);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                triggerAutoReload(`Fatal HLS ${data.details}`);
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS for Safari / WebKit
        video.src = streamUrl;
        video.play().catch(console.warn);
      } else {
        // Standard HTML5 video direct source
        video.src = streamUrl;
        video.play().catch(console.warn);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Playback initialization error: ${message}`);
      setIsLoading(false);
    }
  }, [resolvedStreamUrl, destroyCurrentPlayers, setError]);

  // Automatic Reload Watchdog Trigger
  const triggerAutoReload = useCallback(
    (reason: string) => {
      console.warn(`[Stream Watchdog] Triggering reload: ${reason}`);
      setIsAutoReloading(true);
      setIsBuffering(true);
      setReloadAttempts((prev) => prev + 1);

      destroyCurrentPlayers();

      // Brief delay to allow sockets to terminate cleanly before re-opening
      setTimeout(() => {
        initializeStream();
        setTimeout(() => {
          setIsAutoReloading(false);
        }, 1500);
      }, 350);
    },
    [destroyCurrentPlayers, initializeStream]
  );

  // Handle Video Buffering Events
  const handleWaitingOrStalled = useCallback(() => {
    setIsBuffering(true);

    // If an auto-reload is already scheduled, don't duplicate
    if (bufferingTimeoutRef.current) return;

    // First attempt a fast live-edge nudge for HLS if possible
    if (hlsRef.current && videoRef.current) {
      try {
        const video = videoRef.current;
        if (video.buffered.length > 0) {
          const liveEnd = video.buffered.end(video.buffered.length - 1);
          if (liveEnd - video.currentTime > 1.5) {
            video.currentTime = liveEnd - 0.3;
          }
        }
        hlsRef.current.startLoad();
      } catch (err) {
        console.warn('HLS live nudge error:', err);
      }
    }

    // Automatically reload stream if buffering doesn't resolve within configured timeout
    const stallTimeout = api.getAppSettings().bufferStallTimeout ?? 2200;
    if (stallTimeout > 0) {
      bufferingTimeoutRef.current = setTimeout(() => {
        bufferingTimeoutRef.current = null;
        triggerAutoReload(`Buffering did not recover within ${stallTimeout / 1000}s`);
      }, stallTimeout);
    }
  }, [triggerAutoReload]);

  // Initialize rolling 30-second buffer recorder
  const startRecordingBuffer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check if background DVR buffer is enabled in settings (off by default for performance)
    const settings = api.getAppSettings();
    if (!settings.enableClipBuffer) {
      return;
    }

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      return;
    }

    try {
      if (recorderRef.current) {
        try {
          recorderRef.current.stop();
        } catch (e) {}
        recorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const captureFn =
        (video as any).captureStream ||
        (video as any).mozCaptureStream;

      if (!captureFn) return;

      const stream: MediaStream = captureFn.call(video);
      streamRef.current = stream;

      let mimeType = 'video/webm;codecs=vp8,opus';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push({
            timestamp: Date.now(),
            blob: e.data,
          });
          const cutoff = Date.now() - 32000;
          chunksRef.current = chunksRef.current.filter((c) => c.timestamp >= cutoff);
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
    } catch (err) {
      console.warn('MediaRecorder buffer init error:', err);
    }
  }, []);

  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
    setIsLoading(false);
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = null;
    }
    startRecordingBuffer();
  }, [startRecordingBuffer]);

  // Handle 30-second video clipping to disk
  const handleClipLast30Seconds = useCallback(async () => {
    if (isClipping) return;
    setIsClipping(true);

    try {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.requestData();
        } catch (e) {}
      }

      await new Promise((r) => setTimeout(r, 200));

      const chunks = chunksRef.current.map((c) => c.blob);
      if (chunks.length === 0) {
        const settings = api.getAppSettings();
        setClipToast({
          success: false,
          message: settings.enableClipBuffer
            ? 'Clip buffer is buffering. Please wait a few moments and try again.'
            : 'Enable "Background DVR Buffer" in Settings to capture instant 30-second clips.',
        });
        setTimeout(() => setClipToast(null), 4000);
        setIsClipping(false);
        return;
      }

      const fullBlob = new Blob(chunks, { type: 'video/webm' });
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fullBlob);
      });

      const chName = (currentChannel?.display_name || currentChannel?.name || 'Channel')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Clip_${chName}_${Date.now()}.webm`;

      const savedResult = await api.saveVideoClip(filename, base64Data);

      setClipToast({
        success: true,
        message: `Saved 30s clip: ${savedResult}`,
      });
      setTimeout(() => setClipToast(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setClipToast({
        success: false,
        message: `Failed to save clip: ${message}`,
      });
      setTimeout(() => setClipToast(null), 5000);
    } finally {
      setIsClipping(false);
    }
  }, [isClipping, currentChannel]);

  // Heartbeat Watchdog: Detects frozen video playback (where current time does not advance)
  useEffect(() => {
    const watchdog = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || !isPlaying || isLoading || isAutoReloading) {
        stalledSecondsRef.current = 0;
        return;
      }

      const stallTimeout = api.getAppSettings().bufferStallTimeout ?? 2200;
      if (stallTimeout === 0) {
        stalledSecondsRef.current = 0;
        return;
      }

      const currentTime = video.currentTime;
      const lastTime = lastPlaybackTimeRef.current;

      // Check if time is advancing
      if (Math.abs(currentTime - lastTime) > 0.05) {
        stalledSecondsRef.current = 0;
        smoothPlaybackSecondsRef.current += 1;
        // After 8 seconds of uninterrupted playback, reset reload attempt counter
        if (smoothPlaybackSecondsRef.current > 8) {
          setReloadAttempts(0);
        }
      } else {
        // Playback has halted/frozen
        smoothPlaybackSecondsRef.current = 0;
        stalledSecondsRef.current += 1;

        // When second-screening or backgrounded, allow a comfortable freeze threshold (at least 6s)
        const freezeThreshold = Math.max(6, Math.ceil(stallTimeout / 1000) + 3);
        if (stalledSecondsRef.current >= freezeThreshold) {
          stalledSecondsRef.current = 0;
          triggerAutoReload(`Video time frozen for ${freezeThreshold} seconds`);
        }
      }

      lastPlaybackTimeRef.current = currentTime;
    }, 1000);

    return () => clearInterval(watchdog);
  }, [isPlaying, isLoading, isAutoReloading, triggerAutoReload]);

  // Trigger init on stream url change or retry
  useEffect(() => {
    if (resolvedStreamUrl) {
      initializeStream();
    }
    return () => {
      destroyCurrentPlayers();
    };
  }, [resolvedStreamUrl, retryCount, initializeStream, destroyCurrentPlayers]);

  // Synchronize playing state with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Synchronize volume and mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [setFullscreen]);

  // Handle Fullscreen state trigger
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isFullscreen && !document.fullscreenElement) {
      container.requestFullscreen?.().catch(console.warn);
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen?.().catch(console.warn);
    }
  }, [isFullscreen]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (isFullscreen) {
            setFullscreen(false);
          } else {
            stopPlayback();
          }
          break;
        case 'KeyR':
          // Manual instant reload shortcut
          e.preventDefault();
          triggerAutoReload('Manual reload requested via key R');
          break;
        case 'KeyC':
          // Clip 30 seconds shortcut
          e.preventDefault();
          handleClipLast30Seconds();
          break;
        case 'KeyP':
          // Pin / Always on top toggle
          e.preventDefault();
          handleTogglePin();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextChannel();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousChannel();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isFullscreen,
    volume,
    togglePlay,
    toggleFullscreen,
    toggleMute,
    setVolume,
    nextChannel,
    previousChannel,
    stopPlayback,
    setFullscreen,
    triggerAutoReload,
    handleClipLast30Seconds,
    handleTogglePin,
  ]);

  if (!currentChannel) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black flex items-center justify-center overflow-hidden select-none',
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'w-full h-full'
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onWaiting={handleWaitingOrStalled}
        onStalled={handleWaitingOrStalled}
        onPlaying={handlePlaying}
        onCanPlay={handlePlaying}
        onError={() => {
          setIsLoading(false);
          triggerAutoReload('Native video error event');
        }}
      />

      {/* Auto-Reload / Watchdog Notification Badge */}
      {isAutoReloading && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2 bg-surface-950/85 backdrop-blur-2xl border border-amber-500/40 text-amber-300 rounded-full text-xs font-semibold shadow-2xl z-40 animate-pulse">
          <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span>
            Buffering stalled — Auto-reloading stream
            {reloadAttempts > 1 ? ` (Attempt #${reloadAttempts})` : ''}
          </span>
        </div>
      )}

      {/* Buffering Indicator */}
      {(isLoading || isLoadingStream || isBuffering) && !error && !isAutoReloading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs z-20 pointer-events-none">
          <Loader2 className="w-12 h-12 text-accent-500 animate-spin mb-3" />
          <p className="text-sm font-medium text-white/90">
            {isBuffering ? 'Buffering stream...' : 'Connecting to stream...'}
          </p>
          <p className="text-[11px] text-white/40 mt-1">
            Auto-reloads if stall persists
          </p>
        </div>
      )}

      {/* Manual Fallback Error Overlay */}
      {error && !isAutoReloading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20 p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Stream Playback Failed</h3>
          <p className="text-sm text-white/60 max-w-md mb-6">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setError(null);
                setRetryCount((c) => c + 1);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-accent-500/20"
            >
              <RotateCw className="w-4 h-4" />
              Retry Connection
            </button>
            <button
              onClick={stopPlayback}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 text-sm font-semibold rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* EPG Info Slide-over Modal */}
      {showEpgInfo && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-surface-950/95 backdrop-blur-2xl border-l border-white/10 z-40 p-5 flex flex-col animate-slide-right">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Calendar className="w-4 h-4 text-accent-400" />
              <span>Program Schedule</span>
            </div>
            <button
              onClick={() => setShowEpgInfo(false)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
            {channelPrograms.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-8">
                No schedule data found for this channel.
              </p>
            ) : (
              channelPrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1"
                >
                  <div className="text-[11px] font-mono text-accent-400 font-semibold">
                    {formatTimeRange(prog.start_time, prog.end_time)}
                  </div>
                  <div className="text-xs font-bold text-white">{prog.title}</div>
                  {prog.description && (
                    <p className="text-[11px] text-white/60 line-clamp-2">
                      {prog.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Clip Notification Toast */}
      {clipToast && (
        <div
          className={cn(
            'absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xl z-50 backdrop-blur-2xl border transition-all animate-bounce',
            clipToast.success
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/90 border-red-500/50 text-red-200'
          )}
        >
          <Scissors className="w-4 h-4 text-accent-400" />
          <span>{clipToast.message}</span>
        </div>
      )}

      {/* Controls Overlay */}
      <PlayerControls
        onToggleEpgInfo={() => setShowEpgInfo(!showEpgInfo)}
        showEpgInfo={showEpgInfo}
        onReloadStream={() => triggerAutoReload('User requested stream reload')}
        onClip={handleClipLast30Seconds}
        isClipping={isClipping}
        isAlwaysOnTop={isPinned}
        onToggleAlwaysOnTop={handleTogglePin}
      />
    </div>
  );
};
