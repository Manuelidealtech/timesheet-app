import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireRole({ allow, children }) {
  const { sessionLoading, user, role } = useAuth();

  if (sessionLoading) {
    return <div className="container"><div className="card">Caricamento...</div></div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  // se il role manca, mostra UI ma senza “buttare via tutto”
  if (!role) {
    return <div className="container"><div className="card">Sto caricando i permessi...</div></div>;
  }

  if (allow && !allow.includes(role)) return <Navigate to="/" replace />;

  return children;
}