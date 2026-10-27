import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Download,
  Gauge,
  Thermometer,
  Zap,
  Radio,
  AlertOctagon,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import { useSimulation } from '../context/SimulationContext';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { exportToCsv } from '../utils/exportCsv';
import {
  formatApparentPower,
  formatVoltage,
  formatDateTime,
} from '../utils/formatters';
import type { TransformerDetail, TelemetryReading } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const LiveMonitoringPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const txParam = searchParams.get('tx') || 'TX-101';

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

  const isStale = telemetry?.communication_status === 'STALE';
  const isOffline = telemetry?.communication_status === 'OFFLINE';

  const activeAnomaly = status?.active_anomalies?.[selectedTxId];

  // Chart data formatting
  const chartData = useMemo(() => {
    return telemetryHistory.map((t) => ({
      time: formatDateTime(t.timestamp),
      load_pct: t.load_percentage,
      oil_temp: t.oil_temp_c,
      winding_temp: t.winding_temp_c,
      voltage_v: t.voltage_v,
      current_a: t.current_a,
      active_kw: t.active_power_kw,
    }));
  }, [telemetryHistory]);

  const handleExportTelemetry = () => {
    const rows = telemetryHistory.map((t) => ({
      Timestamp: t.timestamp,
      TransformerID: t.transformer_id,
      LoadPct: t.load_percentage,
      ActivePowerKw: t.active_power_kw,
      ApparentPowerKva: t.apparent_power_kva,
      ReactivePowerKvar: t.reactive_power_kvar,
      VoltageV: t.voltage_v,
      CurrentA: t.current_a,
      PowerFactor: t.power_factor,
      FrequencyHz: t.frequency_hz,
      OilTempC: t.oil_temp_c,
      WindingTempC: t.winding_temp_c,
      CommStatus: t.communication_status,
    }));
    exportToCsv(`${selectedTxId}_telemetry_log`, rows);
  };

  if (loading && !txDetail) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400 font-mono text-sm animate-pulse">
        CONNECTING TO SCADA TELEMETRY FEED...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-cyan-400" />
            Asset:
          </label>
          <select
            value={selectedTxId}
            onChange={(e) => handleSelectTransformer(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-semibold text-cyan-300 focus:outline-hidden focus:border-cyan-500"
          >
            {transformers.map((t) => (
              <option key={t.spec.id} value={t.spec.id}>
                {t.spec.id} — {t.spec.name} ({t.spec.rated_capacity_kva} kVA, {t.spec.zone})
              </option>
            ))}
          </select>

          {txDetail && (
            <div className="flex items-center gap-2">
              <StatusBadge status={txDetail.telemetry.communication_status} />
              <RiskBadge level={txDetail.risk_level} score={txDetail.risk_score} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range selector */}
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs font-mono">
            {[
              { label: '15m', limit: 15 },
              { label: '1h', limit: 60 },
              { label: '6h', limit: 150 },
              { label: '24h', limit: 300 },
            ].map((r) => (
              <button
                key={r.label}
                onClick={() => setTimeRangeLimit(r.limit)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  timeRangeLimit === r.limit
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportTelemetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sensor / Data Quality Warning Banner if Stale or Offline */}
      {isOffline && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs">
            <h4 className="font-bold text-sm">CRITICAL SENSOR COMMUNICATION FAILURE (OFFLINE)</h4>
            <p className="mt-1">
              No live telemetry packets received from {selectedTxId} RTU. Sensor channel marked OFFLINE. Measurements below represent last cached historical snapshot and MUST NOT be treated as active real-time conditions.
            </p>
          </div>
        </div>
      )}

      {isStale && !isOffline && (
        <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-800 text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-sm">TELEMETRY DATA QUALITY WARNING: STALE SENSOR FEED</h4>
            <p className="mt-1">
              Sensor readings have frozen with zero delta variance across successive SCADA polling cycles. Check remote terminal unit (RTU) firmware and A/D converter sampling.
            </p>
          </div>
        </div>
      )}

      {/* Active Anomaly Banner */}
      {activeAnomaly && (
        <div className="p-4 rounded-xl bg-purple-950/60 border border-purple-700/80 text-purple-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs">
            <Activity className="w-4 h-4 text-purple-400 animate-spin" />
            <span>
              <strong>Active Demonstration Anomaly: </strong>
              <span className="uppercase font-mono font-bold text-purple-300">
                {activeAnomaly.type}
              </span> ({activeAnomaly.severity} Severity)
            </span>
          </div>
          <button
            onClick={() => clearAnomaly(selectedTxId)}
            className="text-xs px-3 py-1 rounded bg-purple-800 hover:bg-purple-700 text-white font-semibold transition-colors"
          >
            Clear Anomaly
          </button>
        </div>
      )}

      {/* Primary Telemetry Gauges Grid */}
      {telemetry && spec && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Active Power kW */}
          <MetricCard
            title="Real Power (P)"
            value={telemetry.active_power_kw.toFixed(1)}
            unit="kW"
            subtitle={`Apparent: ${formatApparentPower(telemetry.apparent_power_kva)}`}
            icon={<Zap className="w-4 h-4 text-cyan-400" />}
            variant="cyan"
          />

          {/* Load % */}
          <MetricCard
            title="Load Utilization"
            value={telemetry.load_percentage.toFixed(1)}
            unit="%"
            subtitle={`Rated: ${spec.rated_capacity_kva.toLocaleString()} kVA`}
            icon={<Gauge className="w-4 h-4 text-cyan-400" />}
            variant={
              telemetry.load_percentage >= 105
                ? 'rose'
                : telemetry.load_percentage >= 85
                ? 'amber'
                : 'cyan'
            }
          />

          {/* Oil & Winding Temp */}
          <MetricCard
            title="Top Oil Temperature"
            value={telemetry.oil_temp_c.toFixed(1)}
            unit="°C"
            subtitle={`Hotspot Winding: ${telemetry.winding_temp_c.toFixed(1)}°C`}
            icon={<Thermometer className="w-4 h-4 text-amber-400" />}
            variant={telemetry.oil_temp_c >= 80 ? 'rose' : 'amber'}
          />

          {/* Voltage & Current */}
          <MetricCard
            title="Terminal Voltage"
            value={formatVoltage(telemetry.voltage_v)}
            subtitle={`Phase Current: ${telemetry.current_a.toFixed(1)} A`}
            icon={<Activity className="w-4 h-4 text-cyan-400" />}
            variant="default"
          />
        </div>
      )}

      {/* Secondary Telemetry Technical Parameters */}
      {telemetry && spec && (
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Engineering Parameters & Measurement Conventions
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Power Factor (cos φ)</span>
              <span className="font-mono text-base font-bold text-slate-200 mt-1 block">
                {telemetry.power_factor.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-500">Nominal 0.90 - 0.98</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Frequency (Hz)</span>
              <span className="font-mono text-base font-bold text-slate-200 mt-1 block">
                {telemetry.frequency_hz.toFixed(2)} Hz
              </span>
              <span className="text-[10px] text-slate-500">Grid Gov Swing ±0.05</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Reactive Power (Q)</span>
              <span className="font-mono text-base font-bold text-slate-200 mt-1 block">
                {telemetry.reactive_power_kvar.toFixed(1)} kVAR
              </span>
              <span className="text-[10px] text-slate-500">Inductive VAR</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Substation Ambient</span>
              <span className="font-mono text-base font-bold text-slate-200 mt-1 block">
                {telemetry.ambient_temp_c.toFixed(1)}°C
              </span>
              <span className="text-[10px] text-slate-500">Ambient Reference</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Cooling System</span>
              <span className="font-mono text-base font-bold text-cyan-400 mt-1 block">
                {spec.cooling_type}
              </span>
              <span className="text-[10px] text-slate-500">Commissioned {spec.installation_year}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Last Packet</span>
              <span className="font-mono text-xs font-semibold text-slate-300 mt-1.5 block">
                {formatDateTime(telemetry.timestamp)}
              </span>
              <span className="text-[10px] text-emerald-400">Synchronized</span>
            </div>
          </div>
        </div>
      )}

      {/* High Frequency Time-Series Charts */}
      <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Real-Time Dynamic Telemetry Curves ({selectedTxId})
            </h3>
            <p className="text-xs text-slate-400">
              High-frequency multi-channel sensor traces across selected observation window
            </p>
          </div>
        </div>

        {/* Load % and Temperature Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis
                yAxisId="left"
                stroke="#00f2fe"
                tick={{ fill: '#00f2fe', fontSize: 10 }}
                domain={[0, 'auto']}
                unit="%"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                tick={{ fill: '#f59e0b', fontSize: 10 }}
                unit="°C"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="load_pct"
                stroke="#00f2fe"
                strokeWidth={2}
                dot={false}
                name="Load Percentage (%)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="oil_temp"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                name="Top Oil Temp (°C)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="winding_temp"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                name="Hotspot Winding Temp (°C)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Voltage & Current Chart */}
        <div className="h-56 w-full pt-4 border-t border-slate-800/80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis
                yAxisId="v"
                stroke="#38bdf8"
                tick={{ fill: '#38bdf8', fontSize: 10 }}
                domain={['dataMin - 10', 'dataMax + 10']}
                unit=" V"
              />
              <YAxis
                yAxisId="a"
                orientation="right"
                stroke="#a855f7"
                tick={{ fill: '#a855f7', fontSize: 10 }}
                unit=" A"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                yAxisId="v"
                type="monotone"
                dataKey="voltage_v"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={false}
                name="Phase Voltage (V)"
              />
              <Line
                yAxisId="a"
                type="monotone"
                dataKey="current_a"
                stroke="#a855f7"
                strokeWidth={1.5}
                dot={false}
                name="Phase Current (A)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
