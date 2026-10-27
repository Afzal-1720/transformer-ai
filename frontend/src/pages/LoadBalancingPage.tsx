import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitCompare,
  ArrowRight,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  Sliders,
  Layers,
  Activity,
} from 'lucide-react';
import { api } from '../services/api';
import type { TransformerDetail, LoadTransferResponse } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const LoadBalancingPage: React.FC = () => {
  const [transformers, setTransformers] = useState<TransformerDetail[]>([]);
  const [sourceId, setSourceId] = useState<string>('TX-101');
  const [targetId, setTargetId] = useState<string>('TX-102');
  const [transferKva, setTransferKva] = useState<number>(300);
  const [safetyMargin, setSafetyMargin] = useState<number>(85);

  const [result, setResult] = useState<LoadTransferResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load transformers fleet
  const loadFleet = useCallback(async () => {
    try {
      const fleet = await api.getTransformers();
      setTransformers(fleet);
      // Pick initial heavily loaded unit if available
      const heavilyLoaded = fleet.find((t) => t.telemetry.load_percentage >= 85);
      if (heavilyLoaded && heavilyLoaded.spec.id !== sourceId) {
        setSourceId(heavilyLoaded.spec.id);
      }
    } catch (err: any) {
      console.error('Failed to load fleet:', err);
    }
  }, []);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  // Run simulation calculation
  const handleSimulate = useCallback(async () => {
    if (sourceId === targetId) {
      setError('Source and target transformers must be distinct units.');
      return;
    }
    setError(null);
    try {
      const resp = await api.simulateLoadTransfer({
        source_id: sourceId,
        target_id: targetId,
        transfer_kva: transferKva,
        safety_margin_pct: safetyMargin,
      });
      setResult(resp);
    } catch (err: any) {
      setError(err.message || 'Error running load balancing simulation.');
    }
  }, [sourceId, targetId, transferKva, safetyMargin]);

  useEffect(() => {
    if (sourceId && targetId) {
      handleSimulate();
    }
  }, [sourceId, targetId, transferKva, safetyMargin, handleSimulate]);

  const sourceTx = transformers.find((t) => t.spec.id === sourceId);
  const targetTx = transformers.find((t) => t.spec.id === targetId);

  // Comparison Bar Chart data
  const comparisonData = useMemo(() => {
    if (!result) return [];
    return [
      {
        asset: `${result.source_id} (Source)`,
        pre: result.source_pre_pct,
        post: result.source_post_pct,
      },
      {
        asset: `${result.target_id} (Target)`,
        pre: result.target_pre_pct,
        post: result.target_post_pct,
      },
    ];
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
          Load Balancing & Scenario Simulator
          <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
            DECISION SUPPORT
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Interactive evaluation of electrical feeder tie transfers with capacity headroom and safety constraint verification
        </p>
      </div>

      {/* Simulator Inputs Studio */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Transfer Scenario Configuration
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Source Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Source Unit (Relief Seeking)
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
            >
              {transformers.map((t) => (
                <option key={t.spec.id} value={t.spec.id}>
                  {t.spec.id} ({t.telemetry.load_percentage.toFixed(0)}% load, {t.spec.zone})
                </option>
              ))}
            </select>
            {sourceTx && (
              <span className="text-[11px] text-slate-500 mt-1 block">
                Current: {sourceTx.telemetry.apparent_power_kva.toFixed(0)} / {sourceTx.spec.rated_capacity_kva} kVA
              </span>
            )}
          </div>

          {/* Target Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Unit (Spare Headroom)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
            >
              {transformers.map((t) => (
                <option key={t.spec.id} value={t.spec.id} disabled={t.spec.id === sourceId}>
                  {t.spec.id} ({t.telemetry.load_percentage.toFixed(0)}% load, {t.spec.zone})
                </option>
              ))}
            </select>
            {targetTx && (
              <span className="text-[11px] text-slate-500 mt-1 block">
                Available Spare: {(targetTx.spec.rated_capacity_kva - targetTx.telemetry.apparent_power_kva).toFixed(0)} kVA
              </span>
            )}
          </div>

          {/* Transfer Amount Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Transfer Amount
              </label>
              <span className="font-mono text-cyan-400 font-bold text-xs">{transferKva} kVA</span>
            </div>
            <input
              type="range"
              min={50}
              max={1500}
              step={25}
              value={transferKva}
              onChange={(e) => setTransferKva(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>50 kVA</span>
              <span>750 kVA</span>
              <span>1500 kVA</span>
            </div>
          </div>

          {/* Safety Margin Limit */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Safety Threshold
              </label>
              <span className="font-mono text-amber-400 font-bold text-xs">{safetyMargin}%</span>
            </div>
            <input
              type="range"
              min={65}
              max={95}
              step={5}
              value={safetyMargin}
              onChange={(e) => setSafetyMargin(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>65% (Conservative)</span>
              <span>95% (Aggressive)</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Decision Verdict Banner */}
      {result && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            result.verdict === 'APPROVED'
              ? 'bg-emerald-950/40 border-emerald-700/80'
              : result.verdict === 'WARNING'
              ? 'bg-amber-950/40 border-amber-700/80'
              : 'bg-rose-950/40 border-rose-700/80'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                result.verdict === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : result.verdict === 'WARNING'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {result.verdict === 'APPROVED' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : result.verdict === 'WARNING' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded tracking-wider ${
                    result.verdict === 'APPROVED'
                      ? 'bg-emerald-500/30 text-emerald-300'
                      : result.verdict === 'WARNING'
                      ? 'bg-amber-500/30 text-amber-300'
                      : 'bg-rose-500/30 text-rose-300'
                  }`}
                >
                  VERDICT: {result.verdict}
                </span>
                <span className="text-xs text-slate-400">
                  Transfer of <strong>{result.transfer_kva} kVA</strong> from {result.source_id} to {result.target_id}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-100">{result.explanation}</p>

              {result.safety_warnings.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                    Constraint Alerts:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-200/90">
                    {result.safety_warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comparison KPIs & Chart */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metrics comparison (1 col) */}
          <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Pre vs Post Loading Metrics
            </h3>

            {/* Source card */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200">{result.source_id} (Source)</span>
                <span className="text-cyan-400 font-mono">Relieved</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Load %:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-rose-400 line-through">{result.source_pre_pct.toFixed(1)}%</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                  <span className="text-emerald-400 font-bold">{result.source_post_pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Risk Score:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span>{result.pre_source_risk.toFixed(0)}</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                  <span className="text-emerald-400 font-bold">{result.post_source_risk.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Target card */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200">{result.target_id} (Target)</span>
                <span className="text-amber-400 font-mono">Absorbing</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Load %:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400">{result.target_pre_pct.toFixed(1)}%</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                  <span
                    className={`font-bold ${
                      result.target_post_pct > 100
                        ? 'text-rose-400'
                        : result.target_post_pct > safetyMargin
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {result.target_post_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Spare Headroom:</span>
                <span className="font-mono text-slate-200 font-bold">
                  {result.target_remaining_headroom_kva.toFixed(0)} kVA
                </span>
              </div>
            </div>
          </div>

          {/* Bar Chart Comparison (2 cols) */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 p-5 border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-1">
                <GitCompare className="w-4 h-4 text-cyan-400" />
                Scenario Loading Comparison
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Pre-transfer actual load % versus projected post-transfer load %
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <XAxis dataKey="asset" stroke="#475569" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} unit="%" domain={[0, 120]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="pre" fill="#475569" name="Pre-Transfer Load (%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="post" fill="#00f2fe" name="Post-Transfer Load (%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Network Topology & Feeder Path Visualization */}
      {result && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Interconnection Feeder Routing Path
              </h3>
              <p className="text-xs text-slate-400">
                Illustrative electrical distribution network switching topology
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              SYNTHETIC TOPOLOGY
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-center gap-3">
            {result.interconnection_path.map((node, i) => (
              <React.Fragment key={i}>
                <div
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                    i === 0
                      ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                      : i === result.interconnection_path.length - 1
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-cyan-300 font-mono'
                  }`}
                >
                  {node}
                </div>
                {i < result.interconnection_path.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-500 animate-pulse" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p>
              <strong>Constraint disclaimer:</strong> Decision support simulation only. Does NOT automatically dispatch switching commands. In real grid operation, load transfers require protection relay coordination, phase angle checks, and transient fault analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
