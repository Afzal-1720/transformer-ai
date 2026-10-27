import React from 'react';
import { Activity } from 'lucide-react';

export const SimulationBadge: React.FC = () => {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold tracking-wider uppercase">
      <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
      <span>SIMULATION MODE</span>
    </div>
  );
};
