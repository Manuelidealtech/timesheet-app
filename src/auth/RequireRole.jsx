import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { getRoleHomePath } from '../lib/access';

export default function RequireRole({ allow, children }) {
  const { sessionLoading, profileLoading, user, role, profile } = useAuth();

  if (sessionLoading || profileLoading) {
    return (
      <div className="container">
        <div className="card">Caricamento...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile || !role) {
    return <Navigate to="/login" replace />;
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