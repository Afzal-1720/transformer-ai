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
  Flame,
  Layers,
  Wrench,
  Radio,
} from 'lucide-react';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { exportToCsv } from '../utils/exportCsv';
import { formatPower, formatVoltage, formatTemp, formatPercentage } from '../utils/formatters';
import type { DashboardSummary, TransformerDetail } from '../types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transformers, setTransformers] = useState<TransformerDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Table filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'id' | 'load' | 'temp' | 'health'>('load');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sum, units] = await Promise.all([
        api.getDashboardSummary(),
        api.getTransformers(),
      ]);
      setSummary(sum);
      setTransformers(units);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filtered & sorted fleet table
  const filteredFleet = useMemo(() => {
    let result = [...transformers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.spec.id.toLowerCase().includes(q) ||
          t.spec.name.toLowerCase().includes(q) ||
          t.spec.zone.toLowerCase().includes(q)
      );
    }

    if (zoneFilter !== 'ALL') {
      result = result.filter((t) => t.spec.zone.toLowerCase().includes(zoneFilter.toLowerCase()));
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((t) => t.health_status === statusFilter);
    }

    result.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;
      if (sortField === 'id') {
        return sortAsc ? a.spec.id.localeCompare(b.spec.id) : b.spec.id.localeCompare(a.spec.id);
      } else if (sortField === 'load') {
        valA = a.telemetry.load_percentage;
        valB = b.telemetry.load_percentage;
      } else if (sortField === 'temp') {
        valA = a.telemetry.oil_temp_c;
        valB = b.telemetry.oil_temp_c;
      } else if (sortField === 'health') {
        valA = a.health_score;
        valB = b.health_score;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [transformers, searchQuery, zoneFilter, statusFilter, sortField, sortAsc]);

  const handleExportFleet = () => {
    const rows = filteredFleet.map((t) => ({
      ID: t.spec.id,
      Name: t.spec.name,
      Zone: t.spec.zone,
      RatedKva: t.spec.rated_capacity_kva,
      ActiveKw: t.telemetry.active_power_kw,
      LoadPct: t.telemetry.load_percentage,
      VoltageV: t.telemetry.voltage_v,
      CurrentA: t.telemetry.current_a,
      OilTempC: t.telemetry.oil_temp_c,
      HealthScore: t.health_score,
      HealthStatus: t.health_status,
      RiskLevel: t.risk_level,
      CommStatus: t.telemetry.communication_status,
    }));
    exportToCsv('fleet_telemetry_snapshot', rows);
  };

  const healthData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Healthy', value: summary.health_distribution.healthy, color: '#10b981' },
      { name: 'Attention', value: summary.health_distribution.warning, color: '#f59e0b' },
      { name: 'Critical', value: summary.health_distribution.critical, color: '#ef4444' },
    ];
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-sm font-mono text-slate-400">CONNECTING TO SIMULATED SCADA GRID...</p>
        </div>
      </div>
    );
  }

  const kpis = summary?.kpis || {
    total_transformers: 0,
    healthy_count: 0,
    warning_count: 0,
    critical_count: 0,
    avg_load_percentage: 0,
    active_alerts_count: 0,
  };

  const insights = summary?.insights;

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
            Network Operations Dashboard
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
              LIVE TELEMETRY
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time aggregate status, fleet loading, thermal distribution, and predictive risk indicators
          </p>
        </div>

        <button
          onClick={handleExportFleet}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Fleet CSV</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <MetricCard
          title="Total Fleet"
          value={kpis.total_transformers}
          unit="units"
          subtitle="All zones monitored"
          icon={<Radio className="w-4 h-4" />}
          variant="cyan"
        />
        <MetricCard
          title="Healthy Units"
          value={kpis.healthy_count}
          unit={`/ ${kpis.total_transformers}`}
          subtitle="Nominal operating"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          variant="emerald"
        />
        <MetricCard
          title="Attention Needed"
          value={kpis.warning_count}
          unit="units"
          subtitle="Warning thresholds"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          variant="amber"
        />
        <MetricCard
          title="Critical Risk"
          value={kpis.critical_count}
          unit="units"
          subtitle="Immediate action"
          icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
          variant="rose"
        />
        <MetricCard
          title="Avg Grid Load"
          value={kpis.avg_load_percentage}
          unit="%"
          subtitle="Fleet capacity used"
          icon={<Zap className="w-4 h-4 text-cyan-400" />}
          variant="cyan"
        />
        <MetricCard
          title="Active Alerts"
          value={kpis.active_alerts_count}
          unit="alarms"
          subtitle="Unresolved events"
          icon={<Activity className="w-4 h-4 text-amber-400" />}
          variant={kpis.active_alerts_count > 0 ? 'amber' : 'default'}
        />
      </div>

      {/* AI Operational Insights Panel */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {insights.highest_loaded_transformer && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/90 flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Highest Loaded Unit
                </div>
                <div className="mt-1 text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{insights.highest_loaded_transformer.id}</span>
                  <span className="text-xs text-rose-400 font-mono">
                    {insights.highest_loaded_transformer.load_percentage.toFixed(1)}% load
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {insights.highest_loaded_transformer.name} • {insights.highest_loaded_transformer.temperature_c.toFixed(1)}°C
                </p>
              </div>
            </div>
          )}

          {insights.greatest_load_zone && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/90 flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Zone with Greatest Load
                </div>
                <div className="mt-1 text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span className="truncate">{insights.greatest_load_zone.zone}</span>
                  <span className="text-xs text-cyan-400 font-mono shrink-0">
                    {insights.greatest_load_zone.avg_load_pct.toFixed(1)}% avg
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total load: {insights.greatest_load_zone.total_apparent_kva.toLocaleString()} kVA
                </p>
              </div>
            </div>
          )}

          {insights.most_urgent_maintenance && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/90 flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Urgent Maintenance
                </div>
                <div className="mt-1 text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                  <span className="truncate">{insights.most_urgent_maintenance.title}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Asset: {insights.most_urgent_maintenance.transformer_id} • Due: {insights.most_urgent_maintenance.scheduled_date}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Network Load Trend (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Network Load & Temperature Trend (24h)
              </h3>
              <p className="text-xs text-slate-400">Aggregate active grid power and mean transformer oil temperature</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary?.network_load_trend || []}>
                <defs>
                  <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  stroke="#475569"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(val) => {
                    try {
                      return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return val;
                    }
                  }}
                />
                <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="total_kw"
                  stroke="#00f2fe"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#loadGrad)"
                  name="Total Grid Load (kW)"
                />
                <Area
                  type="monotone"
                  dataKey="avg_temp_c"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  fill="none"
                  name="Avg Oil Temp (°C)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Distribution Donut */}
        <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Fleet Health Status
            </h3>
            <p className="text-xs text-slate-400">Condition breakdown across all monitored units</p>
          </div>

          <div className="h-48 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={5}
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3 border-t border-slate-800">
            <div>
              <div className="text-emerald-400 font-bold font-mono text-base">{kpis.healthy_count}</div>
              <div className="text-slate-400 text-[11px]">Healthy</div>
            </div>
            <div>
              <div className="text-amber-400 font-bold font-mono text-base">{kpis.warning_count}</div>
              <div className="text-slate-400 text-[11px]">Attention</div>
            </div>
            <div>
              <div className="text-rose-400 font-bold font-mono text-base">{kpis.critical_count}</div>
              <div className="text-slate-400 text-[11px]">Critical</div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Distribution Bar Chart */}
      <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Load Distribution by Substation Zone
        </h3>
        <p className="text-xs text-slate-400 mb-4">Total installed capacity vs active apparent load per sector</p>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary?.zone_distribution || []}>
              <XAxis dataKey="zone" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="total_rated_kva" fill="#334155" name="Rated Capacity (kVA)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_apparent_kva" fill="#00f2fe" name="Apparent Load (kVA)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fleet Overview Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        {/* Table Filters & Toolbar */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-950/40">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Transformer Fleet Telemetry Register
            </h3>
            <p className="text-xs text-slate-400">
              Click any transformer row to navigate to full high-frequency live monitoring
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search unit or zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            {/* Zone Filter */}
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="ALL">All Zones</option>
              <option value="North">Zone North (Industrial)</option>
              <option value="East">Zone East (Commercial)</option>
              <option value="South">Zone South (Residential)</option>
              <option value="West">Zone West (Technology)</option>
              <option value="Central">Zone Central (Transmission)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="ALL">All Health</option>
              <option value="HEALTHY">Healthy</option>
              <option value="WARNING">Attention</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 uppercase font-semibold text-slate-400 border-b border-slate-800 tracking-wider">
              <tr>
                <th
                  onClick={() => {
                    setSortField('id');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-cyan-400"
                >
                  <div className="flex items-center gap-1">
                    <span>Transformer ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Substation Zone</th>
                <th className="py-3 px-4 text-right">Rated (kVA)</th>
                <th
                  onClick={() => {
                    setSortField('load');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-cyan-400"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Active Load</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Voltage</th>
                <th className="py-3 px-4 text-right">Current</th>
                <th
                  onClick={() => {
                    setSortField('temp');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-cyan-400"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Oil Temp</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('health');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-3 px-4 text-center cursor-pointer hover:text-cyan-400"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Health Index</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Risk Level</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFleet.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No transformers match the selected query and filters.
                  </td>
                </tr>
              ) : (
                filteredFleet.map((t) => {
                  const isHighLoad = t.telemetry.load_percentage >= 100.0;
                  const isHighTemp = t.telemetry.oil_temp_c >= 80.0;

                  return (
                    <tr
                      key={t.spec.id}
                      onClick={() => navigate(`/monitoring?tx=${t.spec.id}`)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400 group-hover:text-cyan-300">
                        {t.spec.id}
                        <div className="text-[11px] font-sans font-normal text-slate-400 truncate max-w-[140px]">
                          {t.spec.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {t.spec.zone}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {t.spec.rated_capacity_kva.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className={isHighLoad ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                          {formatPower(t.telemetry.active_power_kw)}
                        </span>
                        <div
                          className={`text-[11px] font-bold ${
                            isHighLoad ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {formatPercentage(t.telemetry.load_percentage)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {formatVoltage(t.telemetry.voltage_v)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {t.telemetry.current_a.toFixed(1)} A
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className={isHighTemp ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                          {formatTemp(t.telemetry.oil_temp_c)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                            t.health_score >= 80
                              ? 'text-emerald-400 bg-emerald-950/60'
                              : t.health_score >= 50
                              ? 'text-amber-400 bg-amber-950/60'
                              : 'text-rose-400 bg-rose-950/60'
                          }`}
                        >
                          {t.health_score.toFixed(0)} / 100
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <RiskBadge level={t.risk_level} score={t.risk_score} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={t.telemetry.communication_status} size="sm" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
