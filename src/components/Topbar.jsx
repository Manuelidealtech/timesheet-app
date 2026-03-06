import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function Topbar() {
  const { role, user, signOut } = useAuth();
  const loc = useLocation();

  if (!user) return null;

  return (
    <div className="topbar">
      <div className="topbarInner">
        <div className="brand">
          <div className="brandDot" />
          <div>
            <div className="brandTitle">Timesheet</div>
            <div className="brandSub">Idealtech</div>
          </div>
        </div>

        <div className="nav">
          <Link className={`navLink ${loc.pathname === "/" ? "active" : ""}`} to="/">Home</Link>

          {role === "produzione" && (
            <>
              <Link className={`navLink ${loc.pathname.startsWith("/produzione") ? "active" : ""}`} to="/produzione">Produzione</Link>
              <Link className={`navLink ${loc.pathname.startsWith("/storico") ? "active" : ""}`} to="/storico">Storico</Link>
            </>
          )}

          {role === "admin" && (
            <>
              <Link className={`navLink ${loc.pathname.startsWith("/admin") ? "active" : ""}`} to="/admin">Admin</Link>
              <Link className={`navLink ${loc.pathname.startsWith("/admin/anagrafiche") ? "active" : ""}`} to="/admin/anagrafiche">Anagrafiche</Link>
            </>
          )}
        </div>

        <div className="topbarRight">
          <span className="pill">{role}</span>
          <button className="btn btnDanger" onClick={signOut}>Esci</button>
        </div>
      </div>
    </div>
  );
}