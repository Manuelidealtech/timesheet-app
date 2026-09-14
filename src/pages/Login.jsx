import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRoleHomePath } from '../lib/access';

export default function Login() {
  const { signIn, user, role, sessionLoading, profileLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const requestedPath = location.state?.from || null;

  useEffect(() => {
    if (!sessionLoading && !profileLoading && user && role) {
      nav(requestedPath || getRoleHomePath(role), { replace: true });
    }
  }, [sessionLoading, profileLoading, user, role, requestedPath, nav]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await signIn(email, password);
      nav(requestedPath || '/', { replace: true });
    } catch (e2) {
      setErr(e2?.message || 'Errore login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginGlow loginGlowOne" />
      <div className="loginGlow loginGlowTwo" />

      <section className="loginShell" aria-label="Accesso Timesheet">
        <aside className="loginIntro">
          <div className="loginBrandMark"><img src="/icon-192.png" alt="Timesheet" /></div>
          <span className="loginEyebrow">Idealtech workspace</span>
          <h1>Il lavoro di ogni giorno, registrato e analizzato.</h1>
          <p>
            Registra le attività, consulta lo storico e controlla ore e commesse da un’unica area protetta.
          </p>

          <div className="loginHighlights">
            <div><span>01</span><strong>Timesheet semplici</strong><small>Inserimento rapido e chiaro</small></div>
            <div><span>02</span><strong>Dati centralizzati</strong><small>Utenti, costi e reparti</small></div>
            <div><span>03</span><strong>Accesso sicuro</strong><small>Permessi differenziati per ruolo</small></div>
          </div>
        </aside>

        <div className="loginCard">
          <div className="loginCardHead">
            <div>
              <span className="loginEyebrow">Bentornato</span>
              <h2>Accedi a Timesheet</h2>
              <p>Usa le credenziali aziendali assegnate al tuo profilo.</p>
            </div>
            <span className="loginCompanyBadge">Idealtech</span>
          </div>

          <form onSubmit={onSubmit} className="loginForm">
            <div className="formGroup loginField">
              <label htmlFor="login-email">Email</label>
              <div className="loginInputWrap">
                <span className="loginInputIcon" aria-hidden="true">@</span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@idealtech.it"
                  required
                />
              </div>
            </div>

            <div className="formGroup loginField">
              <label htmlFor="login-password">Password</label>
              <div className="loginInputWrap">
                <span className="loginInputIcon" aria-hidden="true">●</span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Inserisci la password"
                  required
                />
                <button
                  type="button"
                  className="loginReveal"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
            </div>

            {err && <div className="toast err loginError">{err}</div>}

            <button className="btn btnPrimary loginSubmit" disabled={loading}>
              {loading ? 'Accesso in corso…' : 'Accedi al workspace'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="loginFooterNote">
            <span className="loginStatusDot" /> Area riservata ai dipendenti Idealtech
          </div>
        </div>
      </section>
    </main>
  );
}
