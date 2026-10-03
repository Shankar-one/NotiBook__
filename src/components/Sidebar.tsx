import React from 'react';
import { 
  LayoutGrid, 
  Users, 
  BookOpen, 
  Settings, 
  Mic, 
  ChevronLeft, 
  ChevronRight,
  LogOut 
} from 'lucide-react';
import { ShopSettings } from '../types';

interface SidebarProps {
  activeTab: 'home' | 'customers' | 'book';
  setActiveTab: (tab: 'home' | 'customers' | 'book') => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  settings: ShopSettings;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  onLogout?: () => void;
  user?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenVoice,
  onOpenSettings,
  settings,
  collapsed,
  setCollapsed,
  onLogout,
  user,
}) => {
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || settings.merchantName || 'Merchant';
  const displayEmail = user?.email || settings.category || 'Hardware & Paints';
  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join('') || 'NB';

  return (
    <aside 
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col bg-[#FAF7F2] border-r border-[#EFE9DF] transition-all duration-300 ease-in-out ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-20 px-5 border-b border-[#EFE9DF]/60">
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* Logo icon matching the screenshot: Orange open book emblem */}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E85D43] text-white shadow-sm shadow-[#E85D43]/20 group-hover:scale-105 transition-transform">
            <svg 
              className="w-5 h-5 fill-current" 
              viewBox="0 0 24 24"
            >
              <path d="M19 2H6c-1.2 0-2.4.6-3 1.7C2.4 4.8 2 6.3 2 8v11c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 16H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex items-center">
              <span className="text-xl font-bold tracking-tight text-[#1E232A]">
                Noti<span className="text-[#E85D43]">Book</span>
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#EFE9DF]/50 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Voice Record Callout Button */}
      <div className="p-4">
        <button
          onClick={onOpenVoice}
          className={`w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-semibold text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-[0.98] shadow-md shadow-[#E85D43]/25 transition-all group ${
            collapsed ? 'px-0' : ''
          }`}
          title="Voice Record (Speak or Bill)"
        >
          <div className="relative">
            <Mic size={18} className="transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          </div>
          {!collapsed && <span className="text-sm font-medium tracking-wide">Voice Record</span>}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1.5">
        <button
          onClick={() => setActiveTab('home')}
          className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'home'
              ? 'bg-[#FFEFEA] text-[#E85D43] font-semibold shadow-xs'
              : 'text-[#655E57] hover:text-[#1E232A] hover:bg-[#F2ECE2]'
          } ${collapsed ? 'justify-center px-0' : ''}`}
          title="Home"
        >
          <LayoutGrid size={19} className={activeTab === 'home' ? 'text-[#E85D43]' : 'text-[#8C827A]'} />
          {!collapsed && <span>Home</span>}
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'customers'
              ? 'bg-[#E85D43] text-white font-semibold shadow-xs'
              : 'text-[#655E57] hover:text-[#1E232A] hover:bg-[#F2ECE2]'
          } ${collapsed ? 'justify-center px-0' : ''}`}
          title="Customers"
        >
          <Users size={19} className={activeTab === 'customers' ? 'text-white' : 'text-[#8C827A]'} />
          {!collapsed && <span>Customers</span>}
        </button>

        <button
          onClick={() => setActiveTab('book')}
          className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'book'
              ? 'bg-[#E85D43] text-white font-semibold shadow-xs'
              : 'text-[#655E57] hover:text-[#1E232A] hover:bg-[#F2ECE2]'
          } ${collapsed ? 'justify-center px-0' : ''}`}
          title="Book & Ledger"
        >
          <BookOpen size={19} className={activeTab === 'book' ? 'text-white' : 'text-[#8C827A]'} />
          {!collapsed && <span>Book & Ledger</span>}
        </button>
      </nav>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-[#EFE9DF]/60 space-y-2">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[#655E57] hover:text-[#1E232A] hover:bg-[#F2ECE2] transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Settings"
        >
          <Settings size={18} className="text-[#8C827A]" />
          {!collapsed && <span>Settings</span>}
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between gap-1">
          <div 
            onClick={onOpenSettings}
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-[#F2ECE2] transition-colors flex-1 min-w-0 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#EFE9DF]"
              />
            ) : (
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#1C232B] text-white text-xs font-bold shrink-0">
                {userInitials}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#1E232A] truncate">
                  {displayName}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#8C827A] truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="truncate">{displayEmail}</span>
                </div>
              </div>
            )}
          </div>

          {onLogout && !collapsed && (
            <button
              onClick={onLogout}
              className="p-2 text-[#8C827A] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
