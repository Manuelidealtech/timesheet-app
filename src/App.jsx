import React from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Produzione from "./pages/Produzione";
import Storico from "./pages/Storico";
import RequireRole from "./auth/RequireRole";
import Interventi from "./pages/Interventi";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTimesheets from "./pages/admin/AdminTimesheets";
import AdminRiassunti from "./pages/admin/AdminRiassunti";
import AdminAnagrafiche from "./pages/admin/AdminAnagrafiche";

export default function App() {
  return (
    <Sidebar>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <RequireRole allow={["admin", "produzione"]}>
              <Home />
            </RequireRole>
          }
        />

        <Route
          path="/produzione"
          element={
            <RequireRole allow={["produzione"]}>
              <Produzione />
            </RequireRole>
          }
        />

        <Route
          path="/storico"
          element={
            <RequireRole allow={["produzione", "admin"]}>
              <Storico />
            </RequireRole>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireRole allow={["admin"]}>
              <AdminDashboard />
            </RequireRole>
          }
        />

        <Route
          path="/admin/timesheets"
          element={
            <RequireRole allow={["admin"]}>
              <AdminTimesheets />
            </RequireRole>
          }
        />

        <Route
          path="/admin/riassunti"
          element={
            <RequireRole allow={["admin"]}>
              <AdminRiassunti />
            </RequireRole>
          }
        />

        <Route
          path="/admin/anagrafiche"
          element={
            <RequireRole allow={["admin"]}>
              <AdminAnagrafiche />
            </RequireRole>
          }
        />
        <Route
          path="/interventi"
          element={
            <RequireRole allow={["produzione", "admin"]}>
              <Interventi />
            </RequireRole>
          }
        />
      </Routes>
    </Sidebar>
  );
}