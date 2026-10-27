import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'cyan' | 'amber' | 'rose' | 'emerald';
  badge?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = 'default',
  badge,
}) => {
  let borderColor = 'border-slate-800';
  let glowColor = '';
  let accentText = 'text-slate-100';

  if (variant === 'cyan') {
    borderColor = 'border-cyan-500/30';
    glowColor = 'hover:shadow-[0_0_15px_rgba(0,242,254,0.15)]';
    accentText = 'text-cyan-400';
  } else if (variant === 'emerald') {
    borderColor = 'border-emerald-500/30';
    accentText = 'text-emerald-400';
  } else if (variant === 'amber') {
    borderColor = 'border-amber-500/30';
    accentText = 'text-amber-400';
  } else if (variant === 'rose') {
    borderColor = 'border-rose-500/30';
    glowColor = 'hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]';
    accentText = 'text-rose-400';
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-900/80 p-5 border ${borderColor} transition-all duration-200 ${glowColor}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="p-2 rounded-lg bg-slate-800/80 text-cyan-400">
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold font-mono tracking-tight ${accentText}`}>
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>{subtitle}</span>
        {badge}
      </div>
    </div>
  );
};
