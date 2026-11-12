import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Download,
  Thermometer,
  Zap,
  AlertOctagon,
  Droplets,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { useSimulation } from '../context/SimulationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { exportToCsv } from '../utils/exportCsv';
import {
  formatVoltage,
  formatCurrent,
  formatTemp,
  formatMoisture,
  formatPercentage,
  formatDateTime,
} from '../utils/formatters';
import type { TransformerDetail, TelemetryReading } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export const LiveMonitoringPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const txParam = searchParams.get('tx') || 'TX-001';

  const { status, clearAnomaly } = useSimulation();

  const [transformers, setTransformers] = useState<TransformerDetail[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>(txParam);
  const [txDetail, setTxDetail] = useState<TransformerDetail | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>([]);
  const [timeRangeLimit, setTimeRangeLimit] = useState<number>(60);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync url param
  useEffect(() => {
    if (txParam && txParam !== selectedTxId) {
      setSelectedTxId(txParam);
    }
  }, [txParam, selectedTxId]);

  const handleSelectTransformer = (id: string) => {
    setSelectedTxId(id);
    setSearchParams({ tx: id });
  };

  const loadData = useCallback(async () => {
    try {
      const [fleet, detail, history] = await Promise.all([
        api.getTransformers(),
        api.getTransformer(selectedTxId),
        api.getTransformerTelemetry(selectedTxId, timeRangeLimit),
      ]);
      setTransformers(fleet);
      setTxDetail(detail);
      setTelemetryHistory(history);
    } catch (err) {
      console.error('Error fetching live telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTxId, timeRangeLimit]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [loadData]);

  const telemetry = txDetail?.telemetry;
  const spec = txDetail?.spec;

  const isStale = telemetry?.sensor_status === 'STALE';
  const isOffline = telemetry?.sensor_status === 'OFFLINE' || telemetry?.sensor_status === 'CONNECTION_LOST';
  const activeAnomaly = status?.active_anomalies?.[selectedTxId];

  // Chart data formatting
  const chartData = useMemo(() => {
    return telemetryHistory.map((t) => ({
      time: formatDateTime(t.timestamp),
      vrms: t.vrms,
      irms: t.irms,
      winding_hotspot_temperature: t.winding_hotspot_temperature,
      moisture: t.moisture,
    }));
  }, [telemetryHistory]);

  const handleExportCsv = () => {
    if (!telemetryHistory.length) return;
    const rows = telemetryHistory.map((t) => ({
      transformer_id: t.transformer_id,
      timestamp: t.timestamp,
      vrms_measured: t.vrms.toFixed(2),
      rated_vrms: '240.0',
      voltage_deviation_pct: (((t.vrms - 240.0) / 240.0) * 100).toFixed(2),
      irms_measured: t.irms.toFixed(2),
      rated_irms: spec?.rated_irms.toFixed(1) || '104.2',
      winding_hotspot_temperature_c: t.winding_hotspot_temperature.toFixed(1),
      moisture_pct_rh: t.moisture.toFixed(1),
      sensor_status: t.sensor_status,
      is_mock_data: t.is_mock_data ? 'YES' : 'NO',
    }));
    exportToCsv(`${selectedTxId}_telemetry_stream`, rows);
  };

  if (loading && !txDetail) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <Activity className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">
            Loading Live Telemetry for {selectedTxId}...
          </span>
        </div>
      </div>
    );
  }

  // Voltage checks
  const vDevPct = txDetail?.voltage_deviation_pct ?? 0;
  const isVDevNormal = vDevPct >= -10.0 && vDevPct <= 6.0;
  const isVSupplyNormal = (telemetry?.vrms ?? 240) >= 216.0 && (telemetry?.vrms ?? 240) <= 254.0;

  // Current checks
  const iDevPct = txDetail?.current_deviation_pct ?? 0;
  const isIDevNormal = iDevPct <= 10.0;

  return (
    <div className="space-y-6">
      {/* Page Header & Selector Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 uppercase">
              Live Parameter Monitoring
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Real-Time Feed
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            High-precision voltage deviation, current load analysis, winding hotspot telemetry, and statutory compliance checks.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono">
            {[30, 60, 120].map((limit) => (
              <button
                key={limit}
                onClick={() => setTimeRangeLimit(limit)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  timeRangeLimit === limit
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {limit} pts
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate(`/anomalies?tx=${selectedTxId}`)}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-900/60"
          >
            <ShieldAlert className="h-4 w-4" />
            Anomaly & Condition Assessment
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Transformer Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {transformers.map((t) => {
          const isSelected = t.spec.id === selectedTxId;
          const isHealthy = t.overall_condition === 'HEALTHY';
          const isCritical = t.overall_condition === 'CRITICAL';
          const isInspect = t.overall_condition === 'INSPECTION_REQUIRED';

          return (
            <button
              key={t.spec.id}
              onClick={() => handleSelectTransformer(t.spec.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-950/40 shadow-[0_0_15px_rgba(0,242,254,0.15)]'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isCritical
                    ? 'bg-rose-500 animate-ping'
                    : isInspect
                    ? 'bg-amber-400'
                    : isHealthy
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`}
              />
              <div className="text-left">
                <div
                  className={`text-xs font-mono font-bold ${
                    isSelected ? 'text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  {t.spec.id}
                </div>
                <div className="text-[10px] text-slate-500">{t.spec.substation}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Anomaly Banner */}
      {activeAnomaly && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-900/60 p-2 text-rose-400">
              <AlertOctagon className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Active Simulated Anomaly Injected:
                </span>
                <span className="font-mono text-xs font-bold text-white">
                  {activeAnomaly.type} ({activeAnomaly.severity})
                </span>
              </div>
              <p className="mt-0.5 text-xs text-rose-200/80">
                Abnormal electrical behaviour is active on this unit. System anomaly detection and condition evaluator triggered.
              </p>
            </div>
          </div>
          <button
            onClick={() => clearAnomaly(selectedTxId)}
            className="rounded-lg border border-rose-500/50 bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-800"
          >
            Clear Anomaly
          </button>
        </div>
      )}

      {/* Sensor Connectivity & Data Status Banner */}
      {(isStale || isOffline) && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <strong>Sensor Telemetry Alert:</strong> Sensor connectivity status is{' '}
            <span className="font-mono font-bold uppercase">{telemetry?.sensor_status}</span>.
            {isOffline
              ? ' Telemetry connection lost. Immediate on-site hardware inspection recommended.'
              : ' Sensor telemetry is stale. Check edge gateway poll latency.'}
          </div>
        </div>
      )}

      {/* Transformer Specifications Strip */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400 border border-cyan-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-mono font-extrabold text-slate-100">
                  {spec?.name} ({spec?.id})
                </h2>
                <StatusBadge status={txDetail?.overall_condition || 'HEALTHY'} size="sm" />
              </div>
              <div className="text-xs text-slate-400">
                Substation: <span className="font-semibold text-slate-200">{spec?.substation}</span> • Rated Capacity: <span className="font-semibold text-slate-200">{spec?.rated_kva} kVA</span> • Cooling: <span className="font-semibold text-slate-200">{spec?.cooling_type}</span> • Installed: <span className="font-semibold text-slate-200">{spec?.installation_year}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <div className="text-slate-500 uppercase text-[10px]">Rated Voltage</div>
              <div className="font-bold text-cyan-400 text-sm">{spec?.rated_vrms.toFixed(1)} Vrms</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase text-[10px]">Rated Current</div>
              <div className="font-bold text-cyan-400 text-sm">{spec?.rated_irms.toFixed(1)} Arms</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase text-[10px]">Sensor Status</div>
              <div className="font-bold text-emerald-400 text-sm">{telemetry?.sensor_status}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Electrical Parameter Monitoring Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* PARAMETER A: Output Voltage (Vrms) with Dual Independent Checks */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Output Voltage (Vrms)</span>
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-slate-100">
                {formatVoltage(telemetry?.vrms ?? 0)}
              </span>
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Rated: <span className="font-mono font-semibold text-slate-300">240.0 Vrms</span>
            </div>

            {/* Check 1: Voltage Deviation Check (-10% to +6%) */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Voltage Deviation:</span>
                <span
                  className={`font-mono font-bold ${
                    isVDevNormal ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatPercentage(vDevPct, true)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Permissible (-10% to +6%):</span>
                <span
                  className={`font-semibold ${
                    isVDevNormal ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {txDetail?.voltage_deviation_status}
                </span>
              </div>
            </div>

            {/* Check 2: Independent Statutory Supply Range Check (216V - 254V) */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Statutory Supply Range:</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Permitted: 216 V – 254 V:</span>
                <span
                  className={`font-semibold uppercase ${
                    isVSupplyNormal ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {txDetail?.supply_voltage_status}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 font-mono">
            Independent assessment: Rated deviation vs Statutory boundary.
          </div>
        </div>

        {/* PARAMETER B: Output Current (Arms) with Configured Overcurrent Threshold */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Output Current (Arms)</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-slate-100">
                {formatCurrent(telemetry?.irms ?? 0)}
              </span>
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Rated: <span className="font-mono font-semibold text-slate-300">{spec?.rated_irms.toFixed(1)} Arms</span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Current Deviation:</span>
                <span
                  className={`font-mono font-bold ${
                    isIDevNormal ? 'text-slate-200' : 'text-rose-400'
                  }`}
                >
                  {formatPercentage(iDevPct, true)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Configured Limit (+10%):</span>
                <span
                  className={`font-semibold ${
                    isIDevNormal ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {txDetail?.current_condition}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Loading Condition:</span>
                <span className="font-semibold text-slate-300">{txDetail?.loading_condition}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Load Utilization:</span>
                <span className="font-mono font-bold text-cyan-400">
                  {formatPercentage(txDetail?.loading_pct ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 font-mono">
            Configured overcurrent tolerance: +10% rated current.
          </div>
        </div>

        {/* PARAMETER C: Winding Hotspot Temperature (Sensor reading ONLY) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Winding Hotspot Temp</span>
              <Thermometer className="h-4 w-4 text-amber-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-slate-100">
                {formatTemp(telemetry?.winding_hotspot_temperature ?? 0)}
              </span>
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Thermal Status:{' '}
              <span
                className={`font-semibold uppercase ${
                  (telemetry?.winding_hotspot_temperature ?? 0) > 95
                    ? 'text-rose-400'
                    : (telemetry?.winding_hotspot_temperature ?? 0) >= 80
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {txDetail?.thermal_condition}
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Normal Range:</span>
                <span className="font-mono text-emerald-400">&lt; 80.0 °C</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Elevated Range:</span>
                <span className="font-mono text-amber-400">80.0 – 95.0 °C</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Overheating Trigger:</span>
                <span className="font-mono text-rose-400">&gt; 95.0 °C</span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded bg-slate-950/80 p-2 text-[10px] text-slate-500 leading-tight">
            <Info className="inline h-3 w-3 mr-1 text-slate-400" />
            Top oil (60°C) and average winding (65°C) are design baselines and omitted from live telemetry per specification.
          </div>
        </div>

        {/* PARAMETER D: Moisture Reading & Condition Recommendation */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Moisture Content</span>
              <Droplets className="h-4 w-4 text-cyan-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-slate-100">
                {formatMoisture(telemetry?.moisture ?? 0)}
              </span>
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Dielectric Status:{' '}
              <span
                className={`font-semibold ${
                  (telemetry?.moisture ?? 0) > 35.0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {(telemetry?.moisture ?? 0) > 35.0 ? 'Elevated Moisture' : 'Acceptable'}
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
              <div className="text-xs text-slate-400">Operator Recommendation:</div>
              <div className="rounded bg-slate-950 p-2 text-[11px] text-cyan-300 leading-normal font-medium">
                {txDetail?.recommended_action || 'Maintain routine monitoring.'}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Inspection:</span>
            {txDetail?.inspection_required ? (
              <span className="rounded bg-amber-950 px-2 py-0.5 font-bold text-amber-300">
                INSPECTION REQUIRED
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold">Routine Status</span>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry Trend Curves (Recharts) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Voltage Vrms Curve */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Live Output Voltage Curve (Vrms)
              </h3>
              <p className="text-xs text-slate-400">
                Displaying measured Vrms against Rated (240V) and Statutory boundaries (216V–254V).
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="text-cyan-400">● Measured</span>
              <span className="text-slate-500">--- Rated 240V</span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis domain={[200, 270]} stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const v = Number(payload[0].value);
                    const dev = (((v - 240) / 240) * 100).toFixed(2);
                    return (
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs shadow-xl font-mono">
                        <p className="text-slate-400 mb-1">{label}</p>
                        <p className="font-bold text-cyan-400">{v.toFixed(2)} Vrms</p>
                        <p className="text-[11px] text-slate-300">Deviation: {dev}%</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={240} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Rated 240V', fill: '#94a3b8', fontSize: 10 }} />
                <ReferenceLine y={254} stroke="#ef4444" strokeDasharray="2 2" label={{ value: 'Max 254V', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={216} stroke="#f59e0b" strokeDasharray="2 2" label={{ value: 'Min 216V', fill: '#f59e0b', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="vrms"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Arms Curve */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Live Output Current Curve (Arms)
              </h3>
              <p className="text-xs text-slate-400">
                Displaying measured Arms against Rated capacity ({spec?.rated_irms.toFixed(1)} Arms) & +10% overcurrent threshold.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="text-emerald-400">● Measured</span>
              <span className="text-slate-500">--- Rated</span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const i = Number(payload[0].value);
                    const rated = spec?.rated_irms || 104.2;
                    const dev = (((i - rated) / rated) * 100).toFixed(2);
                    return (
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs shadow-xl font-mono">
                        <p className="text-slate-400 mb-1">{label}</p>
                        <p className="font-bold text-emerald-400">{i.toFixed(2)} Arms</p>
                        <p className="text-[11px] text-slate-300">Deviation: {dev}%</p>
                      </div>
                    );
                  }}
                />
                {spec?.rated_irms && (
                  <ReferenceLine
                    y={spec.rated_irms}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    label={{ value: `Rated ${spec.rated_irms.toFixed(0)}A`, fill: '#94a3b8', fontSize: 10 }}
                  />
                )}
                {spec?.rated_irms && (
                  <ReferenceLine
                    y={spec.rated_irms * 1.1}
                    stroke="#ef4444"
                    strokeDasharray="2 2"
                    label={{ value: `Limit +10% (${(spec.rated_irms * 1.1).toFixed(0)}A)`, fill: '#ef4444', fontSize: 10 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="irms"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Winding Hotspot Temperature & Moisture Curve */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Winding Hotspot Temperature & Moisture Dynamics
              </h3>
              <p className="text-xs text-slate-400">
                Direct sensor temperature measurement with warning threshold (80°C) and overheating alarm (95°C).
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Hotspot (°C)
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" /> Moisture (% RH)
              </span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis yAxisId="temp" domain={[20, 120]} stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis yAxisId="moist" orientation="right" domain={[0, 100]} stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs shadow-xl font-mono">
                        <p className="text-slate-400 mb-1">{label}</p>
                        {payload.map((item: any) => (
                          <div key={item.dataKey} className="flex items-center justify-between gap-4">
                            <span style={{ color: item.color }}>{item.name}:</span>
                            <span className="font-bold text-slate-200">
                              {Number(item.value).toFixed(1)} {item.dataKey === 'winding_hotspot_temperature' ? '°C' : '% RH'}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <ReferenceLine yAxisId="temp" y={80} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Elevated (80°C)', fill: '#f59e0b', fontSize: 10 }} />
                <ReferenceLine yAxisId="temp" y={95} stroke="#ef4444" strokeDasharray="2 2" label={{ value: 'Overheating (95°C)', fill: '#ef4444', fontSize: 10 }} />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="winding_hotspot_temperature"
                  name="Hotspot Temp"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="moist"
                  type="monotone"
                  dataKey="moisture"
                  name="Moisture"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};