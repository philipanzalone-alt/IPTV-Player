import React from 'react';
import {
  Server,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';
import type { Provider } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { useProviderStore } from '../../stores/providerStore';

interface ProviderCardProps {
  provider: Provider;
  isSelected: boolean;
  onSelect: () => void;
  onSync: () => void;
  onDelete: () => void;
  isSyncing: boolean;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isSelected,
  onSelect,
  onSync,
  onDelete,
  isSyncing,
}) => {
  const isXtream = provider.type === 'xtream';

  const isExpired =
    provider.account_expiry &&
    new Date(provider.account_expiry).getTime() < Date.now();

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col justify-between p-6 rounded-2xl cursor-pointer transition-all duration-300',
        'bg-white/[0.03] backdrop-blur-xl border shadow-xl shadow-black/40 hover:-translate-y-1',
        isSelected
          ? 'border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/30'
          : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]'
      )}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                isSelected
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-white/10 text-white/70 group-hover:text-white group-hover:bg-white/15'
              )}
            >
              {isXtream ? <Server className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-white truncate max-w-[200px]">
                  {provider.name}
                </h3>
                {isSelected && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/10 text-white/60">
                  {isXtream ? 'Xtream Codes' : 'M3U Playlist'}
                </span>
                {provider.account_status && (
                  <span
                    className={cn(
                      'text-[11px] font-medium capitalize px-2 py-0.5 rounded-md',
                      isExpired || provider.account_status.toLowerCase() === 'expired'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    )}
                  >
                    {isExpired ? 'Expired' : provider.account_status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={cn(
                'p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors',
                isSyncing && 'cursor-not-allowed opacity-75'
              )}
              title="Sync Channels & EPG"
            >
              <RefreshCw
                className={cn('w-4 h-4', isSyncing && 'animate-spin text-accent-400')}
              />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete Provider"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Details list */}
        <div className="space-y-2 text-xs text-white/60 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-white/40">
              <Globe className="w-3.5 h-3.5" />
              Source URL
            </span>
            <span className="truncate max-w-[200px] text-white/80 font-mono text-[11px]">
              {provider.server_url || provider.m3u_url || provider.m3u_local_path || 'Local File'}
            </span>
          </div>

          {isXtream && provider.username && (
            <div className="flex items-center justify-between">
              <span className="text-white/40">Username</span>
              <span className="text-white/80 font-medium">{provider.username}</span>
            </div>
          )}

          {isXtream && provider.max_connections !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-white/40">
                <Activity className="w-3.5 h-3.5" />
                Connections
              </span>
              <span className="text-white/80">
                {provider.active_connections ?? 0} / {provider.max_connections || 'Unlimited'}
              </span>
            </div>
          )}

          {isXtream && provider.account_expiry && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-white/40">
                <Clock className="w-3.5 h-3.5" />
                Expiry Date
              </span>
              <span
                className={cn(
                  isExpired ? 'text-red-400 font-semibold' : 'text-white/80'
                )}
              >
                {formatDate(provider.account_expiry)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last synced: {formatDate(provider.last_synced_at)}
        </span>
        <span className="text-accent-400/80 group-hover:text-accent-400 font-medium transition-colors">
          {isSelected ? 'Current active' : 'Click to select →'}
        </span>
      </div>
    </div>
  );
};
