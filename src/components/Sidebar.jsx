import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DEPARTMENT_LABELS, ROLE_LABELS } from '../lib/access';

const ICONS = {
  home: 'M3 10.75 12 3l9 7.75V21a1 1 0 0 1-1 1h-5.5v-6.5h-5V22H4a1 1 0 0 1-1-1V10.75Z',
  timesheet: 'M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Zm2 5h6M9 12h6M9 16h4',
  note: 'M5 3h10l4 4v14H5V3Zm9 0v5h5M8 12h8M8 16h6',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0 0V3m0 5h5M12 7v5l3 2',
  intervention: 'M14 4 4 14v6h6L20 10l-6-6Zm-7.5 11.5 2 2M13 5l6 6',
  dashboard: 'M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z',
  summary: 'M4 20V10m5 10V4m6 16v-7m5 7V7',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  folders: 'M3 6h6l2 2h10v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 5h18',
  users: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m7.5-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11.5 1v6m3-3h-6',
};

function NavIcon({ name }) {
  const path = ICONS[name] || ICONS.home;
  return (
    <span className="sidebarLinkIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function buildMenu(role) {
  const base = [{ to: '/', label: 'Home', icon: 'home', exact: true }];

  if (role === 'produzione') {
    return [
      ...base,
      { to: '/produzione', label: 'Compila Timesheet', icon: 'timesheet' },
      { to: '/note', label: 'Note', icon: 'note' },
      { to: '/storico', label: 'Storico reparto', icon: 'history' },
      { to: '/interventi', label: 'Fogli intervento', icon: 'intervention' },
    ];
  }

  if (role === 'ufficio') {
    return [
      ...base,
      { to: '/ufficio', label: 'Compila Timesheet', icon: 'timesheet' },
      { to: '/note', label: 'Note', icon: 'note' },
      { to: '/storico', label: 'Il mio storico', icon: 'history' },
      { to: '/interventi', label: 'Fogli intervento', icon: 'intervention' },
    ];
  }

  if (role === 'admin') {
    return [
      ...base,
      { to: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true },
      { to: '/admin/timesheets', label: 'Timesheet', icon: 'timesheet' },
      { to: '/admin/riassunti', label: 'Riassunti', icon: 'summary' },
      { to: '/admin/anagrafiche', label: 'Anagrafiche', icon: 'people' },
      { to: '/admin/commesse', label: 'Gestione commesse', icon: 'folders' },
      { to: '/admin/users', label: 'Utenti', icon: 'users' },
      { to: '/storico', label: 'Storico', icon: 'history' },
      { to: '/interventi', label: 'Fogli intervento', icon: 'intervention' },
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

  const roleLabel = ROLE_LABELS[role] || role || 'utente';
  const departmentLabel = DEPARTMENT_LABELS[profile?.department] || null;
  const displayName = profile?.display_name || user.email;

  return (
    <div className={`appShell role-${role || 'guest'}`}>
      <div className="mobileAppBar">
        <button
          type="button"
          className="sidebarToggle"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Apri menu"
          aria-expanded={mobileOpen}
        >
          <MenuIcon />
        </button>
        <div className="mobileBrand">
          <img src="/icon-192.png" alt="" />
          <div>
            <strong>Timesheet</strong>
            <span>Idealtech</span>
          </div>
        </div>
      </div>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebarBrand">
          <div className="sidebarLogo">
            <img src="/icon-192.png" alt="Timesheet" />
          </div>
          <div className="sidebarBrandCopy">
            <div className="sidebarTitle">Timesheet</div>
            <div className="sidebarSub">Idealtech workspace</div>
          </div>
        </div>

        <nav className="sidebarNav" aria-label="Navigazione principale">
          <div className="sidebarNavLabel">Menu</div>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebarLink ${isActive(item) ? 'active' : ''}`}
              aria-current={isActive(item) ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <NavIcon name={item.icon} />
              <span className="sidebarLinkText">{item.label}</span>
              <span className="sidebarActiveDot" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="sidebarFooterStack">
          <div className="sidebarThemeCard">
            <div className="sidebarThemeLabel">Aspetto</div>
            <div className="sidebarThemeRow" role="group" aria-label="Tema applicazione">
              <button
                type="button"
                className={`themeToggleBtn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                <span className="themeIcon">☾</span>
                Scuro
              </button>
              <button
                type="button"
                className={`themeToggleBtn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                <span className="themeIcon">☀</span>
                Chiaro
              </button>
            </div>
          </div>

          <div className="sidebarUserCard">
            <div className="sidebarAvatar">{String(displayName || 'U').trim().charAt(0).toUpperCase()}</div>
            <div className="sidebarUserInfo">
              <div className="sidebarUserName">{displayName}</div>
              <div className="sidebarUserRole">
                {roleLabel}{departmentLabel ? ` · ${departmentLabel}` : ''}
              </div>
            </div>
          </div>

          <button className="btn btnDanger sidebarLogout" onClick={signOut}>
            Esci
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebarBackdrop" onClick={() => setMobileOpen(false)} aria-label="Chiudi menu" />}

      <main className="appMain">{children}</main>
    </div>
  );
}
