import React, { useState } from 'react';
import {
  Tv,
  Film,
  Folder,
  Heart,
  Calendar,
  Server,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Radio,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useChannelStore } from '../stores/channelStore';
import { useProviderStore } from '../stores/providerStore';
import { useEpgStore } from '../stores/epgStore';
import type { AppPage, ContentType } from '../types';
import { cn, formatDate } from '../lib/utils';

interface NavItem {
  id: string;
  label: string;
  page: AppPage;
  contentType?: ContentType;
  icon: React.ElementType;
  badge?: string;
  isSpecialCategory?: string;
}

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);

  const { currentPage, contentType, setPage, setContentType, setSelectedCategory } =
    useChannelStore();
  const { providers, selectedProvider, selectProvider } = useProviderStore();
  const { isSyncing, lastSyncedAt, syncAllSources } = useEpgStore();

  const navItems: NavItem[] = [
    {
      id: 'live',
      label: 'Live TV',
      page: 'channels',
      contentType: 'live',
      icon: Tv,
    },
    {
      id: 'vod',
      label: 'Movies (VOD)',
      page: 'channels',
      contentType: 'vod',
      icon: Film,
    },
    {
      id: 'series',
      label: 'Series',
      page: 'channels',
      contentType: 'series',
      icon: Folder,
    },
    {
      id: 'favorites',
      label: 'Favorites',
      page: 'channels',
      icon: Heart,
      isSpecialCategory: 'favorites',
    },
    {
      id: 'epg',
      label: 'TV Guide (EPG)',
      page: 'epg',
      icon: Calendar,
    },
    {
      id: 'settings',
      label: 'Settings',
      page: 'settings',
      icon: Settings,
    },
  ];

  const handleNavClick = (item: NavItem) => {
    setPage(item.page);
    if (item.contentType) {
      setContentType(item.contentType);
      setSelectedCategory(null);
    } else if (item.isSpecialCategory) {
      setSelectedCategory({
        id: -1,
        provider_id: selectedProvider?.id || 0,
        remote_id: 'favorites',
        name: 'Favorites',
        type: 'live',
        sort_order: 0,
      });
    }
  };

  const isNavActive = (item: NavItem) => {
    if (item.page !== currentPage) return false;
    if (item.page === 'channels') {
      if (item.isSpecialCategory) {
        return useChannelStore.getState().selectedCategory?.remote_id === 'favorites';
      }
      return (
        contentType === item.contentType &&
        useChannelStore.getState().selectedCategory?.remote_id !== 'favorites'
      );
    }
    return true;
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-surface-950/80 backdrop-blur-2xl border-r border-white/10 transition-all duration-300 z-30 select-none',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08] h-16 bg-white/[0.01]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-md shadow-indigo-500/25 text-white shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                StreamFlow
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">PRO</span>
              </span>
              <span className="text-[10px] text-white/40 tracking-wider uppercase font-semibold">
                IPTV Studio
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Navigation
          </div>
        )}
        {navItems.map((item) => {
          const active = isNavActive(item);
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center w-full gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 select-none active:scale-[0.98]',
                active
                  ? 'bg-indigo-600/20 text-white border border-indigo-500/40 shadow-sm shadow-indigo-500/10 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
              )}
            >
              <IconComponent
                className={cn(
                  'w-4 h-4 transition-transform duration-200 shrink-0 group-hover:scale-110',
                  active ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'
                )}
              />
              {!collapsed && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white/10 text-white/70">
                  {item.badge}
                </span>
              )}
              {active && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-500 rounded-l-full shadow-md shadow-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* EPG Sync Status */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <RefreshCw
                className={cn(
                  'w-3 h-3 shrink-0',
                  isSyncing ? 'animate-spin text-accent-400' : 'text-white/30'
                )}
              />
              <span className="text-white/40 truncate">
                {isSyncing
                  ? 'Syncing EPG…'
                  : lastSyncedAt
                  ? `EPG: ${formatDate(lastSyncedAt.toISOString())}`
                  : 'EPG not synced'}
              </span>
            </div>
            {!isSyncing && selectedProvider && (
              <button
                onClick={() => syncAllSources(selectedProvider.id)}
                className="ml-2 text-accent-400 hover:text-accent-300 shrink-0 transition-colors"
                title="Sync EPG now"
              >
                Sync
              </button>
            )}
          </div>
        </div>
      )}

      {/* Provider Selector Footer */}
      <div className="p-3 border-t border-white/10 bg-black/20">
        <div className="relative">
          <button
            onClick={() => setProviderMenuOpen(!providerMenuOpen)}
            className={cn(
              'w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all text-left',
              collapsed && 'justify-center p-2'
            )}
            title={selectedProvider ? selectedProvider.name : 'No Provider Selected'}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4 text-accent-400" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {selectedProvider ? selectedProvider.name : 'No Provider'}
                </div>
                <div className="text-[10px] text-white/40 truncate capitalize">
                  {selectedProvider ? `${selectedProvider.type} stream` : 'Click to select'}
                </div>
              </div>
            )}
            {!collapsed && (
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-white/40 transition-transform duration-200',
                  providerMenuOpen && 'rotate-180'
                )}
              />
            )}
          </button>

          {/* Provider Dropdown Popup */}
          {providerMenuOpen && (
            <div
              className={cn(
                'absolute bottom-full mb-2 bg-surface-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2 z-50',
                collapsed ? 'left-full ml-2 w-56 bottom-0' : 'left-0 right-0'
              )}
            >
              <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40 border-b border-white/10 mb-1 flex items-center justify-between">
                <span>Select Provider</span>
                <button
                  onClick={() => {
                    setProviderMenuOpen(false);
                    setPage('providers');
                  }}
                  className="text-accent-400 hover:text-accent-300 text-[11px] lowercase"
                >
                  manage
                </button>
              </div>

              {providers.length === 0 ? (
                <div className="p-3 text-center text-xs text-white/40">
                  No providers found.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {providers.map((p) => {
                    const isSelected = selectedProvider?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          selectProvider(p);
                          setProviderMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left',
                          isSelected
                            ? 'bg-accent-500/20 text-white font-medium border border-accent-500/40'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <div className="truncate">
                          <div className="truncate">{p.name}</div>
                          <div className="text-[10px] text-white/40 uppercase">{p.type}</div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
