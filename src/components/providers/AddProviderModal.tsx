import React, { useState } from 'react';
import {
  X,
  Server,
  FileText,
  Radio,
  Upload,
  Globe,
  KeyRound,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useProviderStore } from '../../stores/providerStore';
import type { AddProviderXtream, AddProviderM3U } from '../../types';
import { cn } from '../../lib/utils';

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddProviderModal: React.FC<AddProviderModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addXtreamProvider, addM3uProvider } = useProviderStore();

  const [activeTab, setActiveTab] = useState<'xtream' | 'm3u'>('xtream');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Xtream Form State
  const [xtreamName, setXtreamName] = useState('');
  const [xtreamServerUrl, setXtreamServerUrl] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [xtreamUserAgent, setXtreamUserAgent] = useState('');

  // M3U Form State
  const [m3uName, setM3uName] = useState('');
  const [m3uSourceType, setM3uSourceType] = useState<'url' | 'file'>('url');
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uLocalPath, setM3uLocalPath] = useState('');
  const [m3uEpgUrl, setM3uEpgUrl] = useState('');
  const [m3uUserAgent, setM3uUserAgent] = useState('');

  if (!isOpen) return null;

  const handleBrowseLocalFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Playlists',
            extensions: ['m3u', 'm3u8'],
          },
        ],
      });
      if (typeof selected === 'string') {
        setM3uLocalPath(selected);
      }
    } catch {
      // Prompt user or handle manual path input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'xtream') {
        if (!xtreamName.trim()) throw new Error('Provider name is required.');
        if (!xtreamServerUrl.trim()) throw new Error('Server URL is required.');
        if (!xtreamUsername.trim()) throw new Error('Username is required.');
        if (!xtreamPassword.trim()) throw new Error('Password is required.');

        let formattedUrl = xtreamServerUrl.trim();
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = `http://${formattedUrl}`;
        }

        const payload: AddProviderXtream = {
          name: xtreamName.trim(),
          server_url: formattedUrl,
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
          user_agent: xtreamUserAgent.trim() || undefined,
        };

        await addXtreamProvider(payload);
      } else {
        if (!m3uName.trim()) throw new Error('Provider name is required.');
        if (m3uSourceType === 'url' && !m3uUrl.trim()) {
          throw new Error('M3U URL is required.');
        }
        if (m3uSourceType === 'file' && !m3uLocalPath.trim()) {
          throw new Error('Local M3U file path is required.');
        }

        const payload: AddProviderM3U = {
          name: m3uName.trim(),
          m3u_url: m3uSourceType === 'url' ? m3uUrl.trim() : undefined,
          m3u_local_path: m3uSourceType === 'file' ? m3uLocalPath.trim() : undefined,
          epg_url: m3uEpgUrl.trim() || undefined,
          user_agent: m3uUserAgent.trim() || undefined,
        };

        await addM3uProvider(payload);
      }

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl bg-surface-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add IPTV Provider</h2>
              <p className="text-xs text-white/50">
                Connect an Xtream Codes API server or import an M3U playlist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-white/5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('xtream');
                setFormError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'xtream'
                  ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <Server className="w-4 h-4" />
              Xtream Codes API
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('m3u');
                setFormError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'm3u'
                  ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <Radio className="w-4 h-4" />
              M3U Playlist / URL
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {activeTab === 'xtream' ? (
            /* Xtream Fields */
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Provider Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Premium Live Streams"
                  value={xtreamName}
                  onChange={(e) => setXtreamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Server URL *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="http://server.example.com:8080"
                    value={xtreamServerUrl}
                    onChange={(e) => setXtreamServerUrl(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Username *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="password"
                      placeholder="Password"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  User Agent (Optional)
                </label>
                <input
                  type="text"
                  placeholder="IPTVSmartersPlayer / VLC / Custom"
                  value={xtreamUserAgent}
                  onChange={(e) => setXtreamUserAgent(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                />
              </div>
            </div>
          ) : (
            /* M3U Fields */
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Provider Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Sports M3U"
                  value={m3uName}
                  onChange={(e) => setM3uName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                  required
                />
              </div>

              <div className="flex gap-4 text-xs font-medium text-white/70">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="m3uSource"
                    checked={m3uSourceType === 'url'}
                    onChange={() => setM3uSourceType('url')}
                    className="accent-indigo-500"
                  />
                  <span>Remote URL</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="m3uSource"
                    checked={m3uSourceType === 'file'}
                    onChange={() => setM3uSourceType('file')}
                    className="accent-indigo-500"
                  />
                  <span>Local File (.m3u / .m3u8)</span>
                </label>
              </div>

              {m3uSourceType === 'url' ? (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    M3U URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="url"
                      placeholder="https://provider.domain/playlist.m3u"
                      value={m3uUrl}
                      onChange={(e) => setM3uUrl(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                      required={m3uSourceType === 'url'}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Local Playlist File Path *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="C:\playlists\channels.m3u"
                      value={m3uLocalPath}
                      onChange={(e) => setM3uLocalPath(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                      required={m3uSourceType === 'file'}
                    />
                    <button
                      type="button"
                      onClick={handleBrowseLocalFile}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/10 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Browse
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  XMLTV / EPG URL (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="url"
                    placeholder="https://epg.domain/guide.xml.gz"
                    value={m3uEpgUrl}
                    onChange={(e) => setM3uEpgUrl(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  User Agent (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Custom HTTP User-Agent"
                  value={m3uUserAgent}
                  onChange={(e) => setM3uUserAgent(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 active:bg-accent-700 rounded-xl shadow-lg shadow-accent-500/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Save & Sync'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
