import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function buildMenu(role) {
  const base = [{ to: "/", label: "Home", exact: true }];

  if (role === "produzione") {
    return [
      ...base,
      { to: "/produzione", label: "Compila Timesheet" },
      { to: "/storico", label: "Storico" },
      { to: "/interventi", label: "Fogli intervento" },
    ];
  }

  if (role === "admin") {
    return [
      ...base,
      { to: "/admin", label: "Dashboard" },
      { to: "/admin/timesheets", label: "Timesheet" },
      { to: "/admin/riassunti", label: "Riassunti" },
      { to: "/admin/anagrafiche", label: "Anagrafiche" },
      { to: "/storico", label: "Storico" },
      { to: "/interventi", label: "Fogli intervento" },
    ];
  }

  return base;
}

export default function Sidebar({ children }) {
  const { role, user, profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo(() => buildMenu(role), [role]);

  if (!user) return children;

  function isActive(item) {
    if (item.exact) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  }

  function closeMenu() {
    setMobileOpen(false);
  }

  return (
    <div className="appShell">
      <button
        type="button"
        className="sidebarToggle"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label="Apri menu"
      >
        ☰
      </button>

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebarBrand">
          <div className="brandDot" />
          <div>
            <div className="sidebarTitle">Timesheet</div>
            <div className="sidebarSub">Idealtech</div>
          </div>
        </div>

        <div className="sidebarUserCard">
          <div className="sidebarUserLabel">Accesso attivo</div>
          <div className="sidebarUserName">{profile?.display_name || user.email}</div>
          <div className="sidebarUserRole">{role || "utente"}</div>
        </div>

        <nav className="sidebarNav">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebarLink ${isActive(item) ? "active" : ""}`}
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebarFooter">
          <button className="btn btnDanger sidebarLogout" onClick={signOut}>
            Esci
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebarBackdrop" onClick={closeMenu} aria-label="Chiudi menu" />}

      <main className="appMain" onClick={closeMenu}>{children}</main>
    </div>
  );
}
