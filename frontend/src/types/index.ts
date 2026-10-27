export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CommunicationStatus = 'ONLINE' | 'STALE' | 'OFFLINE';
export type AlertSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertCategory = 'OVERLOAD' | 'TEMPERATURE' | 'VOLTAGE' | 'ANOMALY' | 'DATA_QUALITY' | 'COMMUNICATION';
export type TaskPriority = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_ROUTINE';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ConditionCategory = 'GOOD' | 'FAIR' | 'DEGRADED' | 'CRITICAL';
export type ScenarioVerdict = 'APPROVED' | 'WARNING' | 'REJECTED';

export interface TransformerSpec {
  id: string;
  name: string;
  zone: string;
  rated_capacity_kva: number;
  primary_voltage_kv: number;
  secondary_voltage_kv: number;
  cooling_type: string;
  installation_year: number;
  latitude: number;
  longitude: number;
  connected_substations: string[];
}

export interface TelemetryReading {
  timestamp: string;
  transformer_id: string;
  voltage_v: number;
  voltage_kv: number;
  current_a: number;
  active_power_kw: number;
  apparent_power_kva: number;
  reactive_power_kvar: number;
  power_factor: number;
  frequency_hz: number;
  oil_temp_c: number;
  winding_temp_c: number;
  ambient_temp_c: number;
  load_percentage: number;
  communication_status: CommunicationStatus;
  is_simulated: boolean;
}

export interface TransformerDetail {
  spec: TransformerSpec;
  telemetry: TelemetryReading;
  health_score: number;
  health_status: HealthStatus;
  risk_level: RiskLevel;
  risk_score: number;
  active_alerts_count: number;
  is_simulated: boolean;
}

export interface Alert {
  id: string;
  transformer_id: string;
  zone: string;
  severity: AlertSeverity;
  category: AlertCategory;
  triggering_metric: string;
  triggering_value: number;
  threshold_value: number;
  unit: string;
  message: string;
  recommended_action: string;
  status: AlertStatus;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  is_simulated: boolean;
}

export interface ForecastDataPoint {
  timestamp: string;
  predicted_load_kw: number;
  lower_bound_kw: number;
  upper_bound_kw: number;
  baseline_persistence_kw: number;
}

export interface ForecastMetrics {
  mae_kw: number;
  rmse_kw: number;
  mape_pct: number;
  baseline_mae_kw: number;
  holdout_samples: number;
}

export interface ForecastResponse {
  transformer_id: string;
  generated_at: string;
  metrics: ForecastMetrics;
  historical_points: Array<{
    timestamp: string;
    active_power_kw: number;
    load_percentage: number;
  }>;
  predictions_1h: ForecastDataPoint[];
  predictions_6h: ForecastDataPoint[];
  predictions_24h: ForecastDataPoint[];
  model_name: string;
  is_simulated: boolean;
}

export interface AnomalyContribution {
  feature: string;
  observed_value: number;
  expected_range: string;
  attribution_score: number;
  impact_description: string;
}

export interface AnomalyDetectionResponse {
  transformer_id: string;
  timestamp: string;
  is_anomaly: boolean;
  anomaly_score: number;
  severity: AlertSeverity;
  contributing_features: AnomalyContribution[];
  heuristic_observation: string;
  recommended_checks: string[];
  is_simulated: boolean;
}

export interface RiskFactorBreakdown {
  factor_name: string;
  weight_pct: number;
  raw_metric: string;
  sub_score: number;
  weighted_points: number;
  status: string;
  explanation: string;
}

export interface ExplainableRiskResponse {
  transformer_id: string;
  timestamp: string;
  overall_risk_score: number;
  risk_level: RiskLevel;
  breakdown: RiskFactorBreakdown[];
  primary_risk_driver: string;
  actionable_recommendations: string[];
  disclaimer: string;
  is_simulated: boolean;
}

export interface LoadTransferRequest {
  source_id: string;
  target_id: string;
  transfer_kva: number;
  safety_margin_pct?: number;
}

export interface LoadTransferResponse {
  feasible: boolean;
  verdict: ScenarioVerdict;
  source_id: string;
  target_id: string;
  transfer_kva: number;
  source_name: string;
  target_name: string;
  source_pre_load_kva: number;
  source_post_load_kva: number;
  source_pre_pct: number;
  source_post_pct: number;
  target_pre_load_kva: number;
  target_post_load_kva: number;
  target_pre_pct: number;
  target_post_pct: number;
  target_rated_kva: number;
  target_remaining_headroom_kva: number;
  pre_source_risk: number;
  post_source_risk: number;
  pre_target_risk: number;
  post_target_risk: number;
  explanation: string;
  safety_warnings: string[];
  interconnection_path: string[];
  is_simulated: boolean;
}

export interface MaintenanceTask {
  id: string;
  transformer_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_technician: string;
  scheduled_date: string;
  completed_date?: string;
  notes?: string;
  created_at: string;
  is_simulated: boolean;
}

export interface AssetHealthRecord {
  transformer_id: string;
  transformer_name: string;
  zone: string;
  rated_capacity_kva: number;
  health_score: number;
  condition_category: ConditionCategory;
  maintenance_priority: TaskPriority;
  last_inspection_date: string;
  next_inspection_date: string;
  open_tasks_count: number;
  health_score_breakdown: Record<string, number>;
  is_simulated: boolean;
}

export interface DashboardSummary {
  kpis: {
    total_transformers: number;
    healthy_count: number;
    warning_count: number;
    critical_count: number;
    avg_load_percentage: number;
    active_alerts_count: number;
  };
  health_distribution: {
    healthy: number;
    warning: number;
    critical: number;
  };
  zone_distribution: Array<{
    zone: string;
    transformer_count: number;
    total_rated_kva: number;
    total_apparent_kva: number;
    total_active_kw: number;
    avg_load_percentage: number;
  }>;
  insights: {
    highest_loaded_transformer: {
      id: string;
      name: string;
      zone: string;
      load_percentage: number;
      apparent_power_kva: number;
      rated_capacity_kva: number;
      temperature_c: number;
    } | null;
    greatest_load_zone: {
      zone: string;
      avg_load_pct: number;
      total_rated_kva: number;
      total_apparent_kva: number;
    } | null;
    most_urgent_maintenance: {
      id: string;
      transformer_id: string;
      title: string;
      priority: string;
      status: string;
      scheduled_date: string;
    } | null;
  };
  network_load_trend: Array<{
    timestamp: string;
    total_kw: number;
    avg_temp_c: number;
    avg_load_pct: number;
  }>;
  recent_alerts: Alert[];
  is_simulated: boolean;
}

export interface SimulationStatus {
  is_paused: boolean;
  speed_multiplier: number;
  active_anomalies: Record<string, {
    type: string;
    severity: string;
    duration_sec: number;
    started_at: number;
  }>;
  is_simulated: boolean;
}
