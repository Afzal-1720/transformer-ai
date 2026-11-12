import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const s = (status || '').toUpperCase().trim();
  let bg = 'bg-slate-800 text-slate-300 border-slate-700';
  let dot = 'bg-slate-400';

  if (s === 'HEALTHY' || s === 'ONLINE' || s === 'STABLE' || s === 'NORMAL' || s === 'COMPLETED') {
    bg = 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60';
    dot = 'bg-emerald-400 animate-pulse';
  } else if (
    s === 'WARNING' ||
    s === 'STALE' ||
    s === 'ELEVATED' ||
    s === 'HIGH' ||
    s === 'FLUCTUATING' ||
    s === 'ACKNOWLEDGED' ||
    s.includes('WARNING')
  ) {
    bg = 'bg-amber-950/70 text-amber-400 border-amber-800/60';
    dot = 'bg-amber-400';
  } else if (s === 'INSPECTION_REQUIRED' || s === 'INSPECTION REQUIRED' || s === 'PENDING') {
    bg = 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80 font-bold';
    dot = 'bg-cyan-400 animate-pulse';
  } else if (
    s === 'CRITICAL' ||
    s === 'OFFLINE' ||
    s === 'CONNECTION_LOST' ||
    s === 'OVERHEATING' ||
    s === 'OVERLOADED' ||
    s.includes('UNDER-VOLTAGE') ||
    s.includes('OVER-VOLTAGE') ||
    s.includes('OVER CURRENT')
  ) {
    bg = 'bg-rose-950/80 text-rose-300 border-rose-800 font-bold';
    dot = 'bg-rose-500 animate-ping';
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wider uppercase ${px} ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
};
