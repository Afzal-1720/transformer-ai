import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Download,
  Calendar,
  User,
  Filter,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { exportToCsv } from '../utils/exportCsv';
import type { AssetHealthRecord, MaintenanceTask } from '../types';

export const MaintenancePage: React.FC = () => {
  const [assetRegister, setAssetRegister] = useState<AssetHealthRecord[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'register' | 'tasks'>('register');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedAssetForFormula, setSelectedAssetForFormula] = useState<AssetHealthRecord | null>(null);

  // Form State
  const [newTxId, setNewTxId] = useState<string>('TX-101');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('P3_MEDIUM');
  const [newTech, setNewTech] = useState<string>('Substation Field Crew Alpha');
  const [newDate, setNewDate] = useState<string>(
    new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)
  );
  const [newNotes, setNewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const resp = await api.getMaintenanceOverview();
      setAssetRegister(resp.asset_register);
      setTasks(resp.tasks);
    } catch (err) {
      console.error('Error loading maintenance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Please provide a task title.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createMaintenanceTask({
        transformer_id: newTxId,
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        assigned_technician: newTech,
        scheduled_date: newDate,
        notes: newNotes,
      });
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Error creating maintenance task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    try {
      await api.updateMaintenanceTask(taskId, { status: status as any });
      await loadData();
    } catch (err: any) {
      alert(`Error updating task: ${err.message}`);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskStatusFilter !== 'ALL' && t.status !== taskStatusFilter) return false;
      if (taskPriorityFilter !== 'ALL' && t.priority !== taskPriorityFilter) return false;
      return true;
    });
  }, [tasks, taskStatusFilter, taskPriorityFilter]);

  const handleExportTasks = () => {
    const rows = tasks.map((t) => ({
      ID: t.id,
      TransformerID: t.transformer_id,
      Title: t.title,
      Priority: t.priority,
      Status: t.status,
      Technician: t.assigned_technician,
      ScheduledDate: t.scheduled_date,
      CompletedDate: t.completed_date || '',
      Notes: t.notes || '',
    }));
    exportToCsv('maintenance_tasks_log', rows);
  };

  const handleExportAssets = () => {
    const rows = assetRegister.map((a) => ({
      ID: a.transformer_id,
      Name: a.transformer_name,
      Zone: a.zone,
      RatedKva: a.rated_capacity_kva,
      HealthScore: a.health_score,
      Condition: a.condition_category,
      Priority: a.maintenance_priority,
      LastInspection: a.last_inspection_date,
      NextInspection: a.next_inspection_date,
      OpenTasks: a.open_tasks_count,
    }));
    exportToCsv('asset_health_register', rows);
  };

  if (loading && assetRegister.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400 font-mono text-sm animate-pulse">
        LOADING ASSET REGISTER & MAINTENANCE LOGS...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
            Maintenance & Asset Health Register
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
              ASSET MANAGEMENT
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Condition-based maintenance prioritization, health index calculation, and work order tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </button>

          <button
            onClick={activeTab === 'register' ? handleExportAssets : handleExportTasks}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-sm">
        <button
          onClick={() => setActiveTab('register')}
          className={`pb-3 px-4 font-bold border-b-2 transition-colors ${
            activeTab === 'register'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Asset Condition Register ({assetRegister.length})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-4 font-bold border-b-2 transition-colors ${
            activeTab === 'tasks'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Maintenance Work Orders ({tasks.length})
        </button>
      </div>

      {/* TAB 1: ASSET REGISTER */}
      {activeTab === 'register' && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase font-semibold text-slate-400 border-b border-slate-800 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Transformer</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4 text-center">Health Score</th>
                  <th className="py-3 px-4 text-center">Condition</th>
                  <th className="py-3 px-4 text-center">Inspection Priority</th>
                  <th className="py-3 px-4">Last Inspection</th>
                  <th className="py-3 px-4">Next Recommended</th>
                  <th className="py-3 px-4 text-center">Open Tasks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assetRegister.map((asset) => {
                  const score = asset.health_score;
                  const isFair = score >= 50 && score < 75;

                  return (
                    <tr key={asset.transformer_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        {asset.transformer_id}
                        <div className="text-[11px] font-sans font-normal text-slate-400 truncate max-w-[150px]">
                          {asset.transformer_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{asset.zone}</td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold ${
                            score >= 80
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isFair
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {score.toFixed(0)} / 100
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        <span
                          className={`text-xs uppercase ${
                            asset.condition_category === 'GOOD'
                              ? 'text-emerald-400'
                              : asset.condition_category === 'FAIR'
                              ? 'text-cyan-400'
                              : asset.condition_category === 'DEGRADED'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {asset.condition_category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            asset.maintenance_priority === 'P1_CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : asset.maintenance_priority === 'P2_HIGH'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {asset.maintenance_priority.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {asset.last_inspection_date}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {asset.next_inspection_date}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {asset.open_tasks_count > 0 ? (
                          <span className="text-amber-400">{asset.open_tasks_count}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedAssetForFormula(asset)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition-colors"
                        >
                          Score Formula
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: WORK ORDERS LIST */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              Filter Tasks:
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-400">Status:</span>
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-400">Priority:</span>
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-slate-200"
              >
                <option value="ALL">All Priorities</option>
                <option value="P1_CRITICAL">P1 Critical</option>
                <option value="P2_HIGH">P2 High</option>
                <option value="P3_MEDIUM">P3 Medium</option>
                <option value="P4_ROUTINE">P4 Routine</option>
              </select>
            </div>

            <span className="ml-auto text-slate-500 font-mono">
              {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((t) => {
              const isCompleted = t.status === 'COMPLETED';
              const isInProgress = t.status === 'IN_PROGRESS';

              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                    isCompleted
                      ? 'bg-slate-950/40 border-slate-800/80 opacity-75'
                      : 'bg-slate-900/90 border-slate-800 shadow-lg'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {t.transformer_id} • {t.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          t.priority === 'P1_CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : t.priority === 'P2_HIGH'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {t.priority.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100">{t.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{t.assigned_technician}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Due: {t.scheduled_date}</span>
                      </div>
                      {t.notes && (
                        <div className="text-[11px] text-slate-500 italic mt-1 bg-slate-950/60 p-1.5 rounded">
                          "{t.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isCompleted
                          ? 'text-emerald-400'
                          : isInProgress
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isInProgress && !isCompleted && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {!isCompleted && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                          className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 text-xs font-bold transition-colors border border-emerald-700/60"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: HEALTH SCORE FORMULA BREAKDOWN */}
      {selectedAssetForFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Health Index Calculation Breakdown ({selectedAssetForFormula.transformer_id})
                </h3>
                <p className="text-xs text-slate-400">
                  Transparent asset health derating formula based on thermal, load, and age factors
                </p>
              </div>
              <button
                onClick={() => setSelectedAssetForFormula(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Baseline Perfect Condition:</span>
                <span className="font-mono font-bold text-emerald-400">100.0 pts</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-slate-200 font-medium block">Operational & Thermal Stress Penalty:</span>
                  <span className="text-[10px] text-slate-500">
                    Derived from multi-factor risk engine (temperature, overload, voltage drift)
                  </span>
                </div>
                <span className="font-mono font-bold text-rose-400">
                  -{selectedAssetForFormula.health_score_breakdown.operational_stress_penalty} pts
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-slate-200 font-medium block">
                    Asset Aging Derating ({selectedAssetForFormula.health_score_breakdown.asset_age_years} years):
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Standard transformer paper insulation thermal life consumption
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400">
                  -{selectedAssetForFormula.health_score_breakdown.aging_derating_penalty} pts
                </span>
              </div>

              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/80 flex justify-between items-center">
                <span className="font-bold text-cyan-300 uppercase tracking-wider">
                  Final Calculated Health Score:
                </span>
                <span className="font-mono text-xl font-black text-cyan-400">
                  {selectedAssetForFormula.health_score.toFixed(1)} / 100
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 text-[11px] text-slate-500">
              <strong>Notice:</strong> This index represents an academic demo calculation based on simulated sensor data. It does not replace IEEE/IEC certified laboratory DGA or furan analysis.
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateTask}
            className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                Create Maintenance Work Order
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Target Transformer</label>
                <select
                  value={newTxId}
                  onChange={(e) => setNewTxId(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200"
                >
                  {assetRegister.map((a) => (
                    <option key={a.transformer_id} value={a.transformer_id}>
                      {a.transformer_id} — {a.transformer_name} ({a.health_score.toFixed(0)} health)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Radiator Fan Bearing Replacement"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200"
                  >
                    <option value="P1_CRITICAL">P1 Critical</option>
                    <option value="P2_HIGH">P2 High</option>
                    <option value="P3_MEDIUM">P3 Medium</option>
                    <option value="P4_ROUTINE">P4 Routine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Assigned Lead / Team</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Substation Maintenance Unit 4"
                  value={newTech}
                  onChange={(e) => setNewTech(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Description & Scope</label>
                <textarea
                  rows={2}
                  placeholder="Detail inspection procedures, isolation requirements, or parts needed."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Initial Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Requires partial bus de-energization"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,242,254,0.3)] disabled:opacity-50"
              >
                Create Work Order
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
