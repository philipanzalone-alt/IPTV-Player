import { useEffect, useRef, useCallback } from 'react';
import { useProviderStore } from '../stores/providerStore';
import { useEpgStore } from '../stores/epgStore';

/** Sync EPG on mount and then every hour while the app is open. */
export function useEpgAutoSync() {
  const { selectedProvider } = useProviderStore();
  const { syncAllSources, syncProviderEpg, isSyncing } = useEpgStore();
  const isSyncingRef = useRef(isSyncing);
  isSyncingRef.current = isSyncing;

  const runSync = useCallback(async () => {
    if (!selectedProvider || isSyncingRef.current) return;
    try {
      // 1. Sync external XMLTV sources configured in epg_sources table
      await syncAllSources(selectedProvider.id);

      // 2. Also sync Xtream / M3U provider built-in EPG if applicable
      if (selectedProvider.type === 'xtream' || selectedProvider.epg_url) {
        try {
          await syncProviderEpg(selectedProvider.id);
        } catch {
          // Provider-specific EPG might not be configured, ignore
        }
      }
    } catch (err) {
      console.warn('[EPG Auto-Sync] failed:', err);
    }
  }, [selectedProvider, syncAllSources, syncProviderEpg]);

  // Sync once after startup with a short delay for smooth UI paint
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!selectedProvider) return;
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    const initialTimer = setTimeout(() => {
      runSync();
    }, 2500);

    return () => clearTimeout(initialTimer);
  }, [selectedProvider?.id, runSync]);

  // Re-sync every hour while the app remains open
  useEffect(() => {
    if (!selectedProvider) return;
    const interval = setInterval(runSync, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedProvider?.id, runSync]);
}
