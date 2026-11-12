export type SensorStatus = 'ONLINE' | 'STALE' | 'OFFLINE' | 'CONNECTION_LOST';
export type OverallCondition = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'INSPECTION_REQUIRED';
export type AnomalySeverity = 'Critical' | 'Warning' | 'Informational';
export type AnomalyType =
  | 'OVER_VOLTAGE'
  | 'UNDER_VOLTAGE'
  | 'OVER_CURRENT'
  | 'OVERHEATING'
  | 'SUDDEN_LOAD_VARIATION'
  | 'PHASE_IMBALANCE'
  | 'SENSOR_CONNECTIVITY';

export type InspectionPriority = 'Critical' | 'High' | 'Medium' | 'Routine';
export type InspectionStatus = 'Pending' | 'Acknowledged' | 'Completed';

export interface TransformerSpec {
  id: string;
  name: string;
  substation: string;
  rated_vrms: number;
  rated_irms: number;
  rated_kva: number;
  cooling_type: string;
  installation_year: number;
}

// =========================================================================
// FUTURE HARDWARE INTEGRATION:
// Telemetry structure matches the incoming hardware payload from connected
// smart transformer sensors or IoT edge gateway.
// =========================================================================
export interface TelemetryReading {
  transformer_id: string;
  timestamp: string;
  vrms: number;
  irms: number;
  winding_hotspot_temperature: number;
  moisture: number;
  sensor_status: SensorStatus;
  is_mock_data: boolean;
}

export interface TransformerDetail {
  spec: TransformerSpec;
  telemetry: TelemetryReading;
  voltage_deviation_pct: number;
  voltage_deviation_status: string;
  supply_voltage_status: string;
  current_deviation_pct: number;
  current_condition: string;
  loading_pct: number;
  loading_condition: string;
  thermal_condition: string;
  voltage_behaviour: string;
  overall_condition: OverallCondition;
  condition_explanation: string;
  recommended_action: string;
  inspection_required: boolean;
  active_anomalies_count: number;
  is_mock_data: boolean;
}

export interface DetectedAnomaly {
  id: string;
  transformer_id: string;
  anomaly_name: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  detected_parameter: string;
  measured_value: string;
  applicable_threshold: string;
  percentage_change?: number;
  detection_time: string;
  recommended_action: string;
  is_mock_data: boolean;
}

export interface AnomalySummary {
  transformer_id: string;
  timestamp: string;
  overall_condition: string;
  anomalies: DetectedAnomaly[];
  total_anomalies: number;
  has_critical: boolean;
  has_warning: boolean;
  phase_imbalance_status: string;
  is_mock_data: boolean;
}

export interface TransformerConditionReport {
  transformer_id: string;
  timestamp: string;
  sensor_connectivity: string;
  voltage_behaviour: string;
  loading_condition: string;
  thermal_condition: string;
  overall_condition: OverallCondition;
  condition_explanation: string;
  recommended_action: string;
  inspection_required: boolean;
  vrms_measured: number;
  vrms_rated: number;
  voltage_deviation_pct: number;
  irms_measured: number;
  irms_rated: number;
  current_deviation_pct: number;
  loading_pct: number;
  winding_hotspot_temperature: number;
  moisture: number;
  voltage_permissible_deviation: string;
  statutory_supply_range: string;
  configured_current_limit: string;
  configured_loading_thresholds: string;
  configured_thermal_thresholds: string;
  is_mock_data: boolean;
}

export interface InspectionRecord {
  id: string;
  transformer_id: string;
  transformer_name: string;
  reason: string;
  priority: InspectionPriority;
  status: InspectionStatus;
  detected_at: string;
  recommended_action: string;
  acknowledged_at?: string;
  completed_at?: string;
  assigned_technician: string;
  notes?: string;
  is_mock_data: boolean;
}

export interface Alert {
  id: string;
  transformer_id: string;
  substation: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  category: string;
  triggering_metric: string;
  triggering_value: number;
  threshold_value: number;
  unit: string;
  message: string;
  recommended_action: string;
  inspection_recommended: boolean;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  is_mock_data: boolean;
}

export interface DashboardSummary {
  kpis: {
    total_transformers: number;
    online_transformers: number;
    offline_transformers: number;
    transformers_requiring_inspection: number;
    active_critical_alerts: number;
    total_active_alerts: number;
    pending_inspections: number;
    avg_load_percentage: number;
  };
  fleet_condition: {
    status: string;
    description: string;
    healthy: number;
    warning: number;
    critical: number;
    inspection_required: number;
  };
  transformer_summaries: Array<{
    id: string;
    name: string;
    substation: string;
    vrms: number;
    irms: number;
    voltage_dev_pct: number;
    voltage_status: string;
    supply_status: string;
    current_dev_pct: number;
    loading_pct: number;
    loading_condition: string;
    winding_hotspot_temperature: number;
    moisture: number;
    thermal_condition: string;
    sensor_status: string;
    overall_condition: OverallCondition;
    inspection_required: boolean;
    condition_explanation: string;
    recommended_action: string;
  }>;
  recent_alerts: Alert[];
  telemetry_trend: Array<{
    timestamp: string;
    avg_vrms: number;
    avg_irms: number;
    hotspot_temp_c: number;
    moisture_pct: number;
  }>;
  is_mock_data: boolean;
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
  is_mock_data: boolean;
}
