import React, { useState, useEffect } from 'react';
import { Plus, Server, Radio, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useProviderStore } from '../../stores/providerStore';
import { ProviderCard } from './ProviderCard';
import { AddProviderModal } from './AddProviderModal';

export const ProviderList: React.FC = () => {
  const {
    providers,
    selectedProvider,
    isLoading,
    isSyncingId,
    error,
    fetchProviders,
    selectProvider,
    syncProvider,
    deleteProvider,
    clearError,
  } = useProviderStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this provider? All cached channels and categories will be removed.')) {
      try {
        await deleteProvider(id);
      } catch (err) {
        console.error('Delete provider failed:', err);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 no-scrollbar">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">IPTV Providers & Sources</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage your Xtream Codes accounts and M3U playlist subscriptions
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-accent-500/20 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-xs uppercase font-bold text-red-400 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Providers Content */}
      {isLoading && providers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin mb-3" />
          <p className="text-sm text-white/50">Loading providers...</p>
        </div>
      ) : providers.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white/[0.02] border border-white/5 min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 mb-4 shadow-xl shadow-accent-500/5">
            <Server className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No IPTV Providers Added Yet</h2>
          <p className="text-sm text-white/50 max-w-md mb-6">
            Connect an Xtream Codes server or import an M3U / M3U8 playlist to start watching live TV, movies, and series.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm rounded-xl shadow-xl shadow-accent-500/25 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Add Your First Provider
          </button>
        </div>
      ) : (
        /* Providers Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isSelected={selectedProvider?.id === provider.id}
              onSelect={() => selectProvider(provider)}
              onSync={() => syncProvider(provider.id)}
              onDelete={() => handleDelete(provider.id)}
              isSyncing={isSyncingId === provider.id}
            />
          ))}
        </div>
      )}

      {/* Add Provider Modal */}
      <AddProviderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
