export function formatVoltage(v: number): string {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return `${v.toFixed(1)} Vrms`;
}

export function formatCurrent(i: number): string {
  if (i === undefined || i === null || isNaN(i)) return '—';
  return `${i.toFixed(1)} Arms`;
}

export function formatTemp(tempC: number): string {
  if (tempC === undefined || tempC === null || isNaN(tempC)) return '—';
  return `${tempC.toFixed(1)}°C`;
}

export function formatMoisture(m: number): string {
  if (m === undefined || m === null || isNaN(m)) return '—';
  return `${m.toFixed(1)} % RH`;
}

export function formatPercentage(pct: number, includeSign: boolean = false): string {
  if (pct === undefined || pct === null || isNaN(pct)) return '—';
  const prefix = includeSign && pct > 0 ? '+' : '';
  return `${prefix}${pct.toFixed(1)}%`;
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
