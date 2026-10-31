import React from 'react';
import { Menu, Search, Bell, User, Database } from 'lucide-react';
import { Badge } from '../common/Badge';
import { useApiHealth } from '../../services/api';

interface HeaderProps {
  onOpenMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileNav }) => {
  const { health, isLoading } = useApiHealth();
  const isDbConnected = health?.database?.connected;

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Left section: mobile toggle and quick search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-lg">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search subscriptions, customers, or invoices... (Press / to focus)"
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Right section: System state indicator, notifications, and user avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          {isLoading ? (
            <Badge variant="neutral" size="sm">Checking DB...</Badge>
          ) : isDbConnected ? (
            <Badge variant="success" size="sm" className="hidden md:inline-flex gap-1 items-center">
              <Database className="w-3 h-3 text-emerald-600" />
              MySQL Live
            </Badge>
          ) : (
            <Badge variant="warning" size="sm" className="hidden md:inline-flex gap-1 items-center" title="Local MySQL not connected or running in demo preview">
              <Database className="w-3 h-3 text-amber-600" />
              MySQL Offline (Demo Mode)
            </Badge>
          )}

          <Badge variant="neutral" size="sm">
            Admin View
          </Badge>
        </div>

        <button
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors relative"
          aria-label="View notifications"
          title="Notifications (Pending API Stage)"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
        </button>

        {/* User profile dropdown trigger */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">Brightloop Staff</p>
            <p className="text-[11px] text-slate-400 leading-none">admin@brightloop.local</p>
          </div>
        </div>
      </div>
    </header>
  );
};

