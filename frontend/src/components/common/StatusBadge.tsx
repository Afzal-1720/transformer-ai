import React from 'react';
import type { HealthStatus, CommunicationStatus } from '../../types';

interface StatusBadgeProps {
  status: HealthStatus | CommunicationStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toUpperCase();
  let bg = 'bg-slate-800 text-slate-300 border-slate-700';
  let dot = 'bg-slate-400';

  if (s === 'HEALTHY' || s === 'ONLINE') {
    bg = 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60';
    dot = 'bg-emerald-400 animate-pulse';
  } else if (s === 'WARNING' || s === 'STALE') {
    bg = 'bg-amber-950/70 text-amber-400 border-amber-800/60';
    dot = 'bg-amber-400';
  } else if (s === 'CRITICAL' || s === 'OFFLINE') {
    bg = 'bg-rose-950/70 text-rose-400 border-rose-800/60';
    dot = 'bg-rose-500 animate-ping';
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wider ${px} ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {s}
    </span>
  );
};
