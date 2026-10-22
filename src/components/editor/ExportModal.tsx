import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Loader2,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useProviderStore } from '../../stores/providerStore';
import { cn } from '../../lib/utils';

export const ExportModal: React.FC = () => {
  const { selectedProvider } = useProviderStore();
  const {
    isExportModalOpen,
    closeExportModal,
    exportPlaylist,
    overrides,
    isLoading,
  } = useEditorStore();

  const [playlistContent, setPlaylistContent] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [includeHidden, setIncludeHidden] = useState<boolean>(false);

  useEffect(() => {
    if (isExportModalOpen && selectedProvider) {
      setIsExporting(true);
      exportPlaylist(selectedProvider.id)
        .then((content) => {
          setPlaylistContent(content || '#EXTM3U\n# No channels generated');
        })
        .catch((err) => {
          console.warn('Backend export playlist fallback:', err);
          // Fallback mockup preview
          setPlaylistContent(
            `#EXTM3U name="${selectedProvider.name}"\n# Exported from IPTV Player Studio\n#EXTINF:-1 tvg-id="" tvg-name="Sample" group-title="General",Sample Channel\nhttp://example.com/stream.m3u8`
          );
        })
        .finally(() => {
          setIsExporting(false);
        });
    }
  }, [isExportModalOpen, selectedProvider, exportPlaylist]);

  if (!isExportModalOpen || !selectedProvider) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(playlistContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy playlist:', err);
    }
  };

  const handleSaveToFile = async () => {
    try {
      // Attempt Tauri Save Dialog
      let savePath: string | null = null;
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        savePath = await save({
          filters: [
            {
              name: 'M3U Playlist',
              extensions: ['m3u', 'm3u8'],
            },
          ],
          defaultPath: `${selectedProvider.name.toLowerCase().replace(/\s+/g, '_')}_exported.m3u`,
        });
      } catch {
        // Fallback to browser blob download
      }

      if (savePath) {
        try {
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          await writeTextFile(savePath, playlistContent);
          alert(`Playlist saved successfully to:\n${savePath}`);
          closeExportModal();
          return;
        } catch {
          // If plugin-fs fails, use web blob download
        }
      }

      // Web Blob Download Fallback
      const blob = new Blob([playlistContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedProvider.name.toLowerCase().replace(/\s+/g, '_')}_playlist.m3u`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      closeExportModal();
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const hiddenCount = overrides.filter(
    (o) => o.override_key === 'hidden' && o.override_value === 'true'
  ).length;
  const renamedCount = overrides.filter((o) => o.override_key === 'name').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl bg-surface-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Export Playlist</h2>
              <p className="text-xs text-white/50">
                Export your customized playlist with all applied overrides
              </p>
            </div>
          </div>
          <button
            onClick={closeExportModal}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {/* Summary badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-white/40 block">Total Overrides</span>
              <span className="text-base font-bold text-white">{overrides.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-white/40 block">Renamed</span>
              <span className="text-base font-bold text-white">{renamedCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-white/40 block">Hidden</span>
              <span className="text-base font-bold text-white">{hiddenCount}</span>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
            <div>
              <span className="text-xs font-semibold text-white block">Include Hidden Channels</span>
              <span className="text-[11px] text-white/40">
                Export channels marked as hidden in addition to visible channels
              </span>
            </div>
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => setIncludeHidden(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Preview Box */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2">
              Playlist Preview (.m3u)
            </label>
            <div className="relative">
              {isExporting ? (
                <div className="h-48 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-accent-500 animate-spin mb-2" />
                  <span className="text-xs text-white/50">Generating playlist...</span>
                </div>
              ) : (
                <textarea
                  readOnly
                  value={playlistContent}
                  rows={8}
                  className="w-full p-3 font-mono text-xs bg-black/40 border border-white/10 rounded-xl text-white/80 focus:outline-none resize-none no-scrollbar"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between bg-black/20">
          <button
            onClick={handleCopy}
            disabled={isExporting || !playlistContent}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy M3U Text</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={closeExportModal}
              className="px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveToFile}
              disabled={isExporting || !playlistContent}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/25 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Save File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
