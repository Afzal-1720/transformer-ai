import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Brain,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Download,
  Info,
  ChevronRight,
  BarChart3,
  Activity,
} from 'lucide-react';
import { api } from '../services/api';
import { RiskBadge } from '../components/common/RiskBadge';
import { exportToCsv } from '../utils/exportCsv';
import { formatDateTime } from '../utils/formatters';
import type {
  ForecastResponse,
  AnomalyDetectionResponse,
  ExplainableRiskResponse,
  TransformerDetail,
} from '../types';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const AIIntelligencePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const txParam = searchParams.get('tx') || 'TX-101';

  const [transformers, setTransformers] = useState<TransformerDetail[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>(txParam);
  const [horizon, setHorizon] = useState<'1h' | '6h' | '24h'>('24h');

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyDetectionResponse | null>(null);
  const [risk, setRisk] = useState<ExplainableRiskResponse | null>(null);
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

  const loadAIData = useCallback(async () => {
    setLoading(true);
    try {
      const [fleet, fc, anom, rsk] = await Promise.all([
        api.getTransformers(),
        api.getForecast(selectedTxId),
        api.detectAnomalies(selectedTxId),
        api.getExplainableRisk(selectedTxId),
      ]);
      setTransformers(fleet);
      setForecast(fc);
      setAnomaly(anom);
      setRisk(rsk);
    } catch (err) {
      console.error('Error fetching AI analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTxId]);

  useEffect(() => {
    loadAIData();
  }, [loadAIData]);

  // Combined chart dataset
  const forecastChartData = useMemo(() => {
    if (!forecast) return [];

    const data: any[] = [];

    // Add historical observed points
    forecast.historical_points.forEach((p) => {
      data.push({
        time: formatDateTime(p.timestamp),
        observed: p.active_power_kw,
        predicted: null,
        lower: null,
        upper: null,
        baseline: null,
      });
    });

    // Select predictions based on horizon
    const predPoints =
      horizon === '1h'
        ? forecast.predictions_1h
        : horizon === '6h'
        ? forecast.predictions_6h
        : forecast.predictions_24h;

    // Connect last observed to first predicted
    if (data.length > 0 && predPoints.length > 0) {
      const last = data[data.length - 1];
      last.predicted = last.observed;
      last.lower = last.observed;
      last.upper = last.observed;
      last.baseline = last.observed;
    }

    predPoints.forEach((p) => {
      data.push({
        time: formatDateTime(p.timestamp),
        observed: null,
        predicted: p.predicted_load_kw,
        lower: p.lower_bound_kw,
        upper: p.upper_bound_kw,
        baseline: p.baseline_persistence_kw,
      });
    });

    return data;
  }, [forecast, horizon]);

  const handleExportAIReport = () => {
    if (!forecast || !anomaly || !risk) return;

    const rows = (
      horizon === '1h'
        ? forecast.predictions_1h
        : horizon === '6h'
        ? forecast.predictions_6h
        : forecast.predictions_24h
    ).map((p) => ({
      Timestamp: p.timestamp,
      TransformerID: forecast.transformer_id,
      PredictedLoadKw: p.predicted_load_kw,
      LowerBoundKw: p.lower_bound_kw,
      UpperBoundKw: p.upper_bound_kw,
      BaselinePersistenceKw: p.baseline_persistence_kw,
      ModelMAE: forecast.metrics.mae_kw,
      ModelRMSE: forecast.metrics.rmse_kw,
      AnomalyScore: anomaly.anomaly_score,
      IsAnomaly: anomaly.is_anomaly,
      OverallRiskScore: risk.overall_risk_score,
      RiskLevel: risk.risk_level,
    }));

    exportToCsv(`${selectedTxId}_ai_intelligence_report`, rows);
  };

  if (loading && !forecast) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400 font-mono text-sm">
        <Activity className="w-5 h-5 text-cyan-400 mr-2 animate-spin" />
        TRAINING FORECAST MODEL & COMPUTING ANOMALY CLUSTERS...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Selector & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-cyan-400" />
            Analyzed Asset:
          </label>
          <select
            value={selectedTxId}
            onChange={(e) => handleSelectTransformer(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-semibold text-cyan-300 focus:outline-hidden focus:border-cyan-500"
          >
            {transformers.map((t) => (
              <option key={t.spec.id} value={t.spec.id}>
                {t.spec.id} — {t.spec.name} ({t.spec.rated_capacity_kva} kVA)
              </option>
            ))}
          </select>

          {risk && <RiskBadge level={risk.risk_level} score={risk.overall_risk_score} />}
        </div>

        <button
          onClick={handleExportAIReport}
          className="self-start md:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export AI Forecast Report</span>
        </button>
      </div>

      {/* SECTION 1: LOAD FORECASTING (scikit-learn) */}
      <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Machine Learning Load Forecast ({selectedTxId})
            </h3>
            <p className="text-xs text-slate-400">
              Autoregressive Ridge regression trained on diurnal history with dynamic confidence envelopes
            </p>
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setHorizon('1h')}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                horizon === '1h'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1-Hour (15m)
            </button>
            <button
              onClick={() => setHorizon('6h')}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                horizon === '6h'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6-Hours (30m)
            </button>
            <button
              onClick={() => setHorizon('24h')}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                horizon === '24h'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24-Hours (1h)
            </button>
          </div>
        </div>

        {/* Holdout Evaluation Metrics Bar */}
        {forecast && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Model MAE</span>
              <span className="font-mono text-base font-bold text-cyan-400 mt-1 block">
                {forecast.metrics.mae_kw} kW
              </span>
              <span className="text-[10px] text-slate-500">Chronological Holdout</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Model RMSE</span>
              <span className="font-mono text-base font-bold text-cyan-400 mt-1 block">
                {forecast.metrics.rmse_kw} kW
              </span>
              <span className="text-[10px] text-slate-500">Root Mean Square</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">MAPE Error</span>
              <span className="font-mono text-base font-bold text-emerald-400 mt-1 block">
                {forecast.metrics.mape_pct}%
              </span>
              <span className="text-[10px] text-slate-500">Mean Abs Percentage</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Baseline Comparison</span>
              <span className="font-mono text-base font-bold text-slate-300 mt-1 block">
                {forecast.metrics.baseline_mae_kw} kW
              </span>
              <span className="text-[10px] text-emerald-400">
                Model beats baseline by {(forecast.metrics.baseline_mae_kw - forecast.metrics.mae_kw).toFixed(1)} kW
              </span>
            </div>
          </div>
        )}

        {/* Forecast Interactive Chart */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastChartData}>
              <defs>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} unit=" kW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {/* Historical Observed */}
              <Line
                type="monotone"
                dataKey="observed"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Historical Observed Load (kW)"
              />
              {/* Predicted Line */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#00f2fe"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                name={`ML Forecast (${horizon} Horizon)`}
              />
              {/* Persistence Baseline */}
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="Persistence Baseline Model (kW)"
              />
              {/* Upper & Lower Confidence Envelopes */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="#38bdf8"
                strokeWidth={1}
                strokeDasharray="2 2"
                fill="url(#bandGrad)"
                name="95% Confidence Upper Bound (kW)"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="#38bdf8"
                strokeWidth={1}
                strokeDasharray="2 2"
                fill="none"
                name="95% Confidence Lower Bound (kW)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 2 & 3: ISOLATION FOREST & EXPLAINABLE RISK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unsupervised Isolation Forest Anomaly Detection */}
        <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Isolation Forest Anomaly Detection
              </h3>
              <p className="text-xs text-slate-400">
                Unsupervised multi-parameter pattern clustering and feature attribution
              </p>
            </div>
            {anomaly && (
              <span
                className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  anomaly.is_anomaly
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                }`}
              >
                {anomaly.is_anomaly ? 'ANOMALY DETECTED' : 'NORMAL CLUSTER'}
              </span>
            )}
          </div>

          {anomaly && (
            <div className="space-y-3 text-xs">
              {/* Anomaly Score Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
                    Isolation Forest Decision Score
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100">
                    {anomaly.anomaly_score.toFixed(1)} / 100
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
                    Severity Rating
                  </span>
                  <span className="font-bold text-amber-400 font-mono text-sm">
                    {anomaly.severity}
                  </span>
                </div>
              </div>

              {/* Observation Rationale */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-semibold text-cyan-400">Statistical Analysis: </span>
                <span className="text-slate-300">{anomaly.heuristic_observation}</span>
              </div>

              {/* Contributing Features Breakdown */}
              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  Primary Contributing Features to Anomaly Score:
                </h4>
                <div className="space-y-2">
                  {anomaly.contributing_features.map((feat) => {
                    const pct = Math.round(feat.attribution_score * 100);
                    return (
                      <div
                        key={feat.feature}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-slate-200">{feat.feature}</span>
                          <span className="font-mono text-cyan-400 font-bold">{pct}% impact</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-cyan-400 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Observed: {feat.observed_value.toFixed(1)}</span>
                          <span>Expected: {feat.expected_range}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Checks */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Automated Inspection Recommendations:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                  {anomaly.recommended_checks.map((chk, i) => (
                    <li key={i}>{chk}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Explainable Fault-Risk Assessment */}
        <div className="rounded-2xl bg-slate-900/80 p-5 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Explainable Fault-Risk Assessment
                </h3>
                <p className="text-xs text-slate-400">
                  Transparent multi-factor decomposition with physics & telemetry weights
                </p>
              </div>
              {risk && <RiskBadge level={risk.risk_level} score={risk.overall_risk_score} />}
            </div>

            {risk && (
              <div className="space-y-3 text-xs">
                {/* Primary Risk Driver */}
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/50">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
                    Primary Operational Risk Driver
                  </span>
                  <span className="text-sm font-bold text-slate-100 mt-0.5 block">
                    {risk.primary_risk_driver}
                  </span>
                </div>

                {/* Sub-factor Breakdown Table */}
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Risk Factor</th>
                        <th className="py-2 px-3">Weight</th>
                        <th className="py-2 px-3">Condition / Reading</th>
                        <th className="py-2 px-3 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {risk.breakdown.map((b) => (
                        <tr key={b.factor_name}>
                          <td className="py-2 px-3 font-medium text-slate-200">
                            {b.factor_name}
                            <span className="block text-[10px] text-slate-500 font-normal">
                              {b.explanation}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">{b.weight_pct}%</td>
                          <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">
                            {b.raw_metric}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-cyan-400">
                            +{b.weighted_points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actionable Next Steps */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Decision Support Action Items:
                  </span>
                  <ul className="space-y-1 text-slate-300 text-[11px]">
                    {risk.actionable_recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Academic Model Disclaimer */}
          <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              <strong>Academic prototype disclaimer:</strong> Heuristic and statistical scoring only. Distinguishes operational loading and thermal anomalies from physical internal transformer winding or dielectric breakdown. Not certified for high-voltage switching execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
