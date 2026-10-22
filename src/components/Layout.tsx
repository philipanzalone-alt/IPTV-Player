import React, { useState } from 'react';
import {
  Search,
  Server,
  Radio,
  Tv,
  Maximize2,
  Minimize2,
  X,
  Volume2,
  Play,
  Pause,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { VideoPlayer } from './player/VideoPlayer';
import { useChannelStore } from '../stores/channelStore';
import { useProviderStore } from '../stores/providerStore';
import { usePlayerStore } from '../stores/playerStore';
import { cn } from '../lib/utils';
import { isTauri } from '../lib/api';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { searchQuery, setSearchQuery, currentPage, setPage } = useChannelStore();
  const { selectedProvider } = useProviderStore();
  const {
    currentChannel,
    isPlaying,
    isFullscreen,
    togglePlay,
    stopPlayback,
    setFullscreen,
  } = usePlayerStore();

  const [isMiniPlayer, setIsMiniPlayer] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim() && currentPage !== 'channels') {
      setPage('channels');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-900 text-white font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top App Bar */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-surface-950/60 backdrop-blur-2xl z-10">
          {/* Global Search Bar */}
          <div className="relative w-80 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search channels, movies, series..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Header Status */}
          <div className="flex items-center gap-3">
            {!isTauri() && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium"
                title="Running in Web Preview. For native SQLite, hardware decoding, and CORS bypass, run `npm run tauri dev` or open iptv-player.exe"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Web Preview</span>
              </div>
            )}

            {/* Active Provider Status Badge */}
            {selectedProvider ? (
              <div
                onClick={() => setPage('providers')}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 cursor-pointer transition-all"
                title="Manage Providers"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-white/90 truncate max-w-[150px]">
                  {selectedProvider.name}
                </span>
                <span className="text-[10px] uppercase font-bold text-white/40 px-1.5 py-0.5 rounded bg-white/5">
                  {selectedProvider.type}
                </span>
              </div>
            ) : (
              <button
                onClick={() => setPage('providers')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent-500/20 border border-accent-500/30 text-accent-400 text-xs font-semibold hover:bg-accent-500/30 transition-all"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Connect Provider</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Page Content View */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {children}
        </main>

        {/* Video Player Floating / Docked / Fullscreen Overlay */}
        {currentChannel && (
          <div
            className={cn(
              'transition-all duration-300 z-40',
              isFullscreen
                ? 'fixed inset-0 w-screen h-screen'
                : isMiniPlayer
                ? 'fixed bottom-6 right-6 w-96 h-56 rounded-2xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-2xl bg-black'
                : 'fixed inset-0 w-screen h-screen bg-black'
            )}
          >
            {/* Mini Player Control Bar */}
            {!isFullscreen && (
              <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => setIsMiniPlayer(!isMiniPlayer)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title={isMiniPlayer ? 'Expand Player' : 'Picture-in-Picture / Minimize'}
                >
                  {isMiniPlayer ? (
                    <Maximize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Minimize2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={stopPlayback}
                  className="p-1.5 text-white/70 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors"
                  title="Close Playback"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <VideoPlayer />
          </div>
        )}
      </div>
    </div>
  );
};
