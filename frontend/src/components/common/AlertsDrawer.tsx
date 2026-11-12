import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Download, Filter, Bell } from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTime, formatDate } from '../../utils/formatters';
import { exportToCsv } from '../../utils/exportCsv';
import type { Alert } from '../../types';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertUpdated?: () => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({ isOpen, onClose, onAlertUpdated }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts({
        status: statusFilter,
        severity: severityFilter,
      });
      setAlerts(data);
    } catch (err: any) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen, loadAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      await loadAlerts();
      if (onAlertUpdated) onAlertUpdated();
    } catch (err: any) {
      alert(`Error acknowledging alert: ${err.message}`);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await api.resolveAlert(alertId);
      await loadAlerts();
      if (onAlertUpdated) onAlertUpdated();
    } catch (err: any) {
      alert(`Error resolving alert: ${err.message}`);
    }
  };

  const handleExport = () => {
    const rows = alerts.map((a) => ({
      ID: a.id,
      Transformer: a.transformer_id,
      Substation: a.substation,
      Severity: a.severity,
      Category: a.category,
      Metric: a.triggering_metric,
      TriggerValue: a.triggering_value,
      Threshold: a.threshold_value,
      Unit: a.unit,
      Status: a.status,
      Message: a.message,
      Action: a.recommended_action,
      CreatedAt: a.created_at,
      ResolvedAt: a.resolved_at || '',
    }));
    exportToCsv('grid_alerts_history', rows);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Intelligent Grid Alerts & Event Logs</h2>
              <p className="text-xs text-slate-400">
                SCADA threshold notifications with hysteresis debouncing and operator actions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              title="Export alerts to CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold uppercase tracking-wider">Filters:</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded bg-slate-950 border border-slate-800 px-2 py-1 text-slate-200 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Alarms</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded bg-slate-950 border border-slate-800 px-2 py-1 text-slate-200 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <span className="ml-auto text-slate-500 font-mono">
            {alerts.length} record{alerts.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 animate-pulse">
              Loading alerts stream...
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No matching alarms found</p>
              <p className="text-xs text-slate-500 mt-1">
                All transformers operating within configured safety bounds or filter excludes results.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const isCrit = alert.severity === 'CRITICAL';
              const isWarn = alert.severity === 'WARNING';
              const borderCls = isCrit ? 'border-rose-800/80 bg-rose-950/20' : isWarn ? 'border-amber-800/80 bg-amber-950/20' : 'border-slate-800 bg-slate-950/40';

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border ${borderCls} transition-all hover:border-slate-700`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          isCrit
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-300">
                        {alert.transformer_id}
                      </span>
                      <span className="text-xs text-slate-500">• {alert.substation}</span>
                    </div>

                    <div className="text-right text-[11px] text-slate-400">
                      <span>{formatDateTime(alert.created_at)}</span>
                      <span className="text-slate-600 ml-1">({formatDate(alert.created_at)})</span>
                    </div>
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-200">
                    {alert.message}
                  </p>

                  <div className="mt-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
                    <span className="font-semibold text-cyan-400">Recommended Operator Action: </span>
                    <span className="text-slate-300">{alert.recommended_action}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      <span>
                        Trigger: <strong className="text-slate-200">{alert.triggering_value} {alert.unit}</strong>
                      </span>
                      <span>
                        Threshold: <strong className="text-slate-200">{alert.threshold_value} {alert.unit}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {alert.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 text-xs font-semibold transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                      {alert.status === 'RESOLVED' && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Disclaimer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-center text-[11px] text-slate-500">
          Operational decisions must be verified by qualified electrical personnel. Simulated SCADA data only.
        </div>
      </div>
    </div>
  );
};
