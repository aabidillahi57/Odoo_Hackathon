import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  FileSpreadsheet,
  Repeat,
  Receipt,
  CreditCard,
  Tag,
  BarChart3,
  Settings,
  ShieldCheck,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Products', path: '/products', icon: Package },
  { name: 'Plans', path: '/plans', icon: Layers },
  { name: 'Quotations', path: '/quotations', icon: FileSpreadsheet },
  { name: 'Subscriptions', path: '/subscriptions', icon: Repeat },
  { name: 'Invoices', path: '/invoices', icon: Receipt },
  { name: 'Payments', path: '/payments', icon: CreditCard },
  { name: 'Discounts', path: '/discounts', icon: Tag },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Zap className="w-5 h-5 fill-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-white">Brightloop</span>
            <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
              v0.1
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Subscription Management</p>
        </div>
      </div>

      {/* Internal Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Internal Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Portal Entry Point & Role Banner */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <NavLink
          to="/portal"
          onClick={onCloseMobile}
          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white transition-all border border-slate-700/60 group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200 group-hover:text-white">Customer Portal</p>
              <p className="text-[10px] text-slate-400">Self-service view</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            Portal
          </span>
        </NavLink>

        <div className="px-2 py-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Role: Admin / Staff</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online (Demo Mode)" />
        </div>
      </div>
    </aside>
  );
};
