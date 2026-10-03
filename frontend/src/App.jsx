import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import BillingProfilePage from './pages/BillingProfilePage';
import CreateBillPage from './pages/CreateBillPage';
import InvoicesListPage from './pages/InvoicesListPage';
import ClientsPage from './pages/ClientsPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import { Box } from '@mui/material';

export default function App() {
  const location = useLocation();
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'transparent' }}>
      <Navbar />
      <Box key={location.pathname} className="fade-in" sx={{ flexGrow: 1 }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<InvoicesListPage />} />
            <Route path="/profile" element={<BillingProfilePage />} />
            <Route path="/create" element={<CreateBillPage />} />
            <Route path="/edit/:id" element={<CreateBillPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:email" element={<ClientDashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}
