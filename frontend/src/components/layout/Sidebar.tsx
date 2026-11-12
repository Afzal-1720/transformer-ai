import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  ClipboardCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SimulationBadge } from '../common/SimulationBadge';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/monitoring', label: 'Live Monitoring', icon: Activity },
    { to: '/anomalies', label: 'Anomaly & Condition', icon: ShieldAlert },
    { to: '/maintenance', label: 'Inspection & Maintenance', icon: ClipboardCheck },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]">
            <Zap className="h-6 w-6 fill-current" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <h1 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase">
                TRANSFORMER
              </h1>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                Monitoring & Condition Assessment
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mock Telemetry Mode Badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-800/60">
          <SimulationBadge />
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,242,254,0.12)]'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t border-slate-800/80 flex items-center justify-between">
        {!collapsed && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            SYSTEM v2.0
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors ml-auto"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
