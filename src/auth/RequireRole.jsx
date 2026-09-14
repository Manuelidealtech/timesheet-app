import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { getRoleHomePath } from '../lib/access';

export default function RequireRole({ allow, children }) {
  const { sessionLoading, profileLoading, user, role, profile } = useAuth();
  const location = useLocation();

  if (sessionLoading || (profileLoading && !profile)) {
    return (
      <div className="container">
        <div className="card">Caricamento...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile || !role) {
    // L'utente è autenticato: un profilo momentaneamente non disponibile non
    // deve farlo rimbalzare al login durante un refresh o su una rete lenta.
    return (
      <div className="container">
        <div className="card">Caricamento profilo in corso…</div>
      </div>
    );
  }

  if (profile?.is_active === false) {
    return (
      <div className="container">
        <div className="card">
          Questo account è stato disattivato. Contatta l'amministratore.
        </div>
      </div>
    );
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to={getRoleHomePath(role)} replace />;
  }

  return children;
}