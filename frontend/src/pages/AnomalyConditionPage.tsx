import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Activity,
  Zap,
  Flame,
  TrendingUp,
  Radio,
  Sliders,
  ClipboardCheck,
  RefreshCw,
  Info,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { useSimulation } from '../context/SimulationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AnomalyTriggerModal } from '../components/common/AnomalyTriggerModal';
import {
  formatVoltage,
  formatCurrent,
  formatTemp,
  formatPercentage,
  formatDateTime,
} from '../utils/formatters';
import type {
  TransformerConditionReport,
  AnomalySummary,
  TransformerDetail,
  DetectedAnomaly,
} from '../types';

export const AnomalyConditionPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const txParam = searchParams.get('tx') || 'TX-001';

  const { clearAnomaly } = useSimulation();

  const [transformers, setTransformers] = useState<TransformerDetail[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>(txParam);
  const [conditionReport, setConditionReport] = useState<TransformerConditionReport | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<AnomalySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState<boolean>(false);

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
      const [fleet, report, anomalies] = await Promise.all([
        api.getTransformers(),
        api.getTransformerCondition(selectedTxId),
        api.getTransformerAnomalies(selectedTxId),
      ]);
      setTransformers(fleet);
      setConditionReport(report);
      setAnomalySummary(anomalies);
    } catch (err) {
      console.error('Error loading condition/anomalies data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTxId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreateInspection = async (anomaly: DetectedAnomaly) => {
    try {
      await api.createInspection({
        transformer_id: anomaly.transformer_id,
        reason: `${anomaly.anomaly_name}: ${anomaly.detected_parameter} reached ${anomaly.measured_value} (Threshold: ${anomaly.applicable_threshold})`,
        priority: anomaly.severity === 'Critical' ? 'Critical' : 'High',
        recommended_action: anomaly.recommended_action,
        assigned_technician: 'Grid Maintenance Crew A',
        notes: `Auto-generated from anomaly event detected at ${anomaly.detection_time}.`,
      });
      navigate(`/maintenance?tx=${anomaly.transformer_id}`);
    } catch (err: any) {
      alert(`Failed to create inspection: ${err.message}`);
    }
  };

  if (loading && !conditionReport) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <Activity className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">
            Evaluating Transformer Condition & Anomalies...
          </span>
        </div>
      </div>
    );
  }

  const overallCondition = conditionReport?.overall_condition || 'HEALTHY';
  const anomaliesList = anomalySummary?.anomalies || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 uppercase">
              Anomaly Detection & Condition Assessment
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Automated Reasoning
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Rule-based detection for over/under-voltage, over-current, hotspot thermal rise, sudden load fluctuations, and 4-tier condition evaluation.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsInjectModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-950/50 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-900/60 shadow-[0_0_15px_rgba(0,242,254,0.15)]"
          >
            <Sliders className="h-4 w-4" />
            Simulate / Inject Anomaly
          </button>
          <button
            onClick={() => clearAnomaly(selectedTxId)}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4 text-slate-400" />
            Reset Anomalies
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

      {/* SECTION 1: Overall Condition Assessment Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Assessed Transformer Condition:
              </span>
              <StatusBadge status={overallCondition} />
              {conditionReport?.inspection_required && (
                <span className="rounded-full bg-cyan-950 border border-cyan-800 px-3 py-0.5 text-xs font-bold text-cyan-300 animate-pulse">
                  INSPECTION REQUIRED
                </span>
              )}
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Condition Diagnostic Summary:
              </div>
              <p className="text-sm font-medium text-slate-200 leading-relaxed">
                {conditionReport?.condition_explanation}
              </p>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                <ClipboardCheck className="h-4 w-4" />
                Recommended Operator Action:
              </div>
              <p className="text-sm font-semibold text-cyan-200">
                {conditionReport?.recommended_action}
              </p>
            </div>
          </div>

          {/* Quick Details Column */}
          <div className="w-full md:w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 text-xs font-mono">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
              Unit Telemetry Snapshot
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transformer ID:</span>
              <span className="font-bold text-slate-200">{selectedTxId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Measured Vrms:</span>
              <span className="font-bold text-cyan-400">
                {formatVoltage(conditionReport?.vrms_measured ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rated Voltage:</span>
              <span className="text-slate-400">240.0 Vrms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Measured Arms:</span>
              <span className="font-bold text-emerald-400">
                {formatCurrent(conditionReport?.irms_measured ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Loading %:</span>
              <span className="font-bold text-slate-200">
                {formatPercentage(conditionReport?.loading_pct ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Winding Hotspot:</span>
              <span className="font-bold text-amber-400">
                {formatTemp(conditionReport?.winding_hotspot_temperature ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Moisture:</span>
              <span className="font-bold text-slate-300">
                {formatPercentage(conditionReport?.moisture ?? 0)} RH
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: The 4 Separate Operating Evaluations */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
          Comprehensive 4-Tier Condition Breakdown
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Evaluation 1: Sensor Connectivity */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
              <span>1. Sensor Connectivity</span>
              <Radio className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-3">
              <StatusBadge status={conditionReport?.sensor_connectivity || 'ONLINE'} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Evaluates sensor ping heartbeat and communication latency to edge gateway.
            </p>
          </div>

          {/* Evaluation 2: Voltage Behaviour */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
              <span>2. Voltage Behaviour</span>
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-3">
              <StatusBadge status={conditionReport?.voltage_behaviour || 'STABLE'} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Evaluates voltage stability, standard deviation &gt;4V fluctuations, and statutory limits.
            </p>
          </div>

          {/* Evaluation 3: Loading Condition */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
              <span>3. Loading Condition</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <StatusBadge status={conditionReport?.loading_condition || 'NORMAL'} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Evaluated against rated current capacity: Normal (&lt;80%), High (80-100%), Overloaded (&gt;100%).
            </p>
          </div>

          {/* Evaluation 4: Thermal Condition */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
              <span>4. Thermal Condition</span>
              <Flame className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <StatusBadge status={conditionReport?.thermal_condition || 'NORMAL'} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Evaluates winding hotspot temperature: Normal (&lt;80°C), Elevated (80-95°C), Overheating (&gt;95°C).
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: Active Detected Anomalies List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Active Detected Anomalies ({anomaliesList.length})
            </h2>
            <p className="text-xs text-slate-400">
              Real-time anomaly identification with severity, measured parameter, applicable threshold, and action path.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Debounce Filter: Active (No Duplicate Alert Spam)
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {anomaliesList.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <div className="text-sm font-bold text-slate-200">No Anomalies Detected on {selectedTxId}</div>
              <p className="text-xs text-slate-400 mt-1">
                Voltage deviation is within permissible limits (-10% to +6%), current is normal, winding hotspot temperature is safe, and load is steady.
              </p>
            </div>
          ) : (
            anomaliesList.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 transition-colors hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        {a.anomaly_name}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          a.severity === 'Critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {a.severity}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {formatDateTime(a.detection_time)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-1 text-slate-300">
                      <div>
                        <span className="text-slate-500">Parameter: </span>
                        <strong>{a.detected_parameter}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Measured: </span>
                        <strong className="text-rose-400">{a.measured_value}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Threshold: </span>
                        <strong>{a.applicable_threshold}</strong>
                      </div>
                    </div>

                    {a.percentage_change !== undefined && (
                      <div className="text-xs font-mono text-amber-400">
                        Fluctuation Rate: <strong>{formatPercentage(a.percentage_change, true)}</strong> against baseline
                      </div>
                    )}

                    <div className="mt-2 text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 rounded-lg p-2.5">
                      <strong>Operator Action:</strong> {a.recommended_action}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCreateInspection(a)}
                      className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-900/40 px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-800"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Create Inspection Order
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 4: Special Anomaly Conditions: Sudden Load Variation & Phase Imbalance Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sudden Load Variation Logic Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Sudden Load Variation Engine
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
              Monitoring Active
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Continuously compares the latest RMS current reading with the rolling 10-point baseline. Automatically detects unexpected surges or abrupt dropouts exceeding 25%.
          </p>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
            <div className="flex justify-between font-mono">
              <span className="text-slate-500">Configured Variation Threshold:</span>
              <span className="text-slate-200 font-bold">±25.0% rapid shift</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-500">Baseline Window:</span>
              <span className="text-slate-200">Rolling 10 telemetry ticks</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-500">Debounce Mechanism:</span>
              <span className="text-emerald-400">Suppresses duplicate alerts for ongoing anomaly</span>
            </div>
          </div>
        </div>

        {/* Phase Imbalance (Optional / Hardware-Gated Feature) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-slate-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Phase Imbalance Detection
              </h3>
            </div>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400 uppercase font-bold">
              FEATURE DISABLED
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {anomalySummary?.phase_imbalance_status ||
              'Requires 3-phase hardware telemetry. Single-phase RMS hardware telemetry only; phase-level data is not fabricated.'}
          </p>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Info className="h-4 w-4 text-cyan-400" />
              Engineering Integrity Notice:
            </div>
            <p className="text-[11px] leading-relaxed">
              In accordance with specification guidelines, synthetic phase-level voltages (Va, Vb, Vc) are not fabricated when the physical or mock hardware only streams single-phase RMS metrics. This module automatically unlocks when 3-phase IoT hardware is connected.
            </p>
          </div>
        </div>
      </div>

      {/* Anomaly Trigger Modal */}
      <AnomalyTriggerModal
        isOpen={isInjectModalOpen}
        onClose={() => {
          setIsInjectModalOpen(false);
          loadData();
        }}
        defaultTransformerId={selectedTxId}
      />
    </div>
  );
};