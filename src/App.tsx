import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { ProviderList } from './components/providers/ProviderList';
import { ChannelGrid } from './components/channels/ChannelGrid';
import { TimelineGrid } from './components/epg/TimelineGrid';
import { PlaylistEditor } from './components/editor/PlaylistEditor';
import { VideoPlayer } from './components/player/VideoPlayer';
import { SettingsView } from './components/settings/SettingsView';
import { useChannelStore } from './stores/channelStore';
import { useProviderStore } from './stores/providerStore';
import { useEpgAutoSync } from './hooks/useEpgAutoSync';
import * as api from './lib/api';

export const App: React.FC = () => {
  const { currentPage, setPage, setContentType, setViewMode } = useChannelStore();
  const { providers, fetchProviders } = useProviderStore();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch providers on startup
  useEffect(() => {
    fetchProviders().finally(() => setHasInitialized(true));
  }, [fetchProviders]);

  // Navigate to the correct page once providers are loaded
  useEffect(() => {
    if (!hasInitialized) return;

    const settings = api.getAppSettings();
    if (settings.defaultViewMode) setViewMode(settings.defaultViewMode);

    if (providers.length > 0) {
      if (settings.startupPage === 'epg') {
        setPage('epg');
      } else if (settings.startupPage === 'providers') {
        setPage('providers');
      } else {
        setPage('channels');
        setContentType('live');
      }
    } else {
      setPage('providers');
    }
  }, [hasInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync EPG on launch and every hour
  useEpgAutoSync();

  const renderContent = () => {
    switch (currentPage) {
      case 'providers': return <ProviderList />;
      case 'channels':  return <ChannelGrid />;
      case 'epg':       return <TimelineGrid />;
      case 'editor':    return <PlaylistEditor />;
      case 'settings':  return <SettingsView />;
      case 'player':    return <VideoPlayer />;
      default:          return <ChannelGrid />;
    }
  };

  return <Layout>{renderContent()}</Layout>;
};

export default App;
