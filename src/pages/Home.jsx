import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { DEPARTMENT_LABELS, ROLE_LABELS } from '../lib/access';

const EMPTY_SUMMARY = {
  totalTimesheets: 0,
  totalMinutes: 0,
  totalEmployees: 0,
};

export default function Home() {
  const { role, profile } = useAuth();

  const isAdmin = role === 'admin';
  const isOffice = role === 'ufficio';
  const currentDepartment = profile?.department || null;
  const linkedEmployeeId = profile?.employee_id ? Number(profile.employee_id) : null;

  const [missingEmployees, setMissingEmployees] = useState([]);
  const [loadingMissing, setLoadingMissing] = useState(true);
  const [missingError, setMissingError] = useState('');

  const [newsItems, setNewsItems] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [savingNews, setSavingNews] = useState(false);

  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const roleLabel = ROLE_LABELS[role] || role;
  const departmentLabel = currentDepartment ? DEPARTMENT_LABELS[currentDepartment] : null;
  const targetCompilePath = role === 'ufficio' ? '/ufficio' : '/produzione';

  useEffect(() => {
    let alive = true;

    async function loadMissingEmployees() {
      try {
        if (!alive) return;

        setLoadingMissing(true);
        setMissingError('');

        let employeesQuery = supabase
          .from('employees')
          .select('id, full_name, department')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (isAdmin) {
          // nessun filtro
        } else if (isOffice && linkedEmployeeId) {
          employeesQuery = employeesQuery.eq('id', linkedEmployeeId);
        } else if (currentDepartment) {
          employeesQuery = employeesQuery.eq('department', currentDepartment);
        }

        const { data: employees, error: empError } = await employeesQuery;
        if (empError) throw empError;

        const safeEmployees = employees || [];

        if (!alive) return;

        if (safeEmployees.length === 0) {
          setMissingEmployees([]);
          setSummary(EMPTY_SUMMARY);
          return;
        }

        const employeeIds = safeEmployees.map((emp) => emp.id);

        const { data: todayTimesheets, error: tsError } = await supabase
          .from('timesheets')
          .select('employee_id, minutes')
          .eq('work_date', today)
          .in('employee_id', employeeIds);

        if (tsError) throw tsError;
        if (!alive) return;

        const safeTimesheets = todayTimesheets || [];
        const compiledToday = new Set(safeTimesheets.map((row) => row.employee_id));
        const missing = safeEmployees.filter((emp) => !compiledToday.has(emp.id));
        const totalMinutes = safeTimesheets.reduce(
          (acc, row) => acc + (Number(row.minutes) || 0),
          0
        );

        setMissingEmployees(missing);
        setSummary({
          totalTimesheets: safeTimesheets.length,
          totalMinutes,
          totalEmployees: safeEmployees.length,
        });
      } catch (err) {
        console.error('Errore caricamento dipendenti mancanti:', err);

        if (!alive) return;

        setMissingError('Impossibile caricare il resoconto giornaliero.');
        setMissingEmployees([]);
        setSummary(EMPTY_SUMMARY);
      } finally {
        if (alive) setLoadingMissing(false);
      }
    }

    async function loadNews() {
      try {
        if (!alive) return;

        setLoadingNews(true);
        setNewsError('');

        const { data, error } = await supabase
          .from('news')
          .select('id, title, content, created_at, is_published')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!alive) return;

        setNewsItems(data || []);
      } catch (err) {
        console.error('Errore caricamento news:', err);
        if (!alive) return;

        setNewsError('Impossibile caricare le news.');
        setNewsItems([]);
      } finally {
        if (alive) setLoadingNews(false);
      }
    }

    loadMissingEmployees();
    loadNews();

    return () => {
      alive = false;
    };
  }, [today, isAdmin, isOffice, currentDepartment, linkedEmployeeId]);

  async function handleCreateNews(e) {
    e.preventDefault();
    const title = newsTitle.trim();
    const content = newsContent.trim();

    if (!title || !content) return;

    try {
      setSavingNews(true);
      setNewsError('');

      const { data, error } = await supabase
        .from('news')
        .insert([{ title, content, is_published: true }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setNewsItems((prev) => [data, ...prev]);
      }

      setNewsTitle('');
      setNewsContent('');
    } catch (err) {
      console.error('Errore creazione news:', err);
      setNewsError('Impossibile pubblicare la news.');
    } finally {
      setSavingNews(false);
    }
  }

  async function handleDeleteNews(id) {
    if (!window.confirm('Vuoi eliminare questa news?')) return;

    try {
      setNewsError('');

      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;

      setNewsItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Errore eliminazione news:', err);
      setNewsError('Impossibile eliminare la news.');
    }
  }

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="container pageShell homeWorkspace">
      <section className="pageHero homeCard homeHeroCompact">
        <div className="cardHeader homeHeroHeader">
          <div>
            <span className="dailyReportEyebrow">Idealtech workspace</span>
            <h1 className="h1">{profile?.display_name ? `Ciao, ${profile.display_name}` : 'Timesheet'}</h1>
            <p className="sub">
              {isAdmin
                ? 'Controlla rapidamente attività, compilazioni e operatività aziendale.'
                : `Area ${departmentLabel?.toLowerCase() || roleLabel?.toLowerCase() || 'personale'} per registrare e consultare il lavoro quotidiano.`}
            </p>
          </div>
          <div className="homeHeroIdentity">
            <span>{roleLabel}</span>
            {departmentLabel && <strong>{departmentLabel}</strong>}
          </div>
        </div>

        <div className="homeQuickActions">
          {!isAdmin ? (
            <>
              <Link className="btn btnPrimary" to={targetCompilePath}>Compila Timesheet</Link>
              <Link className="btn" to="/storico">{isOffice ? 'Il mio storico' : 'Storico reparto'}</Link>
              <Link className="btn" to="/interventi">Fogli intervento</Link>
            </>
          ) : (
            <>
              <Link className="btn btnPrimary" to="/admin">Apri Dashboard</Link>
              <Link className="btn" to="/admin/timesheets">Controlla timesheet</Link>
              <Link className="btn" to="/admin/commesse">Gestione commesse</Link>
              <Link className="btn" to="/admin/users">Gestisci utenti</Link>
            </>
          )}
        </div>
      </section>

      <section className="homeMetricsGrid">
        <div className="kpi homeMetricCard">
          <div className="label">Timesheet oggi</div>
          <div className="value">{summary.totalTimesheets}</div>
          <div className="homeMetricMeta">registrazioni inserite</div>
        </div>
        <div className="kpi homeMetricCard">
          <div className="label">Tempo registrato</div>
          <div className="value">{Math.floor(summary.totalMinutes / 60)}h {String(summary.totalMinutes % 60).padStart(2, '0')}m</div>
          <div className="homeMetricMeta">totale della giornata</div>
        </div>
        <div className="kpi homeMetricCard">
          <div className="label">Persone monitorate</div>
          <div className="value">{summary.totalEmployees}</div>
          <div className="homeMetricMeta">profili attivi visibili</div>
        </div>
      </section>

      <section className="dailyReport homeDailyReport">
        <div className="dailyReportHead">
          <div>
            <span className="dailyReportEyebrow">Monitoraggio giornaliero</span>
            <h2 className="dailyReportTitle">
              {isAdmin
                ? 'Compilazione timesheet globale'
                : isOffice
                  ? 'Compilazione del tuo timesheet'
                  : `Compilazione timesheet ${departmentLabel?.toLowerCase() || 'reparto'}`}
            </h2>
            <p className="dailyReportText">
              {isAdmin
                ? 'Controlla chi non ha ancora registrato attività nella giornata di oggi.'
                : isOffice
                  ? 'Verifica immediatamente se il tuo timesheet di oggi risulta compilato.'
                  : 'Visualizza chi deve ancora inserire il timesheet nel tuo reparto.'}
            </p>
          </div>

          {!loadingMissing && !missingError && (
            <div className={missingEmployees.length > 0 ? 'reportCounter reportCounterAlert' : 'reportCounter reportCounterOk'}>
              {missingEmployees.length > 0 ? `${missingEmployees.length} mancanti` : 'Tutti compilati'}
            </div>
          )}
        </div>

        {loadingMissing && <div className="reportState reportStateNeutral">Caricamento resoconto...</div>}
        {!loadingMissing && missingError && <div className="reportState reportStateError">{missingError}</div>}
        {!loadingMissing && !missingError && missingEmployees.length === 0 && (
          <div className="reportState reportStateSuccess">Tutti i dipendenti visibili hanno già compilato almeno un timesheet oggi.</div>
        )}
        {!loadingMissing && !missingError && missingEmployees.length > 0 && (
          <div className="missingEmployeesList">
            {missingEmployees.map((employee) => (
              <div key={employee.id} className="missingEmployeeCard">
                <div style={{ fontWeight: 800 }}>{employee.full_name}</div>
                <div className="sub" style={{ marginTop: 3 }}>
                  {employee.department ? DEPARTMENT_LABELS[employee.department] || employee.department : 'Reparto non assegnato'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card homeNewsCard">
        <div className="cardHeader">
          <div>
            <span className="dailyReportEyebrow">Comunicazioni</span>
            <h2 className="homeSectionTitle">News interne</h2>
            <p className="sub">Aggiornamenti rapidi visibili a tutti gli utenti dell’app.</p>
          </div>
          {isAdmin && <span className="badge">Admin</span>}
        </div>

        {isAdmin && (
          <form onSubmit={handleCreateNews} className="homeNewsComposer">
            <div className="formGroup">
              <label>Titolo</label>
              <input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="Nuovo aggiornamento" />
            </div>
            <div className="formGroup">
              <label>Contenuto</label>
              <textarea value={newsContent} onChange={(e) => setNewsContent(e.target.value)} placeholder="Scrivi il messaggio da mostrare in home..." />
            </div>
            <div className="row">
              <button type="submit" className="btn btnPrimary" disabled={savingNews}>{savingNews ? 'Pubblico...' : 'Pubblica news'}</button>
            </div>
          </form>
        )}

        {newsError && <div className="toast err">{newsError}</div>}
        {loadingNews && <div className="sub">Caricamento news...</div>}
        {!loadingNews && !newsItems.length && <div className="reportState reportStateNeutral">Nessuna news pubblicata.</div>}

        <div className="newsList homeNewsList">
          {newsItems.map((item) => (
            <article key={item.id} className="newsItem homeNewsItem">
              <div className="newsItemHead">
                <div className="homeNewsTitle">{item.title}</div>
                <span className="sub">{formatDate(item.created_at)}</span>
              </div>
              <div className="sub homeNewsContent">{item.content}</div>
              {isAdmin && (
                <div className="row homeNewsActions">
                  <button type="button" className="btn btnDanger btnSmall" onClick={() => handleDeleteNews(item.id)}>Elimina</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
