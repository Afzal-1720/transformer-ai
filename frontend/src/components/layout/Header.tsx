import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Bell,
  Sun,
  Moon,
  Clock,
  Menu,
} from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import { useTheme } from '../../context/ThemeContext';
import { AnomalyTriggerModal } from '../common/AnomalyTriggerModal';
import { AlertsDrawer } from '../common/AlertsDrawer';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { status, activeAlertsCount, togglePause, setSpeed, resetFleet, refreshAlerts } = useSimulation();
  const { theme, toggleTheme } = useTheme();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isAnomalyModalOpen, setIsAnomalyModalOpen] = useState(false);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isPaused = status?.is_paused ?? false;
  const currentSpeed = status?.speed_multiplier ?? 1.0;
  const activeAnomaliesCount = Object.keys(status?.active_anomalies || {}).length;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-md">
        {/* Left: Mobile hamburger & title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>GRID CLOCK:</span>
            <span className="font-bold text-slate-200">{currentTime || '00:00:00'}</span>
            <span className="text-emerald-400 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
          </div>
        </div>

        {/* Right: Simulation Controls & Tools */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pause / Resume */}
          <button
            onClick={togglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isPaused
                ? 'bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/50'
                : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/50'
            }`}
            title={isPaused ? 'Resume live grid simulation' : 'Pause grid simulation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Speed selector */}
          <div className="hidden lg:flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  Math.round(currentSpeed) === s
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Reset simulation */}
          <button
            onClick={resetFleet}
            title="Reset fleet telemetry and clear faults"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Demo Anomaly Trigger Button */}
          <button
            onClick={() => setIsAnomalyModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700/60 text-rose-300 text-xs font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
            title="Inject demonstration anomaly"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span className="hidden md:inline">DEMO ANOMALY</span>
            {activeAnomaliesCount > 0 && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          {/* Alerts Bell */}
          <button
            onClick={() => setIsAlertsDrawerOpen(true)}
            className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Open active alerts and event history"
          >
            <Bell className="w-4 h-4" />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                {activeAlertsCount > 9 ? '9+' : activeAlertsCount}
              </span>
            )}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Modals */}
      <AnomalyTriggerModal
        isOpen={isAnomalyModalOpen}
        onClose={() => setIsAnomalyModalOpen(false)}
      />

      <AlertsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        onAlertUpdated={refreshAlerts}
      />
    </>
  );
};
