import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Zap,
  TrendingUp,
  Search,
  ArrowUpDown,
  Download,
  ExternalLink,
  ClipboardCheck,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
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
import type { DashboardSummary } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Table filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [substationFilter, setSubstationFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'id' | 'load' | 'vrms' | 'temp'>('load');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const sum = await api.getDashboardSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Unique substations for filter dropdown
  const substations = useMemo(() => {
    if (!summary) return [];
    const set = new Set(summary.transformer_summaries.map((t) => t.substation));
    return Array.from(set);
  }, [summary]);

  // Filtered & sorted fleet table
  const filteredFleet = useMemo(() => {
    if (!summary) return [];
    let result = [...summary.transformer_summaries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.substation.toLowerCase().includes(q)
      );
    }

    if (substationFilter !== 'ALL') {
      result = result.filter((t) => t.substation === substationFilter);
    }

    if (conditionFilter !== 'ALL') {
      result = result.filter((t) => t.overall_condition === conditionFilter);
    }

    result.sort((a, b) => {
      if (sortField === 'id') {
        return sortAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
      } else if (sortField === 'load') {
        return sortAsc ? a.loading_pct - b.loading_pct : b.loading_pct - a.loading_pct;
      } else if (sortField === 'vrms') {
        return sortAsc ? a.vrms - b.vrms : b.vrms - a.vrms;
      } else if (sortField === 'temp') {
        return sortAsc
          ? a.winding_hotspot_temperature - b.winding_hotspot_temperature
          : b.winding_hotspot_temperature - a.winding_hotspot_temperature;
      }
      return 0;
    });

    return result;
  }, [summary, searchQuery, substationFilter, conditionFilter, sortField, sortAsc]);

  const handleExportCsv = () => {
    if (!summary || summary.transformer_summaries.length === 0) return;
    const rows = summary.transformer_summaries.map((t) => ({
      transformer_id: t.id,
      name: t.name,
      substation: t.substation,
      rated_vrms: '240.0 Vrms',
      measured_vrms: `${t.vrms.toFixed(2)} Vrms`,
      voltage_deviation_pct: `${t.voltage_dev_pct > 0 ? '+' : ''}${t.voltage_dev_pct.toFixed(2)}%`,
      permissible_deviation_status: t.voltage_status,
      statutory_supply_range_status: t.supply_status,
      measured_irms: `${t.irms.toFixed(2)} Arms`,
      current_deviation_pct: `${t.current_dev_pct > 0 ? '+' : ''}${t.current_dev_pct.toFixed(2)}%`,
      loading_pct: `${t.loading_pct.toFixed(1)}%`,
      loading_condition: t.loading_condition,
      winding_hotspot_temp_c: `${t.winding_hotspot_temperature.toFixed(1)} °C`,
      moisture_pct_rh: `${t.moisture.toFixed(1)} % RH`,
      thermal_condition: t.thermal_condition,
      sensor_connectivity: t.sensor_status,
      overall_condition: t.overall_condition,
      inspection_required: t.inspection_required ? 'YES' : 'NO',
      recommended_action: t.recommended_action,
    }));
    exportToCsv('transformer_fleet_status', rows);
  };

  if (loading && !summary) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <Activity className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">
            Initializing Real-Time Transformer Telemetry...
          </span>
        </div>
      </div>
    );
  }

  const kpis = summary?.kpis;
  const fleet = summary?.fleet_condition;

  return (
    <div className="space-y-6">
      {/* Hardware API Notice & Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 uppercase">
              Transformer Fleet Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time transformer electrical parameters, voltage/current deviation assessment, hotspot thermal tracking & inspection requirements.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export Fleet CSV
          </button>
        </div>
      </div>

      {/* Hardware Integration Notification Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-slate-200">System Mode:</strong> Currently operating in hardcoded simulated sensor mode. Ready for live edge IoT/SCADA gateway ingestion at{' '}
            <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono text-[11px]">
              POST /api/transformers/{'{id}'}/telemetry
            </code>
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Statutory Standards: IEC 60076 / ANSI C57.12 • Voltage: 216V–254V
        </div>
      </div>

      {/* Fleet KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Monitored Transformers"
          value={kpis?.total_transformers ?? 0}
          subtitle={`${kpis?.online_transformers ?? 0} Sensors Online`}
          icon={<Zap className="h-5 w-5" />}
          variant="cyan"
        />
        <MetricCard
          title="Inspection Required"
          value={kpis?.transformers_requiring_inspection ?? 0}
          subtitle="Abnormal readings or fluctuations"
          icon={<ClipboardCheck className="h-5 w-5" />}
          variant={(kpis?.transformers_requiring_inspection ?? 0) > 0 ? 'amber' : 'emerald'}
        />
        <MetricCard
          title="Critical Alerts"
          value={kpis?.active_critical_alerts ?? 0}
          subtitle={`${kpis?.total_active_alerts ?? 0} total active alerts`}
          icon={<ShieldAlert className="h-5 w-5" />}
          variant={(kpis?.active_critical_alerts ?? 0) > 0 ? 'rose' : 'emerald'}
        />
        <MetricCard
          title="Avg Fleet Load"
          value={(kpis?.avg_load_percentage ?? 0).toFixed(1)}
          unit="%"
          subtitle="Rated capacity utilization"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="default"
        />
        <MetricCard
          title="Pending Inspections"
          value={kpis?.pending_inspections ?? 0}
          subtitle="Work orders awaiting action"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={(kpis?.pending_inspections ?? 0) > 0 ? 'amber' : 'default'}
        />
      </div>

      {/* Fleet Condition & Health Assessment Status Bar */}
      {fleet && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Fleet Operating Health Status:
                </span>
                <StatusBadge status={fleet.status} />
              </div>
              <p className="text-sm font-medium text-slate-300">
                {fleet.description}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-400">Healthy:</span>
                <span className="font-bold text-slate-200">{fleet.healthy}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-400">Warning:</span>
                <span className="font-bold text-slate-200">{fleet.warning}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-400">Critical:</span>
                <span className="font-bold text-slate-200">{fleet.critical}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <span className="text-slate-400">Inspect Req:</span>
                <span className="font-bold text-cyan-300">{fleet.inspection_required}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Overview Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Transformer Condition & Parameters
            </h2>
            <p className="text-xs text-slate-400">
              Live comparison of rated vs measured voltage (240Vrms), current, deviation checks, hotspot thermal status, and overall condition.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search ID / Substation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <select
              value={substationFilter}
              onChange={(e) => setSubstationFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Substations</option>
              {substations.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Conditions</option>
              <option value="HEALTHY">Healthy</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
              <option value="INSPECTION_REQUIRED">Inspection Required</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th
                  className="cursor-pointer px-3.5 py-3 hover:text-slate-200"
                  onClick={() => {
                    setSortField('id');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    Transformer
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-3.5 py-3 hover:text-slate-200"
                  onClick={() => {
                    setSortField('vrms');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    Voltage (Vrms) & Dev %
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-3.5 py-3">Statutory Range (216–254V)</th>
                <th className="px-3.5 py-3">Current (Arms) & Dev %</th>
                <th
                  className="cursor-pointer px-3.5 py-3 hover:text-slate-200"
                  onClick={() => {
                    setSortField('load');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    Loading %
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-3.5 py-3 hover:text-slate-200"
                  onClick={() => {
                    setSortField('temp');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    Winding Hotspot
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-3.5 py-3">Moisture</th>
                <th className="px-3.5 py-3">Overall Condition</th>
                <th className="px-3.5 py-3">Inspection</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFleet.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No transformers found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredFleet.map((t) => {
                  const isVoltageDevNormal = t.voltage_status.includes('Normal');
                  const isSupplyNormal = t.supply_status.includes('Normal');
                  const isCurrentNormal = t.current_dev_pct <= 10.0;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/monitoring?tx=${t.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-800/40"
                    >
                      {/* Transformer ID & Substation */}
                      <td className="px-3.5 py-3">
                        <div className="font-mono font-bold text-slate-200">{t.id}</div>
                        <div className="text-[11px] text-slate-400">
                          {t.name} • <span className="text-cyan-400/80">{t.substation}</span>
                        </div>
                      </td>

                      {/* Voltage & Deviation % */}
                      <td className="px-3.5 py-3">
                        <div className="font-mono font-semibold text-slate-200">
                          {formatVoltage(t.vrms)}
                        </div>
                        <div
                          className={`text-[11px] font-mono ${
                            isVoltageDevNormal
                              ? 'text-emerald-400'
                              : 'text-rose-400 font-bold'
                          }`}
                        >
                          {formatPercentage(t.voltage_dev_pct, true)} (Rated 240V)
                        </div>
                      </td>

                      {/* Statutory Supply Range Check */}
                      <td className="px-3.5 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isSupplyNormal
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                              : 'bg-rose-950/70 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {t.supply_status}
                        </span>
                      </td>

                      {/* Current & Deviation */}
                      <td className="px-3.5 py-3">
                        <div className="font-mono font-semibold text-slate-200">
                          {formatCurrent(t.irms)}
                        </div>
                        <div
                          className={`text-[11px] font-mono ${
                            isCurrentNormal ? 'text-slate-400' : 'text-rose-400 font-bold'
                          }`}
                        >
                          {formatPercentage(t.current_dev_pct, true)} (Lim +10%)
                        </div>
                      </td>

                      {/* Loading % */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-200">
                            {formatPercentage(t.loading_pct)}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              t.loading_pct > 100
                                ? 'bg-rose-950 text-rose-300'
                                : t.loading_pct >= 80
                                ? 'bg-amber-950 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.loading_condition}
                          </span>
                        </div>
                      </td>

                      {/* Winding Hotspot Temp */}
                      <td className="px-3.5 py-3">
                        <div className="font-mono font-semibold text-slate-200">
                          {formatTemp(t.winding_hotspot_temperature)}
                        </div>
                        <div
                          className={`text-[10px] uppercase font-semibold ${
                            t.winding_hotspot_temperature > 95
                              ? 'text-rose-400'
                              : t.winding_hotspot_temperature >= 80
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {t.thermal_condition}
                        </div>
                      </td>

                      {/* Moisture */}
                      <td className="px-3.5 py-3 font-mono text-slate-300">
                        {formatMoisture(t.moisture)}
                      </td>

                      {/* Overall Condition */}
                      <td className="px-3.5 py-3">
                        <StatusBadge status={t.overall_condition} size="sm" />
                      </td>

                      {/* Inspection Required */}
                      <td className="px-3.5 py-3">
                        {t.inspection_required ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-950/70 border border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            REQUIRED
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">Routine</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/monitoring?tx=${t.id}`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800"
                        >
                          Monitor
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet Telemetry Trend & Active Anomalies Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Fleet Average Telemetry Trend (2 Columns) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                24-Point Fleet Telemetry History
              </h2>
              <p className="text-xs text-slate-400">
                Tracking average measured voltage (Vrms), current (Arms), and winding hotspot temperature.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" /> Vrms
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Arms
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Hotspot °C
              </span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            {summary?.telemetry_trend && summary.telemetry_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.telemetry_trend}>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatDateTime}
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="voltage"
                    domain={[200, 270]}
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="current"
                    orientation="right"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs shadow-xl">
                          <p className="font-mono text-slate-400 mb-1">{formatDateTime(String(label || ''))}</p>
                          {payload.map((item: any) => (
                            <div key={item.dataKey} className="flex items-center justify-between gap-4 font-mono">
                              <span style={{ color: item.color }}>{item.name}:</span>
                              <span className="font-bold text-slate-200">
                                {Number(item.value).toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Line
                    yAxisId="voltage"
                    type="monotone"
                    dataKey="avg_vrms"
                    name="Avg Vrms"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="current"
                    type="monotone"
                    dataKey="avg_irms"
                    name="Avg Arms"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="current"
                    type="monotone"
                    dataKey="hotspot_temp_c"
                    name="Hotspot Temp °C"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Collecting historical telemetry data...
              </div>
            )}
          </div>
        </div>

        {/* Recent Anomaly & Alert Notifications (1 Column) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Recent Abnormal Conditions
                </h2>
                <p className="text-xs text-slate-400">
                  Detected fluctuations and parameter excursions.
                </p>
              </div>
              <button
                onClick={() => navigate('/maintenance')}
                className="text-[11px] font-semibold text-cyan-400 hover:underline"
              >
                View Inspections →
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto">
              {!summary?.recent_alerts || summary.recent_alerts.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                  No abnormal conditions detected. All transformers within normal limits.
                </div>
              ) : (
                summary.recent_alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-3 text-xs transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono font-bold text-slate-200">
                        {alert.transformer_id}
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300'
                            : 'bg-amber-950 text-amber-300'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    <p className="mt-1 font-medium text-slate-300">{alert.message}</p>

                    <div className="mt-2 rounded bg-slate-900 px-2 py-1 text-[11px] text-cyan-300">
                      <strong>Action:</strong> {alert.recommended_action}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{formatDateTime(alert.created_at)}</span>
                      {alert.inspection_recommended && (
                        <span className="font-bold text-amber-400">Inspection Advised</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Need to test system response?</span>
            <button
              onClick={() => navigate('/anomalies')}
              className="text-cyan-400 font-semibold hover:underline"
            >
              Simulate Anomaly →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};