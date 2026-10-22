import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  SlidersHorizontal,
  GripVertical,
  Eye,
  EyeOff,
  Edit,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  Layers,
  Search,
  Tv,
  Check,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
  FolderPlus,
} from 'lucide-react';
import { useProviderStore } from '../../stores/providerStore';
import { useEditorStore } from '../../stores/editorStore';
import { useChannelStore } from '../../stores/channelStore';
import { OverridePanel } from './OverridePanel';
import { ExportModal } from './ExportModal';
import type { Channel, Category } from '../../types';
import { cn } from '../../lib/utils';
import * as api from '../../lib/api';

// ─── Sortable Channel Item ───
interface SortableChannelItemProps {
  channel: Channel;
  index: number;
  totalCount: number;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SortableChannelItem: React.FC<SortableChannelItemProps> = ({
  channel,
  index,
  totalCount,
  onEdit,
  onToggleVisibility,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = channel.display_name || channel.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center justify-between p-3 rounded-xl border transition-all duration-150 select-none',
        isDragging
          ? 'bg-accent-500/20 border-accent-500 shadow-2xl z-50 scale-[1.01]'
          : channel.is_hidden
          ? 'bg-black/40 border-white/5 opacity-60 hover:opacity-100'
          : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-white/30 hover:text-white/80 transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Channel Logo */}
        <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {channel.logo_url ? (
            <img
              src={channel.logo_url}
              alt={displayName}
              className="w-full h-full object-contain p-0.5"
            />
          ) : (
            <Tv className="w-4 h-4 text-white/40" />
          )}
        </div>

        {/* Channel Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs font-semibold truncate',
                channel.is_hidden ? 'text-white/40 line-through' : 'text-white'
              )}
            >
              {displayName}
            </span>
            {channel.is_hidden && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                Hidden
              </span>
            )}
            {channel.display_name && channel.display_name !== channel.name && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent-500/20 text-accent-400 border border-accent-500/30">
                Renamed
              </span>
            )}
            {channel.custom_tvg_id && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                EPG
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/40 truncate block font-mono">
            {channel.custom_tvg_id || channel.tvg_id || 'No TVG-ID'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 ml-3">
        {/* Reorder Buttons */}
        <div className="flex items-center gap-0.5 mr-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-white/30 hover:text-white disabled:opacity-20 rounded transition-colors"
            title="Move Up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalCount - 1}
            className="p-1 text-white/30 hover:text-white disabled:opacity-20 rounded transition-colors"
            title="Move Down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hide / Show Channel Toggle */}
        <button
          onClick={onToggleVisibility}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
            channel.is_hidden
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
          )}
          title={channel.is_hidden ? 'Click to Unhide Channel' : 'Click to Hide Channel'}
        >
          {channel.is_hidden ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hidden</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Visible</span>
            </>
          )}
        </button>

        {/* Edit Details */}
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="Edit Channel Details"
        >
          <Edit className="w-4 h-4" />
        </button>

        {/* Delete Channel */}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete Channel from Playlist"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Main PlaylistEditor Component ───
interface PlaylistEditorProps {
  embedded?: boolean;
}

