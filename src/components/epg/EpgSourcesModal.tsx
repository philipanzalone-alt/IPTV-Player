import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Check,
  Globe,
  Radio,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useEpgStore } from '../../stores/epgStore';
import { useProviderStore } from '../../stores/providerStore';
import { cn, formatDate } from '../../lib/utils';

interface EpgSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  {
    name: 'IPTV-org US (TVGuide)',
    url: 'https://iptv-org.github.io/epg/guides/us/tvguide.com.epg.xml.gz',
  },
  {
    name: 'IPTV-org UK (Freeview)',
    url: 'https://iptv-org.github.io/epg/guides/uk/freeview.co.uk.epg.xml.gz',
  },
  {
    name: 'IPTV-org Canada',
    url: 'https://iptv-org.github.io/epg/guides/ca/tvheft.com.epg.xml.gz',
  },
  {
    name: 'IPTV-org Sports Feed',
    url: 'https://iptv-org.github.io/epg/guides/all/sports.epg.xml.gz',
  },
];

export const EpgSourcesModal: React.FC<EpgSourcesModalProps> = ({ isOpen, onClose }) => {
  const { providers, selectedProvider } = useProviderStore();
  const {
    epgSources,
    isLoadingSources,
    syncingSourceId,
    isSyncing,
    fetchEpgSources,
    addEpgSource,
    deleteEpgSource,
    syncEpgSource,
    syncAllSources,
  } = useEpgStore();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [providerId, setProviderId] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEpgSources(selectedProvider?.id);
    }
  }, [isOpen, selectedProvider?.id, fetchEpgSources]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const newSource = await addEpgSource(
        name.trim(),
        url.trim(),
        providerId
      );
      setName('');
      setUrl('');
      setStatusMessage(`Added source "${newSource.name}". Starting background sync...`);
      // Automatically trigger sync for the newly added source
      syncEpgSource(newSource.id)
        .then(() => setStatusMessage(`Synced ${newSource.name} successfully!`))
        .catch((err) => setStatusMessage(`Sync note: ${err?.message || err}`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = (preset: { name: string; url: string }) => {
    setName(preset.name);
    setUrl(preset.url);
  };

  const handleSyncSource = async (id: number, srcName: string) => {
    setStatusMessage(`Syncing ${srcName}...`);
    try {
      await syncEpgSource(id);
      setStatusMessage(`Successfully synced ${srcName}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Failed to sync: ${msg}`);
    }
  };

  const handleSyncAll = async () => {
    setStatusMessage('Syncing all EPG sources in background...');
    try {
      await syncAllSources(selectedProvider?.id);
      setStatusMessage('All EPG sources synced successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Sync all failed: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-surface-900 border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">EPG Sources & XMLTV Guides</h2>
              <p className="text-xs text-white/50">
                Add custom XMLTV URLs (.xml or .xml.gz) to populate channel program schedules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
              <span>{statusMessage}</span>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-white/40 hover:text-white ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Add New EPG Source Form */}
          <form onSubmit={handleAdd} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-accent-400" />
                Add EPG Source
              </span>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Presets:
                </span>
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 text-[10px] font-medium text-white/70 hover:text-white transition-colors"
                  >
                    {p.name.replace('IPTV-org ', '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">
                  Source Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. US Electronic Program Guide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">
                  Provider Scope
                </label>
                <select
                  value={providerId ?? ''}
                  onChange={(e) =>
                    setProviderId(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-accent-500 transition-all cursor-pointer"
                >
                  <option value="" className="bg-surface-900">
                    All Providers (Global Guide)
                  </option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} className="bg-surface-900">
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/70 mb-1">
                XMLTV URL (.xml or .xml.gz)
              </label>
              <input
                type="url"
                placeholder="https://example.com/epg.xml.gz"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 font-mono transition-all"
                required
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!name.trim() || !url.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-lg shadow-accent-500/20 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Save Source
              </button>
            </div>
          </form>

          {/* Configured Sources List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Configured EPG Sources ({epgSources.length})
              </span>
              {epgSources.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 font-semibold transition-colors"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
                  Sync All
                </button>
              )}
            </div>

            {isLoadingSources ? (
              <div className="p-8 flex items-center justify-center text-white/40">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : epgSources.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5 text-white/40 text-xs">
                No custom EPG sources added yet. Use the form above or pick a preset to import program guides.
              </div>
            ) : (
              epgSources.map((source) => {
                const isCurrentlySyncing = syncingSourceId === source.id;
                const associatedProvider = source.provider_id
                  ? providers.find((p) => p.id === source.provider_id)
                  : null;

                return (
                  <div
                    key={source.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white truncate">
                          {source.name}
                        </span>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            associatedProvider
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          )}
                        >
                          {associatedProvider ? associatedProvider.name : 'Global'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-white/50 truncate max-w-lg" title={source.url}>
                        {source.url}
                      </p>
                      <p className="text-[10px] text-white/30 mt-1">
                        Last Synced:{' '}
                        {source.last_synced_at ? formatDate(source.last_synced_at) : 'Not synced yet'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleSyncSource(source.id, source.name)}
                        disabled={isCurrentlySyncing || isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 border border-accent-500/40 text-xs font-semibold transition-all disabled:opacity-50"
                        title="Sync now"
                      >
                        <RefreshCw
                          className={cn('w-3.5 h-3.5', isCurrentlySyncing && 'animate-spin')}
                        />
                        <span>{isCurrentlySyncing ? 'Syncing...' : 'Sync'}</span>
                      </button>

                      <button
                        onClick={() => deleteEpgSource(source.id)}
                        className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-white/10 transition-colors"
                        title="Delete source"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/20">
          <span className="text-[11px] text-white/40">
            Supports XMLTV format (.xml, .xml.gz)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default EpgSourcesModal;
