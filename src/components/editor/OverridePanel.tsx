import React, { useState, useEffect } from 'react';
import {
  X,
  Edit,
  Eye,
  EyeOff,
  Image,
  Tv,
  FolderPlus,
  Save,
  RotateCcw,
  Tag,
  Layers,
  Sparkles,
  Unlink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useProviderStore } from '../../stores/providerStore';
import { useChannelStore } from '../../stores/channelStore';
import { cn } from '../../lib/utils';
import { autoMatchChannelEpg, getAvailableEpgChannels } from '../../lib/api';
import type { OverrideKey } from '../../types';

export const OverridePanel: React.FC = () => {
  const { selectedProvider } = useProviderStore();
  const { updateChannelLocal } = useChannelStore();
  const {
    selectedChannelForEdit,
    isOverridePanelOpen,
    customGroups,
    closeEditPanel,
    setOverride,
    removeOverride,
    addChannelToGroup,
    removeChannelFromGroup,
  } = useEditorStore();

  const [name, setName] = useState('');
  const [tvgId, setTvgId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isHidden, setIsHidden] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // EPG auto match & suggestions
  const [availableEpgIds, setAvailableEpgIds] = useState<string[]>([]);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState<{ message: string; success: boolean } | null>(null);

  useEffect(() => {
    if (isOverridePanelOpen) {
      getAvailableEpgChannels().then(setAvailableEpgIds).catch(console.error);
    }
  }, [isOverridePanelOpen]);

  useEffect(() => {
    if (selectedChannelForEdit) {
      setName(selectedChannelForEdit.display_name || selectedChannelForEdit.name);
      setTvgId(selectedChannelForEdit.custom_tvg_id || selectedChannelForEdit.tvg_id || '');
      setLogoUrl(selectedChannelForEdit.logo_url || '');
      setIsHidden(Boolean(selectedChannelForEdit.is_hidden));
      setPreviewError(false);
      setMatchStatus(null);

      // Check if channel belongs to any custom group
      const belongingGroup = customGroups.find((g) =>
        g.channels?.some((c) => c.id === selectedChannelForEdit.id)
      );
      setSelectedGroupId(belongingGroup ? belongingGroup.id : null);
    }
  }, [selectedChannelForEdit, customGroups]);

  const handleAutoMatch = async () => {
    if (!selectedChannelForEdit) return;
    setIsAutoMatching(true);
    setMatchStatus(null);
    try {
      const match = await autoMatchChannelEpg(selectedChannelForEdit.id);
      if (match) {
        setTvgId(match);
        setMatchStatus({ message: `Matched with "${match}"!`, success: true });
      } else {
        setMatchStatus({ message: 'No confident match found in active EPG guide.', success: false });
      }
    } catch (err) {
      setMatchStatus({ message: 'Failed to auto match EPG.', success: false });
    } finally {
      setIsAutoMatching(false);
    }
  };

  const handleUnlinkEpg = () => {
    setTvgId('');
    setMatchStatus({ message: 'EPG mapping unlinked', success: true });
  };

  if (!isOverridePanelOpen || !selectedChannelForEdit || !selectedProvider) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const providerId = selectedProvider.id;
    const channelId = selectedChannelForEdit.id;

    try {
      // 1. Name override
      if (name.trim() !== selectedChannelForEdit.name) {
        await setOverride(providerId, 'channel', channelId, 'name', name.trim());
      } else {
        await removeOverride(providerId, 'channel', channelId, 'name');
      }

      // 2. TVG-ID override
      if (tvgId.trim()) {
        await setOverride(providerId, 'channel', channelId, 'tvg_id', tvgId.trim());
      } else {
        await removeOverride(providerId, 'channel', channelId, 'tvg_id');
      }

      // 3. Logo URL override
      if (logoUrl.trim()) {
        await setOverride(providerId, 'channel', channelId, 'logo_url', logoUrl.trim());
      } else {
        await removeOverride(providerId, 'channel', channelId, 'logo_url');
      }

      // 4. Hidden override
      await setOverride(
        providerId,
        'channel',
        channelId,
        'hidden',
        isHidden ? 'true' : 'false'
      );

      // 5. Custom Group association
      if (selectedGroupId !== null) {
        await addChannelToGroup(selectedGroupId, channelId);
      }

      // Update in local channelStore
      updateChannelLocal(channelId, {
        display_name: name.trim() || selectedChannelForEdit.name,
        custom_tvg_id: tvgId.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        is_hidden: isHidden,
      });

      closeEditPanel();
    } catch (err) {
      console.error('Failed to save override:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setName(selectedChannelForEdit.name);
    setTvgId(selectedChannelForEdit.tvg_id || '');
    setLogoUrl(selectedChannelForEdit.logo_url || '');
    setIsHidden(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md h-full bg-surface-900/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Channel Details</h2>
              <p className="text-xs text-white/50">Configure custom overrides & visibility</p>
            </div>
          </div>
          <button
            onClick={closeEditPanel}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
          {/* Logo Preview & Input */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2">
              Channel Logo
            </label>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl && !previewError ? (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    onError={() => setPreviewError(true)}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Tv className="w-6 h-6 text-white/40" />
                )}
              </div>
              <div className="flex-1 text-xs text-white/50">
                Provide an image URL (PNG, SVG, or JPG). If invalid, a default placeholder will display.
              </div>
            </div>
            <div className="relative">
              <Image className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  setPreviewError(false);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Channel Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Custom channel name"
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
              required
            />
            <span className="text-[11px] text-white/40 mt-1 block">
              Original: {selectedChannelForEdit.name}
            </span>
          </div>

          {/* Custom tvg-id mapping */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-white/70">
                Custom TVG-ID (EPG Matching)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoMatch}
                  disabled={isAutoMatching}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 text-[11px] font-medium border border-accent-500/30 transition-all disabled:opacity-50"
                  title="Automatically find the best matching EPG guide channel"
                >
                  {isAutoMatching ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-accent-400" />
                  )}
                  Auto-Match
                </button>
                {tvgId && (
                  <button
                    type="button"
                    onClick={handleUnlinkEpg}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[11px] font-medium border border-red-500/20 transition-all"
                    title="Unlink EPG from this channel"
                  >
                    <Unlink className="w-3 h-3" />
                    Unlink
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                list="epg-suggestions-list"
                value={tvgId}
                onChange={(e) => {
                  setTvgId(e.target.value);
                  setMatchStatus(null);
                }}
                placeholder="Select or type EPG ID (e.g. ESPN.us or BBC1.uk)"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
              />
              <datalist id="epg-suggestions-list">
                {availableEpgIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </div>
            {matchStatus && (
              <div
                className={cn(
                  'mt-1.5 text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-lg',
                  matchStatus.success
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                )}
              >
                {matchStatus.success && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {matchStatus.message}
              </div>
            )}
            <span className="text-[11px] text-white/40 mt-1 block">
              {availableEpgIds.length > 0
                ? `${availableEpgIds.length} EPG channels loaded in guide database.`
                : 'No EPG channels loaded yet. Add an EPG source in Settings.'}
            </span>
          </div>

          {/* Custom Group Assignment */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Assign to Custom Group
            </label>
            <div className="relative">
              <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) =>
                  setSelectedGroupId(e.target.value ? parseInt(e.target.value, 10) : null)
                }
                className="w-full pl-10 pr-3.5 py-2.5 bg-surface-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-accent-500 transition-all"
              >
                <option value="">No Custom Group</option>
                {customGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              {isHidden ? (
                <EyeOff className="w-5 h-5 text-red-400" />
              ) : (
                <Eye className="w-5 h-5 text-accent-400" />
              )}
              <div>
                <span className="text-xs font-semibold text-white block">
                  {isHidden ? 'Channel is Hidden' : 'Channel is Visible'}
                </span>
                <span className="text-[11px] text-white/50">
                  Hidden channels do not show up in the main guide or list.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsHidden(!isHidden)}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative flex items-center p-1',
                isHidden ? 'bg-red-500/40' : 'bg-accent-500'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200',
                  isHidden ? 'translate-x-0' : 'translate-x-6'
                )}
              />
            </button>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors pt-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset fields to source defaults
          </button>
        </form>

        {/* Panel Footer */}
        <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3 bg-black/20">
          <button
            type="button"
            onClick={closeEditPanel}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-xl shadow-lg shadow-accent-500/25 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  );
};
