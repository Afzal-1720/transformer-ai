import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  User,
  Plus,
  Download,
  X,
  Activity,
  FileText,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { exportToCsv } from '../utils/exportCsv';
import { formatDateTime, formatDate } from '../utils/formatters';
import type { InspectionRecord, TransformerDetail, InspectionPriority } from '../types';

export const InspectionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const txFilterParam = searchParams.get('tx') || 'ALL';

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [transformers, setTransformers] = useState<TransformerDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedTxFilter, setSelectedTxFilter] = useState<string>(txFilterParam);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [completingRecord, setCompletingRecord] = useState<InspectionRecord | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  // Create form state
  const [createTxId, setCreateTxId] = useState<string>('TX-001');
  const [createReason, setCreateReason] = useState<string>('');
  const [createPriority, setCreatePriority] = useState<InspectionPriority>('High');
  const [createAction, setCreateAction] = useState<string>('');
  const [createTechnician, setCreateTechnician] = useState<string>('Substation Field Crew Alpha');
  const [createNotes, setCreateNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [inspList, fleet] = await Promise.all([
        api.getInspections(),
        api.getTransformers(),
      ]);
      setInspections(inspList);
      setTransformers(fleet);
    } catch (err) {
      console.error('Error loading inspection data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Acknowledge handler
  const handleAcknowledge = async (id: string) => {
    try {
      await api.updateInspection(id, {
        status: 'Acknowledged',
        acknowledged_at: new Date().toISOString(),
      });
      await loadData();
    } catch (err: any) {
      alert(`Error acknowledging inspection: ${err.message}`);
    }
  };

  // Complete handler
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingRecord) return;
    try {
      await api.updateInspection(completingRecord.id, {
        status: 'Completed',
        completed_at: new Date().toISOString(),
        notes: completionNotes.trim()
          ? `${completingRecord.notes || ''}\n[Completion Note]: ${completionNotes}`.trim()
          : completingRecord.notes,
      });
      setCompletingRecord(null);
      setCompletionNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Error completing inspection: ${err.message}`);
    }
  };

  // Create new inspection
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createReason.trim() || !createAction.trim()) {
      alert('Please fill out the reason and recommended action.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createInspection({
        transformer_id: createTxId,
        reason: createReason,
        priority: createPriority,
        recommended_action: createAction,
        assigned_technician: createTechnician,
        notes: createNotes,
      });
      setIsCreateModalOpen(false);
      setCreateReason('');
      setCreateAction('');
      setCreateNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Error creating inspection: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return inspections.filter((rec) => {
      if (selectedTxFilter !== 'ALL' && rec.transformer_id !== selectedTxFilter) return false;
      if (selectedStatusFilter !== 'ALL' && rec.status !== selectedStatusFilter) return false;
      if (selectedPriorityFilter !== 'ALL' && rec.priority !== selectedPriorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.transformer_id.toLowerCase().includes(q) ||
          rec.transformer_name.toLowerCase().includes(q) ||
          rec.reason.toLowerCase().includes(q) ||
          rec.recommended_action.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inspections, selectedTxFilter, selectedStatusFilter, selectedPriorityFilter, searchQuery]);

  const handleExportCsv = () => {
    if (!filteredRecords.length) return;
    const rows = filteredRecords.map((r) => ({
      inspection_id: r.id,
      transformer_id: r.transformer_id,
      transformer_name: r.transformer_name,
      priority: r.priority,
      status: r.status,
      reason: r.reason,
      recommended_action: r.recommended_action,
      detected_at: r.detected_at,
      acknowledged_at: r.acknowledged_at || 'N/A',
      completed_at: r.completed_at || 'N/A',
      assigned_technician: r.assigned_technician,
      notes: r.notes || '',
    }));
    exportToCsv('transformer_inspections', rows);
  };

  // Count summaries
  const pendingCount = inspections.filter((i) => i.status === 'Pending').length;
  const ackCount = inspections.filter((i) => i.status === 'Acknowledged').length;
  const completedCount = inspections.filter((i) => i.status === 'Completed').length;
  const unitsNeedingInspection = transformers.filter((t) => t.inspection_required);

  if (loading && !inspections.length) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <Activity className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">
            Loading Inspection Records...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 uppercase">
              Inspection & Maintenance Workflow
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Field Dispatch
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Work order tracking for abnormal readings, sensor excursions, field verifications, and technician maintenance sign-offs.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-950/50 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-900/60 shadow-[0_0_15px_rgba(0,242,254,0.15)]"
          >
            <Plus className="h-4 w-4" />
            Create Inspection Work Order
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Advisory Banner: Abnormal Reading vs Confirmed Failure Distinction */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-amber-300">Operational Guideline — Abnormal Telemetry vs Confirmed Failure:</strong>
            <p className="text-amber-200/80 leading-relaxed">
              An abnormal sensor reading or rapid telemetry fluctuation indicates that an <strong>on-site technical inspection is required</strong> to inspect physical conditions, verify voltage taps, probe cooling radiators, and examine terminal bushings. It does <em>not</em> necessarily confirm internal transformer breakdown. Dispatch maintenance crew for diagnosis before taking the unit out of service.
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-cyan-500/30 bg-slate-900/80 p-4">
          <div className="text-xs uppercase text-slate-400 font-semibold">Units Requiring Inspection</div>
          <div className="text-2xl font-mono font-bold text-cyan-300 mt-2">
            {unitsNeedingInspection.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Based on live parameter thresholds</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-slate-900/80 p-4">
          <div className="text-xs uppercase text-slate-400 font-semibold">Pending Action</div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-2">
            {pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">New work orders awaiting triage</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-slate-900/80 p-4">
          <div className="text-xs uppercase text-slate-400 font-semibold">Acknowledged / In Progress</div>
          <div className="text-2xl font-mono font-bold text-blue-400 mt-2">
            {ackCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Assigned to field technicians</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-slate-900/80 p-4">
          <div className="text-xs uppercase text-slate-400 font-semibold">Completed Inspections</div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">
            {completedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Resolved and signed-off</div>
        </div>
      </div>

      {/* Inspection Orders Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        {/* Table Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Inspection Work Order Register
            </h2>
            <p className="text-xs text-slate-400">
              Complete audit history with timestamped acknowledgment and technician completion sign-offs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search reason, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedTxFilter}
              onChange={(e) => setSelectedTxFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Transformers</option>
              {transformers.map((t) => (
                <option key={t.spec.id} value={t.spec.id}>
                  {t.spec.id} ({t.spec.name})
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Completed">Completed</option>
            </select>

            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Routine">Routine</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3.5 py-3">Order ID & Unit</th>
                <th className="px-3.5 py-3">Priority</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3">Reason for Inspection</th>
                <th className="px-3.5 py-3">Recommended Operator Action</th>
                <th className="px-3.5 py-3">Assigned Crew</th>
                <th className="px-3.5 py-3">Timeline</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No inspection work orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-800/40">
                      {/* ID & Transformer */}
                      <td className="px-3.5 py-3">
                        <div className="font-mono font-bold text-slate-200">{r.id}</div>
                        <div className="text-[11px] text-cyan-400 font-mono">
                          {r.transformer_id} • {r.transformer_name}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-3.5 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            r.priority === 'Critical'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : r.priority === 'High'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {r.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3">
                        <StatusBadge status={r.status} size="sm" />
                      </td>

                      {/* Reason */}
                      <td className="px-3.5 py-3 max-w-xs">
                        <p className="font-medium text-slate-200 line-clamp-2">{r.reason}</p>
                      </td>

                      {/* Recommended Action */}
                      <td className="px-3.5 py-3 max-w-xs">
                        <div className="rounded bg-slate-950/80 p-1.5 text-[11px] text-cyan-300 line-clamp-2">
                          {r.recommended_action}
                        </div>
                      </td>

                      {/* Assigned Tech */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          <span>{r.assigned_technician}</span>
                        </div>
                      </td>

                      {/* Timeline */}
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400">
                        <div>Detected: {formatDate(r.detected_at)}</div>
                        {r.acknowledged_at && (
                          <div className="text-amber-400/80">Ack: {formatDateTime(r.acknowledged_at)}</div>
                        )}
                        {r.completed_at && (
                          <div className="text-emerald-400/80">Done: {formatDateTime(r.completed_at)}</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'Pending' && (
                            <button
                              onClick={() => handleAcknowledge(r.id)}
                              className="rounded bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-900/60"
                            >
                              Acknowledge
                            </button>
                          )}
                          {r.status === 'Acknowledged' && (
                            <button
                              onClick={() => {
                                setCompletingRecord(r);
                                setCompletionNotes('');
                              }}
                              className="rounded bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/60"
                            >
                              Sign Off / Complete
                            </button>
                          )}
                          {r.status === 'Completed' && (
                            <span className="text-[11px] text-emerald-400 font-semibold">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Inspection Sign-off Modal */}
      {completingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                  Complete Inspection Order
                </h3>
              </div>
              <button
                onClick={() => setCompletingRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400">Order ID:</span>{' '}
                <span className="font-mono font-bold text-slate-200">{completingRecord.id}</span>
              </div>
              <div>
                <span className="text-slate-400">Unit:</span>{' '}
                <span className="font-mono font-bold text-cyan-400">
                  {completingRecord.transformer_id} ({completingRecord.transformer_name})
                </span>
              </div>
              <div>
                <span className="text-slate-400">Reason:</span>
                <p className="mt-1 text-slate-300 bg-slate-900 p-2 rounded">
                  {completingRecord.reason}
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Technician Sign-off Notes & Findings:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Completed tap changer calibration and visual oil level inspection. All parameters normal."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingRecord(null)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
                >
                  Confirm Completion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Inspection Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                  Create Inspection Work Order
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Transformer:</label>
                  <select
                    value={createTxId}
                    onChange={(e) => setCreateTxId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {transformers.map((t) => (
                      <option key={t.spec.id} value={t.spec.id}>
                        {t.spec.id} ({t.spec.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Priority:</label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as InspectionPriority)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Routine">Routine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Reason for Inspection:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Voltage fluctuations detected exceeding permissible limits"
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Recommended Operator Action:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify substation tap-changer setting and inspect terminal connections"
                  value={createAction}
                  onChange={(e) => setCreateAction(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Assigned Crew:</label>
                  <input
                    type="text"
                    value={createTechnician}
                    onChange={(e) => setCreateTechnician(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Initial Notes:</label>
                  <input
                    type="text"
                    placeholder="Optional notes"
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};