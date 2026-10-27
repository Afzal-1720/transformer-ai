import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { SimulationStatus, Alert } from '../types';

interface SimulationContextType {
  status: SimulationStatus | null;
  activeAlertsCount: number;
  recentAlerts: Alert[];
  lastTickTime: Date;
  isLoading: boolean;
  error: string | null;
  togglePause: () => Promise<void>;
  setSpeed: (multiplier: number) => Promise<void>;
  resetFleet: () => Promise<void>;
  injectAnomaly: (txId: string, type: string, severity?: string, durationSec?: number) => Promise<void>;
  clearAnomaly: (txId: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [lastTickTime, setLastTickTime] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatusAndAlerts = useCallback(async () => {
    try {
      const [simStatus, alerts] = await Promise.all([
        api.getSimulationStatus(),
        api.getAlerts({ status: 'ACTIVE' }),
      ]);
      setStatus(simStatus);
      setActiveAlertsCount(alerts.length);
      setRecentAlerts(alerts.slice(0, 5));
      setLastTickTime(new Date());
      setError(null);
    } catch (err: any) {
      console.warn('Backend sync error:', err.message);
      setError(err.message || 'Unable to connect to backend simulation service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polling loop (every 2.5 seconds)
  useEffect(() => {
    fetchStatusAndAlerts();
    const interval = setInterval(fetchStatusAndAlerts, 2500);
    return () => clearInterval(interval);
  }, [fetchStatusAndAlerts]);

  const togglePause = async () => {
    if (!status) return;
    try {
      if (status.is_paused) {
        await api.resumeSimulation();
      } else {
        await api.pauseSimulation();
      }
      await fetchStatusAndAlerts();
    } catch (err: any) {
      alert(`Error toggling simulation: ${err.message}`);
    }
  };

  const setSpeed = async (multiplier: number) => {
    try {
      await api.setSimulationSpeed(multiplier);
      await fetchStatusAndAlerts();
    } catch (err: any) {
      alert(`Error setting speed: ${err.message}`);
    }
  };

  const resetFleet = async () => {
    try {
      await api.resetSimulation();
      await fetchStatusAndAlerts();
    } catch (err: any) {
      alert(`Error resetting simulation: ${err.message}`);
    }
  };

  const injectAnomaly = async (txId: string, type: string, severity: string = 'HIGH', durationSec: number = 120) => {
    try {
      await api.injectAnomaly(txId, type, severity, durationSec);
      await fetchStatusAndAlerts();
    } catch (err: any) {
      alert(`Error injecting anomaly: ${err.message}`);
    }
  };

  const clearAnomaly = async (txId: string) => {
    try {
      await api.clearAnomaly(txId);
      await fetchStatusAndAlerts();
    } catch (err: any) {
      alert(`Error clearing anomaly: ${err.message}`);
    }
  };

  const refreshAlerts = async () => {
    await fetchStatusAndAlerts();
  };

  return (
    <SimulationContext.Provider
      value={{
        status,
        activeAlertsCount,
        recentAlerts,
        lastTickTime,
        isLoading,
        error,
        togglePause,
        setSpeed,
        resetFleet,
        injectAnomaly,
        clearAnomaly,
        refreshAlerts,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return ctx;
};
