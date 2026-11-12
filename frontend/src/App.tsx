import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SimulationProvider } from './context/SimulationContext';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { AnomalyConditionPage } from './pages/AnomalyConditionPage';
import { InspectionPage } from './pages/InspectionPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <SimulationProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/monitoring" element={<LiveMonitoringPage />} />
              <Route path="/anomalies" element={<AnomalyConditionPage />} />
              <Route path="/maintenance" element={<InspectionPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </SimulationProvider>
    </ThemeProvider>
  );
};

export default App;