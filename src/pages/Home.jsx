import React from "react";
import { useAuth } from "../auth/AuthProvider";
import { Link } from "react-router-dom";

export default function Home() {
  const { role, signOut, profile } = useAuth();

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h1 className="h1">Timesheet</h1>
            <p className="sub">
              Ruolo: <b>{role}</b>{profile?.display_name ? ` — ${profile.display_name}` : ""}
            </p>
          </div>
        </div>

        <hr className="sep" />

        <div className="row">
          {role === "produzione" && <Link className="btn btnPrimary" to="/produzione">Compila Timesheet</Link>}
          {role === "produzione" && <Link className="btn" to="/storico">Storico</Link>}

          {role === "admin" && <Link className="btn btnPrimary" to="/admin">Dashboard</Link>}
          {role === "admin" && <Link className="btn" to="/admin/timesheets">Tutti i Timesheet</Link>}
          {role === "admin" && <Link className="btn" to="/admin/riassunti">Riassunti</Link>}
        </div>
      </div>
    </div>
  );
}