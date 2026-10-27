import React from 'react';
import type { RiskLevel } from '../../types';

interface RiskBadgeProps {
  level: RiskLevel | string;
  score?: number;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score }) => {
  const l = (level || 'LOW').toUpperCase();
  let colorClass = 'bg-emerald-950/60 text-emerald-400 border-emerald-800';

  if (l === 'CRITICAL') {
    colorClass = 'bg-rose-950/80 text-rose-300 border-rose-700 font-semibold';
  } else if (l === 'HIGH') {
    colorClass = 'bg-orange-950/70 text-orange-400 border-orange-800';
  } else if (l === 'MEDIUM') {
    colorClass = 'bg-amber-950/60 text-amber-400 border-amber-800';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border tracking-wide uppercase ${colorClass}`}>
      <span>{l} RISK</span>
      {score !== undefined && (
        <span className="font-mono opacity-80">({score.toFixed(0)})</span>
      )}
    </span>
  );
};
