import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Zap,
  TrendingUp,
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

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

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

  const monitoredTransformer = summary?.transformer_summaries ?? [];

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
    exportToCsv('Transformer_1_status', rows);
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
  const conditionSummary = summary?.fleet_condition;

  return (
    <div className="space-y-6">
      {/* Hardware API Notice & Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 uppercase">
              Transformer Dashboard
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
            Export Transformer CSV
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

      {/* Transformer KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Monitored Transformer"
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
          title="Transformer Load"
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

      {/* Transformer Condition & Health Assessment Status Bar */}
      {conditionSummary && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Transformer Operating Health Status:
                </span>
                <StatusBadge status={conditionSummary.status} />
              </div>
              <p className="text-sm font-medium text-slate-300">
                {conditionSummary.description}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-400">Healthy:</span>
                <span className="font-bold text-slate-200">{conditionSummary.healthy}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-400">Warning:</span>
                <span className="font-bold text-slate-200">{conditionSummary.warning}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-400">Critical:</span>
                <span className="font-bold text-slate-200">{conditionSummary.critical}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <span className="text-slate-400">Inspect Req:</span>
                <span className="font-bold text-cyan-300">{conditionSummary.inspection_required}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monitored Transformer Table */}
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

        </div>

        {/* Table Content */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3.5 py-3">Transformer</th>
                <th className="px-3.5 py-3">Voltage (Vrms) & Dev %</th>
                <th className="px-3.5 py-3">Statutory Range (216–254V)</th>
                <th className="px-3.5 py-3">Current (Arms) & Dev %</th>
                <th className="px-3.5 py-3">Loading %</th>
                <th className="px-3.5 py-3">Winding Hotspot</th>
                <th className="px-3.5 py-3">Moisture</th>
                <th className="px-3.5 py-3">Overall Condition</th>
                <th className="px-3.5 py-3">Inspection</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {monitoredTransformer.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No telemetry available for Transformer_1.
                  </td>
                </tr>
              ) : (
                monitoredTransformer.map((t) => {
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
                        <div className="text-[11px] text-cyan-400/80">{t.name}</div>
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

      {/* Recent Abnormal Conditions & Alert Notifications */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Recent Abnormal Conditions & Alerts
            </h2>
            <p className="text-xs text-slate-400">
              Real-time detected fluctuations, statutory parameter excursions, and inspection recommendations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/anomalies')}
              className="text-xs font-semibold text-cyan-400 hover:underline"
            >
              Simulate Anomaly →
            </button>
            <button
              onClick={() => navigate('/maintenance')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              View Inspections →
            </button>
          </div>
        </div>

        <div className="mt-4">
          {!summary?.recent_alerts || summary.recent_alerts.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 rounded-lg border border-slate-800/80 bg-slate-950/60">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
              No abnormal conditions detected. Transformer_1 is within normal limits.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.recent_alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-3.5 text-xs transition-colors hover:border-slate-700 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono font-bold text-slate-200">
                        Transformer_1
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    <p className="mt-1.5 font-medium text-slate-300">{alert.message}</p>

                    <div className="mt-2 rounded bg-slate-900 px-2 py-1.5 text-[11px] text-cyan-300 border border-slate-800">
                      <strong>Action:</strong> {alert.recommended_action}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{formatDateTime(alert.created_at)}</span>
                    {alert.inspection_recommended && (
                      <span className="font-bold text-amber-400">Inspection Advised</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};