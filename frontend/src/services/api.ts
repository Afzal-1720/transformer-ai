import type {
  DashboardSummary,
  TransformerDetail,
  TelemetryReading,
  Alert,
  ForecastResponse,
  AnomalyDetectionResponse,
  ExplainableRiskResponse,
  LoadTransferRequest,
  LoadTransferResponse,
  MaintenanceTask,
  AssetHealthRecord,
  SimulationStatus,
} from '../types';

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

  // Transformers
  getTransformers: (zone?: string, status?: string) => {
    const params = new URLSearchParams();
    if (zone && zone !== 'ALL') params.append('zone', zone);
    if (status && status !== 'ALL') params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<TransformerDetail[]>(`/api/transformers${qs}`);
  },

  getTransformer: (id: string) => request<TransformerDetail>(`/api/transformers/${id}`),

  getTransformerTelemetry: (id: string, limit: number = 60) =>
    request<TelemetryReading[]>(`/api/transformers/${id}/telemetry?limit=${limit}`),

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

  // Predictions & AI
  getForecast: (transformerId: string) =>
    request<ForecastResponse>(`/api/predictions/${transformerId}`),

  detectAnomalies: (transformerId: string) =>
    request<AnomalyDetectionResponse>('/api/anomalies/detect', {
      method: 'POST',
      body: JSON.stringify({ transformer_id: transformerId }),
    }),

  getExplainableRisk: (transformerId: string) =>
    request<ExplainableRiskResponse>(`/api/predictions/${transformerId}/risk`),

  // Load Balancing
  simulateLoadTransfer: (payload: LoadTransferRequest) =>
    request<LoadTransferResponse>('/api/load-balancing/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Maintenance
  getMaintenanceOverview: (transformerId?: string) => {
    const qs = transformerId && transformerId !== 'ALL' ? `?transformer_id=${transformerId}` : '';
    return request<{ asset_register: AssetHealthRecord[]; tasks: MaintenanceTask[] }>(`/api/maintenance${qs}`);
  },

  createMaintenanceTask: (payload: {
    transformer_id: string;
    title: string;
    description: string;
    priority: string;
    assigned_technician: string;
    scheduled_date: string;
    notes?: string;
  }) =>
    request<MaintenanceTask>('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMaintenanceTask: (taskId: string, payload: Partial<MaintenanceTask>) =>
    request<MaintenanceTask>(`/api/maintenance/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Simulation Controls
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
