import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DEPARTMENT_LABELS, ROLE_LABELS } from '../lib/access';

function buildMenu(role) {
  const base = [{ to: '/', label: 'Home', exact: true }];

  if (role === 'produzione') {
    return [
      ...base,
      { to: '/produzione', label: 'Compila Timesheet' },
      { to: '/storico', label: 'Storico reparto' },
      { to: '/interventi', label: 'Fogli intervento' },
    ];
  }

  if (role === 'ufficio') {
    return [
      ...base,
      { to: '/ufficio', label: 'Compila Timesheet' },
      { to: '/storico', label: 'Il mio storico' },
      { to: '/interventi', label: 'Fogli intervento' },
    ];
  }

  if (role === 'admin') {
  return [
    ...base,
    { to: '/admin', label: 'Dashboard', exact: true },
    { to: '/admin/timesheets', label: 'Timesheet' },
    { to: '/admin/riassunti', label: 'Riassunti' },
    { to: '/admin/anagrafiche', label: 'Anagrafiche' },
    { to: '/admin/users', label: 'Utenti' },
    { to: '/storico', label: 'Storico' },
    { to: '/interventi', label: 'Fogli intervento' },
  ];
}

  return base;
}

const THEME_STORAGE_KEY = 'idealtech-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function Sidebar({ children }) {
  const { role, user, profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  const items = useMemo(() => buildMenu(role), [role]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  if (!user) return children;

  function isActive(item) {
    if (item.exact) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  }

  function closeMenu() {
    setMobileOpen(false);
  }

  function handleToggleTheme(nextTheme) {
    setTheme(nextTheme);
  }

  const roleLabel = ROLE_LABELS[role] || role || 'utente';
  const departmentLabel = DEPARTMENT_LABELS[profile?.department] || null;

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

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebarBrand">
          <div className="sidebarLogo">IT</div>
          <div>
            <div className="sidebarTitle">Timesheet</div>
            <div className="sidebarSub">Idealtech workspace</div>
          </div>
        </div>

        <div className="sidebarUserCard">
          <div className="sidebarUserLabel">Accesso attivo</div>
          <div className="sidebarUserName">{profile?.display_name || user.email}</div>
          <div className="sidebarUserRole">
            {roleLabel}
            {departmentLabel ? ` · ${departmentLabel}` : ''}
          </div>
        </div>

        <div className="sidebarThemeCard">
          <div className="sidebarThemeLabel">Aspetto</div>
          <div className="sidebarThemeRow">
            <button
              type="button"
              className={`themeToggleBtn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleToggleTheme('dark')}
              aria-pressed={theme === 'dark'}
            >
              <span className="themeIcon">🌙</span>
              Scuro
            </button>
            <button
              type="button"
              className={`themeToggleBtn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleToggleTheme('light')}
              aria-pressed={theme === 'light'}
            >
              <span className="themeIcon">☀️</span>
              Chiaro
            </button>
          </div>
        </div>

        <nav className="sidebarNav">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebarLink ${isActive(item) ? 'active' : ''}`}
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
