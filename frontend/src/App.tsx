import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SimulationProvider } from './context/SimulationContext';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { AIIntelligencePage } from './pages/AIIntelligencePage';
import { LoadBalancingPage } from './pages/LoadBalancingPage';
import { MaintenancePage } from './pages/MaintenancePage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <SimulationProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/monitoring" element={<LiveMonitoringPage />} />
              <Route path="/intelligence" element={<AIIntelligencePage />} />
              <Route path="/load-balancing" element={<LoadBalancingPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </SimulationProvider>
    </ThemeProvider>
  );
};

export default App;
