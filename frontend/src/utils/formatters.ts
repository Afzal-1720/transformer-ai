export function formatPower(val: number): string {
  if (val >= 1000) {
    return `${(val / 1000).toFixed(2)} MW`;
  }
  return `${val.toLocaleString()} kW`;
}

export function formatApparentPower(val: number): string {
  if (val >= 1000) {
    return `${(val / 1000).toFixed(2)} MVA`;
  }
  return `${val.toLocaleString()} kVA`;
}

export function formatVoltage(v: number, isKv: boolean = false): string {
  if (isKv || v >= 1000) {
    return `${(v / 1000).toFixed(2)} kV`;
  }
  return `${v.toFixed(1)} V`;
}

export function formatTemp(tempC: number): string {
  return `${tempC.toFixed(1)}°C`;
}

export function formatPercentage(pct: number): string {
  return `${pct.toFixed(1)}%`;
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
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
