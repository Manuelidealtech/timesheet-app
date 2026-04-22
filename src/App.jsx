import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';

import Login from './pages/Login';
import Home from './pages/Home';
import Produzione from './pages/Produzione';
import Ufficio from './pages/Ufficio';
import Storico from './pages/Storico';
import RequireRole from './auth/RequireRole';
import Interventi from './pages/Interventi';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTimesheets from './pages/admin/AdminTimesheets';
import AdminRiassunti from './pages/admin/AdminRiassunti';
import AdminAnagrafiche from './pages/admin/AdminAnagrafiche';
import AdminUsers from './pages/admin/AdminUsers';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <RequireRole allow={['admin', 'produzione', 'ufficio']}>
            <Home />
          </RequireRole>
        }
      />

      <Route
        path="/produzione"
        element={
          <RequireRole allow={['produzione']}>
            <Produzione />
          </RequireRole>
        }
      />

      <Route
        path="/ufficio"
        element={
          <RequireRole allow={['ufficio']}>
            <Ufficio />
          </RequireRole>
        }
      />

      <Route
        path="/storico"
        element={
          <RequireRole allow={['produzione', 'ufficio', 'admin']}>
            <Storico />
          </RequireRole>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireRole allow={['admin']}>
            <AdminDashboard />
          </RequireRole>
        }
      />

      <Route
        path="/admin/timesheets"
        element={
          <RequireRole allow={['admin']}>
            <AdminTimesheets />
          </RequireRole>
        }
      />

      <Route
        path="/admin/riassunti"
        element={
          <RequireRole allow={['admin']}>
            <AdminRiassunti />
          </RequireRole>
        }
      />

      <Route
        path="/admin/anagrafiche"
        element={
          <RequireRole allow={['admin']}>
            <AdminAnagrafiche />
          </RequireRole>
        }
      />

      <Route
        path="/admin/users"
        element={
          <RequireRole allow={['admin']}>
            <AdminUsers />
          </RequireRole>
        }
      />

      <Route
        path="/interventi"
        element={
          <RequireRole allow={['produzione', 'ufficio', 'admin']}>
            <Interventi />
          </RequireRole>
        }
      />
    </Routes>
  );
}

export default function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return <AppRoutes />;
  }

  return (
    <Sidebar>
      <AppRoutes />
    </Sidebar>
  );
}