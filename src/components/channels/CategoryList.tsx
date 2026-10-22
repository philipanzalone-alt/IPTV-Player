import React, { useState, useEffect } from 'react';
import {
  Search,
  Layers,
  Heart,
  Loader2,
  X,
  Plus,
  Trash2,
  Bookmark,
  Check,
  ListFilter,
} from 'lucide-react';
import { useChannelStore } from '../../stores/channelStore';
import { useProviderStore } from '../../stores/providerStore';
import { cn } from '../../lib/utils';

export const CategoryList: React.FC = () => {
  const { selectedProvider } = useProviderStore();
  const {
    categories,
    selectedCategory,
    customPlaylists,
    selectedCustomPlaylist,
    contentType,
    isLoadingCategories,
    fetchCategories,
    fetchCustomPlaylists,
    setSelectedCategory,
    setSelectedCustomPlaylist,
    createCustomPlaylist,
    deleteCustomPlaylist,
  } = useChannelStore();

  const [categorySearch, setCategorySearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [modalFilterSearch, setModalFilterSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories when provider or contentType changes
  useEffect(() => {
    if (selectedProvider) {
      fetchCategories(selectedProvider.id, contentType);
    }
  }, [selectedProvider, contentType, fetchCategories]);

  // Fetch custom playlists on mount
  useEffect(() => {
    fetchCustomPlaylists();
  }, [fetchCustomPlaylists]);

  const filteredCategories = categories.filter(
    (cat) => !cat.is_hidden && cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const modalFilteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(modalFilterSearch.toLowerCase())
  );

  const isAllSelected = selectedCategory === null && selectedCustomPlaylist === null;
  const isFavoritesSelected = selectedCategory?.remote_id === 'favorites';

  const totalChannelsCount = categories.reduce(
    (sum, cat) => sum + (cat.channel_count || 0),
    0
  );

  const handleOpenModal = () => {
    setNewPlaylistName('');
    setSelectedCatIds([]);
    setModalFilterSearch('');
    setIsModalOpen(true);
  };

  const handleToggleCatId = (id: number) => {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = modalFilteredCategories.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedCatIds.includes(id));
    if (allSelected) {
      setSelectedCatIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedCatIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || selectedCatIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await createCustomPlaylist(newPlaylistName.trim(), selectedCatIds);
      setIsModalOpen(false);
      setNewPlaylistName('');
      setSelectedCatIds([]);
    } catch (err) {
      console.error('Failed to create custom playlist:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-64 h-full flex flex-col bg-surface-950/40 backdrop-blur-xl border-r border-white/10 select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Filter categories..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/70 transition-all shadow-inner"
          />
          {categorySearch && (
            <button
              onClick={() => setCategorySearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
        {/* All Channels Option */}
        <button
          onClick={() => {
            setSelectedCategory(null);
            setSelectedCustomPlaylist(null);
          }}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.98]',
            isAllSelected
              ? 'bg-indigo-600/20 text-white border border-indigo-500/40 shadow-sm shadow-indigo-500/10 font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <Layers className={cn('w-4 h-4', isAllSelected ? 'text-indigo-400' : 'text-slate-500')} />
            <span className="truncate">All Channels</span>
          </div>
          {totalChannelsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.08] text-slate-300">
              {totalChannelsCount}
            </span>
          )}
        </button>

        {/* Favorites Special Category */}
        <button
          onClick={() => {
            setSelectedCategory({
              id: -1,
              provider_id: selectedProvider?.id || 0,
              remote_id: 'favorites',
              name: 'Favorites',
              type: 'live',
              sort_order: 0,
            });
            setSelectedCustomPlaylist(null);
          }}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.98]',
            isFavoritesSelected
              ? 'bg-amber-500/15 text-white border border-amber-500/40 shadow-sm shadow-amber-500/10 font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <Heart
              className={cn(
                'w-4 h-4',
                isFavoritesSelected ? 'text-amber-400 fill-amber-400' : 'text-amber-400/60'
              )}
            />
            <span className="truncate">Favorites</span>
          </div>
        </button>

        {/* Custom Playlists Section */}
        <div className="pt-3 pb-1 px-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
            <Bookmark className="w-3 h-3 text-indigo-400" />
            Custom Playlists
          </span>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1 text-[11px] text-accent-400 hover:text-accent-300 font-semibold px-1.5 py-0.5 rounded-md hover:bg-white/5 transition-colors"
            title="Create Custom Playlist of Categories"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {customPlaylists.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-white/30 italic">
            No custom playlists created yet.
          </div>
        ) : (
          customPlaylists.map((playlist) => {
            const isSelected = selectedCustomPlaylist?.id === playlist.id;
            const catCount = playlist.category_ids?.length || 0;

            return (
              <div
                key={playlist.id}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all group',
                  isSelected
                    ? 'bg-accent-500/25 text-white font-semibold border border-accent-500/50 shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                )}
              >
                <button
                  onClick={() => setSelectedCustomPlaylist(playlist)}
                  className="flex-1 flex items-center gap-2 truncate text-left"
                >
                  <ListFilter
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      isSelected ? 'text-accent-400' : 'text-white/40'
                    )}
                  />
                  <span className="truncate">{playlist.name}</span>
                </button>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md text-[9px] font-bold',
                      isSelected
                        ? 'bg-accent-500/40 text-white'
                        : 'bg-white/5 text-white/40 group-hover:bg-white/10'
                    )}
                    title={`${catCount} categories included`}
                  >
                    {catCount} {catCount === 1 ? 'cat' : 'cats'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomPlaylist(playlist.id);
                    }}
                    className="p-1 rounded text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Standard Categories Header */}
        <div className="pt-3 pb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-white/30">
          Categories ({filteredCategories.length})
        </div>

        {/* Categories from provider */}
        {isLoadingCategories ? (
          <div className="flex items-center justify-center p-8 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-4 text-center text-xs text-white/30">
            {categorySearch ? 'No matching categories' : 'No categories available'}
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const isSelected = selectedCategory?.id === cat.id && !selectedCustomPlaylist;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left group active:scale-[0.98]',
                  isSelected
                    ? 'bg-indigo-600/20 text-white font-semibold border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                )}
              >
                <span className="truncate mr-2">{cat.name}</span>
                {cat.channel_count !== undefined && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors shrink-0',
                      isSelected
                        ? 'bg-indigo-500/40 text-white'
                        : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
                    )}
                  >
                    {cat.channel_count}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Modal: Create Custom Playlist consisting of Categories */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-900 border border-white/15 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-5 h-5 text-accent-400" />
                <h3 className="text-base font-bold text-white">Create Custom Playlist</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              {/* Playlist Name Input */}
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Playlist Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sports & News, Family Movies..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                  required
                  autoFocus
                />
              </div>

              {/* Category Selection Filter & Actions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Select Categories ({selectedCatIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-[11px] text-accent-400 hover:text-accent-300 font-semibold"
                  >
                    Select/Deselect Filtered
                  </button>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search categories to add..."
                    value={modalFilterSearch}
                    onChange={(e) => setModalFilterSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent-500 transition-all"
                  />
                </div>

                {/* Categories Checkbox List */}
                <div className="max-h-56 overflow-y-auto space-y-1 p-2 rounded-xl bg-black/30 border border-white/10">
                  {modalFilteredCategories.length === 0 ? (
                    <div className="p-4 text-center text-xs text-white/30">
                      No matching categories found
                    </div>
                  ) : (
                    modalFilteredCategories.map((cat) => {
                      const isChecked = selectedCatIds.includes(cat.id);
                      return (
                        <div
                          key={cat.id}
                          onClick={() => handleToggleCatId(cat.id)}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors',
                            isChecked
                              ? 'bg-accent-500/20 text-white border border-accent-500/30'
                              : 'text-white/70 hover:bg-white/5 border border-transparent'
                          )}
                        >
                          <span className="truncate mr-2">{cat.name}</span>
                          <div
                            className={cn(
                              'w-4 h-4 rounded flex items-center justify-center transition-colors',
                              isChecked ? 'bg-accent-500 text-white' : 'border border-white/20'
                            )}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || selectedCatIds.length === 0 || isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-lg shadow-accent-500/20 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryList;
