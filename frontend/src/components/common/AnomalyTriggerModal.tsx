import React, { useState } from 'react';
import { AlertTriangle, Zap, Thermometer, WifiOff, RefreshCw, X, Play, TrendingUp, TrendingDown } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';

interface AnomalyTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTransformerId?: string;
}

export const AnomalyTriggerModal: React.FC<AnomalyTriggerModalProps> = ({
  isOpen,
  onClose,
  defaultTransformerId = 'TX-001',
}) => {
  const { injectAnomaly, clearAnomaly, status } = useSimulation();
  const [selectedTx, setSelectedTx] = useState(defaultTransformerId);
  const [anomalyType, setAnomalyType] = useState('over_current');
  const [duration, setDuration] = useState(120);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInject = async () => {
    setSubmitting(true);
    try {
      await injectAnomaly(selectedTx, anomalyType, 'HIGH', duration);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    try {
      await clearAnomaly(selectedTx);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const activeAnomalies = status?.active_anomalies || {};
  const currentActive = activeAnomalies[selectedTx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Demonstration Anomaly Injector</h2>
              <p className="text-xs text-slate-400">
                Simulate abnormal electrical readings to evaluate real-time anomaly detection and inspection workflows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentActive && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-semibold text-rose-300">Active Test Anomaly: </span>
              <span className="text-rose-200 uppercase font-mono">{currentActive.type}</span> on {selectedTx}
            </div>
            <button
              onClick={handleClear}
              disabled={submitting}
              className="text-xs px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-medium transition-colors"
            >
              Clear Now
            </button>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Transformer
            </label>
            <select
              value={selectedTx}
              onChange={(e) => setSelectedTx(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="TX-001">Transformer_1</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Abnormal Operating Condition
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'over_voltage', label: 'Over-Voltage (>254 V)', desc: 'Supply exceeds 254V statutory limit & +6%', icon: TrendingUp },
                { id: 'under_voltage', label: 'Under-Voltage (<216 V)', desc: 'Supply drops below 216V statutory limit & -10%', icon: TrendingDown },
                { id: 'over_current', label: 'Over-Current (>Rated +10%)', desc: 'Load exceeds rated current & limit', icon: Zap },
                { id: 'overheating', label: 'Winding Overheating (>95°C)', desc: 'Thermal sensor measures dangerous hotspot rise', icon: Thermometer },
                { id: 'sudden_load_variation', label: 'Sudden Load Surge (+35%)', desc: 'Abrupt current step increase on feeder', icon: AlertTriangle },
                { id: 'sensor_freeze', label: 'Sensor Freeze (Stale)', desc: 'ADC lockup: frozen identical readings', icon: RefreshCw },
                { id: 'offline', label: 'Sensor Offline / Loss', desc: 'SCADA packet drop / no telemetry', icon: WifiOff },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = anomalyType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAnomalyType(item.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Duration
            </label>
            <div className="flex gap-2">
              {[
                { sec: 30, label: '30s' },
                { sec: 60, label: '1 min' },
                { sec: 120, label: '2 mins' },
                { sec: 300, label: '5 mins' },
              ].map((d) => (
                <button
                  key={d.sec}
                  type="button"
                  onClick={() => setDuration(d.sec)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    duration === d.sec
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInject}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Inject Test Anomaly</span>
          </button>
        </div>
      </div>
    </div>
  );
};
