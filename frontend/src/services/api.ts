import type {
  DashboardSummary,
  TransformerDetail,
  TelemetryReading,
  TransformerConditionReport,
  AnomalySummary,
  Alert,
  InspectionRecord,
  SimulationStatus,
} from '../types';

// =========================================================================
// FUTURE HARDWARE INTEGRATION:
// Configure VITE_API_BASE_URL to point to your physical IoT / SCADA Gateway
// or hardware API endpoint. The endpoints below consume Vrms, Arms,
// Winding Hotspot Temperature, and Moisture telemetry from connected sensors.
// Leave empty for local development with Vite dev proxy.
// =========================================================================
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; service: string; active_transformers: number }>('/api/health'),

  // Dashboard
  getDashboardSummary: () => request<DashboardSummary>('/api/dashboard/summary'),

  // Transformers Fleet & Telemetry
  getTransformers: (substation?: string, condition?: string) => {
    const params = new URLSearchParams();
    if (substation && substation !== 'ALL') params.append('substation', substation);
    if (condition && condition !== 'ALL') params.append('condition', condition);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<TransformerDetail[]>(`/api/transformers${qs}`);
  },

  getTransformer: (id: string) => request<TransformerDetail>(`/api/transformers/${id}`),

  getTransformerTelemetry: (id: string, limit: number = 60) =>
    request<TelemetryReading[]>(`/api/transformers/${id}/telemetry?limit=${limit}`),

  // Dedicated Condition Assessment Report
  getTransformerCondition: (id: string) =>
    request<TransformerConditionReport>(`/api/transformers/${id}/condition`),

  // Dedicated Anomaly Detection
  getTransformerAnomalies: (id: string) =>
    request<AnomalySummary>(`/api/transformers/${id}/anomalies`),

  // Alerts
  getAlerts: (params: { status?: string; severity?: string; transformer_id?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'ALL') q.append('status', params.status);
    if (params.severity && params.severity !== 'ALL') q.append('severity', params.severity);
    if (params.transformer_id && params.transformer_id !== 'ALL') q.append('transformer_id', params.transformer_id);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<Alert[]>(`/api/alerts${qs}`);
  },

  acknowledgeAlert: (id: string) =>
    request<Alert>(`/api/alerts/${id}/acknowledge`, { method: 'POST' }),

  resolveAlert: (id: string) =>
    request<Alert>(`/api/alerts/${id}/resolve`, { method: 'POST' }),

  // Inspections & Maintenance Workflows
  getInspections: (params: { transformer_id?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.transformer_id && params.transformer_id !== 'ALL') q.append('transformer_id', params.transformer_id);
    if (params.status && params.status !== 'ALL') q.append('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<InspectionRecord[]>(`/api/maintenance/inspections${qs}`);
  },

  createInspection: (payload: {
    transformer_id: string;
    reason: string;
    priority: string;
    recommended_action: string;
    assigned_technician?: string;
    notes?: string;
  }) =>
    request<InspectionRecord>('/api/maintenance/inspections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateInspection: (id: string, payload: Partial<InspectionRecord>) =>
    request<InspectionRecord>(`/api/maintenance/inspections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Simulation Controls & Demo Anomaly Injection
  getSimulationStatus: () => request<SimulationStatus>('/api/simulation/status'),

  pauseSimulation: () => request<{ is_paused: boolean }>('/api/simulation/pause', { method: 'POST' }),

  resumeSimulation: () => request<{ is_paused: boolean }>('/api/simulation/resume', { method: 'POST' }),

  setSimulationSpeed: (speedMultiplier: number) =>
    request<{ speed_multiplier: number }>('/api/simulation/speed', {
      method: 'POST',
      body: JSON.stringify({ speed_multiplier: speedMultiplier }),
    }),

  resetSimulation: () => request<{ status: string }>('/api/simulation/reset', { method: 'POST' }),

  injectAnomaly: (transformerId: string, anomalyType: string, severity: string = 'HIGH', durationSec: number = 120) =>
    request<{ status: string; message: string }>('/api/anomalies/inject', {
      method: 'POST',
      body: JSON.stringify({
        transformer_id: transformerId,
        anomaly_type: anomalyType,
        severity: severity,
        duration_sec: durationSec,
      }),
    }),

  clearAnomaly: (transformerId: string) =>
    request<{ status: string; message: string }>('/api/anomalies/clear', {
      method: 'POST',
      body: JSON.stringify({ transformer_id: transformerId }),
    }),
};