export const PlaylistEditor: React.FC<PlaylistEditorProps> = ({ embedded = false }) => {
  const { selectedProvider } = useProviderStore();
  const {
    overrides,
    customGroups,
    fetchOverrides,
    setOverride,
    removeOverride,
    fetchCustomGroups,
    createCustomGroup,
    deleteCustomGroup,
    openEditPanel,
    openExportModal,
  } = useEditorStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [channelVisibilityFilter, setChannelVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Load all categories for provider
  const loadCategories = useCallback(async () => {
    if (!selectedProvider) return;
    try {
      const cats = await api.getCategories(selectedProvider.id, 'all');
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, [selectedProvider]);

  // Load channels for selected category
  const loadCategoryChannels = useCallback(async (catId: number | null) => {
    if (!selectedProvider) return;
    setIsLoadingChannels(true);
    try {
      const chs = await api.getChannels(selectedProvider.id, catId ?? undefined);
      setChannels(chs);
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (selectedProvider) {
      loadCategories();
      fetchOverrides(selectedProvider.id);
      fetchCustomGroups();
    }
  }, [selectedProvider, loadCategories, fetchOverrides, fetchCustomGroups]);

  useEffect(() => {
    loadCategoryChannels(selectedCategoryId);
  }, [selectedCategoryId, loadCategoryChannels]);

  // ─── Category Handlers ───

  // Hide / Unhide Category
  const handleToggleCategoryVisibility = async (cat: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedProvider) return;

    const nextHidden = !cat.is_hidden;
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_hidden: nextHidden } : c))
    );

    try {
      await setOverride(
        selectedProvider.id,
        'category',
        cat.id,
        'hidden',
        nextHidden ? 'true' : 'false'
      );
    } catch (err) {
      console.error('Failed to toggle category hidden override:', err);
    }
  };

  // Remove Category Completely
  const handleDeleteCategory = async (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to remove the category "${cat.name}" and all its channels from your playlist?`
      )
    ) {
      return;
    }

    try {
      await api.deleteCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (selectedCategoryId === cat.id) {
        setSelectedCategoryId(null);
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category: ' + err);
    }
  };

  // Reorder Categories: Move Up
  const handleMoveCategoryUp = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index <= 0 || !selectedProvider) return;
    const reordered = arrayMove(categories, index, index - 1);
    setCategories(reordered);
    try {
      await api.reorderCategories(
        selectedProvider.id,
        reordered.map((c) => c.id)
      );
    } catch (err) {
      console.error('Failed to save category order:', err);
    }
  };

  // Reorder Categories: Move Down
  const handleMoveCategoryDown = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index >= categories.length - 1 || !selectedProvider) return;
    const reordered = arrayMove(categories, index, index + 1);
    setCategories(reordered);
    try {
      await api.reorderCategories(
        selectedProvider.id,
        reordered.map((c) => c.id)
      );
    } catch (err) {
      console.error('Failed to save category order:', err);
    }
  };

  // Keep Only Sweden / SE Categories
  const handleKeepOnlySweden = async () => {
    if (!selectedProvider) return;
    if (
      !window.confirm(
        'Hide all categories not marked as Sweden or SE? Only Sweden categories will remain visible.'
      )
    ) {
      return;
    }
    try {
      const count = await api.keepOnlySwedenCategories(selectedProvider.id);
      await loadCategories();
      await loadCategoryChannels(selectedCategoryId);
      alert(`Done! Hid ${count} non-Swedish categories.`);
    } catch (err) {
      console.error('Failed to filter Sweden categories:', err);
    }
  };

  // ─── Channel Handlers ───

  // Toggle Single Channel Visibility
  const handleToggleChannelVisibility = async (channel: Channel) => {
    if (!selectedProvider) return;
    const nextHidden = !channel.is_hidden;

    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_hidden: nextHidden } : c))
    );

    try {
      await setOverride(
        selectedProvider.id,
        'channel',
        channel.id,
        'hidden',
        nextHidden ? 'true' : 'false'
      );
    } catch (err) {
      console.error('Failed to toggle channel visibility:', err);
    }
  };

  // Delete Channel Permanently
  const handleDeleteChannel = async (channel: Channel) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently remove "${channel.display_name || channel.name}"?`
      )
    ) {
      return;
    }

    try {
      await api.deleteChannel(channel.id);
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
    } catch (err) {
      console.error('Failed to delete channel:', err);
      alert('Failed to delete channel: ' + err);
    }
  };

  // Move Channel Up / Down
  const handleMoveChannel = async (index: number, direction: 'up' | 'down') => {
    if (!selectedProvider) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= channels.length) return;

    const reordered = arrayMove(channels, index, targetIndex);
    setChannels(reordered);

    try {
      await api.reorderChannels(
        selectedProvider.id,
        reordered.map((c) => c.id)
      );
    } catch (err) {
      console.error('Failed to save channel order:', err);
    }
  };

  // Bulk Hide / Show All in Current View
  const handleBulkToggleCurrentChannels = async (hide: boolean) => {
    if (!selectedProvider || filteredChannels.length === 0) return;

    setChannels((prev) =>
      prev.map((c) => {
        const isInFiltered = filteredChannels.some((fc) => fc.id === c.id);
        return isInFiltered ? { ...c, is_hidden: hide } : c;
      })
    );

    try {
      for (const ch of filteredChannels) {
        await setOverride(
          selectedProvider.id,
          'channel',
          ch.id,
          'hidden',
          hide ? 'true' : 'false'
        );
      }
    } catch (err) {
      console.error('Bulk toggle failed:', err);
    }
  };

  // DnD Reorder for Channels
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedProvider) return;

    const oldIndex = channels.findIndex((c) => c.id === active.id);
    const newIndex = channels.findIndex((c) => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(channels, oldIndex, newIndex);
      setChannels(reordered);

      try {
        await api.reorderChannels(
          selectedProvider.id,
          reordered.map((c) => c.id)
        );
      } catch (err) {
        console.error('Failed to save sort override:', err);
      }
    }
  };

  // Custom Groups
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsCreatingGroup(true);
    try {
      await createCustomGroup(newGroupName.trim());
      setNewGroupName('');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Reset Overrides
  const handleResetOverrides = async () => {
    if (
      !selectedProvider ||
      !window.confirm(
        'Are you sure you want to reset all channel and category overrides for this provider? This will restore original names, order, and visibility.'
      )
    ) {
      return;
    }

    try {
      for (const ov of overrides) {
        await removeOverride(
          selectedProvider.id,
          ov.target_type,
          ov.target_id,
          ov.override_key as any
        );
      }
      loadCategories();
      loadCategoryChannels(selectedCategoryId);
    } catch (err) {
      console.error('Reset overrides failed:', err);
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (categoryFilter === 'visible' && cat.is_hidden) return false;
      if (categoryFilter === 'hidden' && !cat.is_hidden) return false;
      if (!categorySearch.trim()) return true;
      return cat.name.toLowerCase().includes(categorySearch.toLowerCase());
    });
  }, [categories, categoryFilter, categorySearch]);

  // Filtered channels
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      if (channelVisibilityFilter === 'visible' && ch.is_hidden) return false;
      if (channelVisibilityFilter === 'hidden' && !ch.is_hidden) return false;
      if (!channelSearch.trim()) return true;
      const q = channelSearch.toLowerCase();
      const name = (ch.display_name || ch.name).toLowerCase();
      const tvg = (ch.custom_tvg_id || ch.tvg_id || '').toLowerCase();
      return name.includes(q) || tvg.includes(q);
    });
  }, [channels, channelVisibilityFilter, channelSearch]);

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div
      className={cn(
        'flex-1 flex flex-col h-full overflow-hidden select-none',
        embedded ? 'bg-transparent' : 'bg-surface-900'
      )}
    >
      {/* Top Action Bar (only if not embedded) */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-950/40 backdrop-blur-xl gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Playlist Editor</h1>
              <p className="text-xs text-white/50">
                Organize categories, remove/hide channels, and rearrange channel order
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetOverrides}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
              title="Reset all overrides"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Overrides</span>
            </button>

            <button
              onClick={openExportModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export M3U</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT PANEL: Categories & Management ─── */}
        <div className="w-80 shrink-0 border-r border-white/10 bg-surface-950/40 flex flex-col overflow-hidden">
          {/* Header & Filter Controls */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                Categories ({categories.length})
              </span>
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors',
                  selectedCategoryId === null
                    ? 'bg-accent-500 text-white'
                    : 'text-white/40 hover:text-white bg-white/5'
                )}
              >
                All Channels
              </button>
            </div>

            {/* Category Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
              {(['all', 'visible', 'hidden'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCategoryFilter(filter)}
                  className={cn(
                    'flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wider capitalize transition-all',
                    categoryFilter === filter
                      ? 'bg-accent-500 text-white'
                      : 'text-white/40 hover:text-white'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Quick action: Keep only Sweden / SE categories */}
            <button
              onClick={handleKeepOnlySweden}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-all shadow-sm"
              title="Hide all categories not marked as Sweden or SE"
            >
              <span>🇸🇪</span>
              <span>Hide All Non-Sweden Categories</span>
            </button>
          </div>

          {/* Categories List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
            {filteredCategories.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/40">No categories found.</div>
            ) : (
              filteredCategories.map((cat, idx) => {
                const isSelected = selectedCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={cn(
                      'group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border',
                      isSelected
                        ? 'bg-accent-500/20 text-white font-semibold border-accent-500/40 shadow-sm'
                        : cat.is_hidden
                        ? 'bg-black/30 border-transparent text-white/40 hover:bg-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/5 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <span
                        className={cn(
                          'truncate font-medium text-xs',
                          cat.is_hidden && 'line-through text-white/40'
                        )}
                      >
                        {cat.name}
                      </span>
                      {cat.channel_count !== undefined && (
                        <span className="text-[10px] text-white/30 shrink-0">
                          ({cat.channel_count})
                        </span>
                      )}
                      {cat.is_hidden && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-red-500/20 text-red-300 shrink-0">
                          Hidden
                        </span>
                      )}
                    </div>

                    {/* Category Action Controls */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Reorder Buttons */}
                      <button
                        onClick={(e) => handleMoveCategoryUp(idx, e)}
                        disabled={idx === 0}
                        className="p-1 text-white/40 hover:text-white disabled:opacity-20 rounded"
                        title="Move Category Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleMoveCategoryDown(idx, e)}
                        disabled={idx === categories.length - 1}
                        className="p-1 text-white/40 hover:text-white disabled:opacity-20 rounded"
                        title="Move Category Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Hide/Show Toggle */}
                      <button
                        onClick={(e) => handleToggleCategoryVisibility(cat, e)}
                        className={cn(
                          'p-1 rounded transition-colors',
                          cat.is_hidden
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-white/40 hover:text-accent-400'
                        )}
                        title={cat.is_hidden ? 'Show Category' : 'Hide Category'}
                      >
                        {cat.is_hidden ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Remove Category */}
                      <button
                        onClick={(e) => handleDeleteCategory(cat, e)}
                        className="p-1 text-white/30 hover:text-red-400 rounded transition-colors"
                        title="Remove Category and Channels"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Custom Groups Section */}
          <div className="p-3 border-t border-white/10 bg-black/20">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
              Custom Groups ({customGroups.length})
            </span>

            <form onSubmit={handleCreateGroup} className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="New group name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500"
              />
              <button
                type="submit"
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="p-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white rounded-lg transition-colors"
                title="Create Group"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="max-h-24 overflow-y-auto space-y-1 no-scrollbar">
              {customGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white/5 text-xs text-white/80"
                >
                  <span className="truncate">{group.name}</span>
                  <button
                    onClick={() => deleteCustomGroup(group.id)}
                    className="p-1 text-white/30 hover:text-red-400 transition-colors"
                    title="Delete Group"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Channels List & Hiding ─── */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-black/10">
          {/* Channels Header Toolbar */}
          <div className="p-4 border-b border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {/* Channel Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                />
              </div>

              {/* Visibility Filter */}
              <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                {(['all', 'visible', 'hidden'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setChannelVisibilityFilter(filter)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all',
                      channelVisibilityFilter === filter
                        ? 'bg-accent-500 text-white'
                        : 'text-white/50 hover:text-white'
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkToggleCurrentChannels(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold border border-red-500/20 transition-all"
                title="Hide all channels in current list"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Hide All
              </button>
              <button
                onClick={() => handleBulkToggleCurrentChannels(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/20 transition-all"
                title="Show all channels in current list"
              >
                <Eye className="w-3.5 h-3.5" />
                Show All
              </button>
              <div className="text-xs text-white/40 pl-2">
                {filteredChannels.length} channels
              </div>
            </div>
          </div>

          {/* DnD Channel List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {isLoadingChannels ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-white/40">
                <Loader2 className="w-6 h-6 animate-spin text-accent-400" />
                <span className="text-xs">Loading category channels...</span>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40">
                {selectedCategoryObj
                  ? `No channels found in "${selectedCategoryObj.name}" for this filter.`
                  : 'No channels match the active search or filter.'}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredChannels.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredChannels.map((channel, idx) => (
                    <SortableChannelItem
                      key={channel.id}
                      channel={channel}
                      index={idx}
                      totalCount={filteredChannels.length}
                      onEdit={() => openEditPanel(channel)}
                      onToggleVisibility={() => handleToggleChannelVisibility(channel)}
                      onDelete={() => handleDeleteChannel(channel)}
                      onMoveUp={() => handleMoveChannel(idx, 'up')}
                      onMoveDown={() => handleMoveChannel(idx, 'down')}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Override Edit Drawer */}
      <OverridePanel />

      {/* Export Playlist Modal */}
      <ExportModal />
    </div>
  );
};
