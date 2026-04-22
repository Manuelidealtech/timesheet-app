import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { insertTimesheet } from '../lib/api';
import { DEPARTMENT_LABELS, normalizeDepartment } from '../lib/access';

function minutesDiff(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return Math.max(0, e - s);
}

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, '0')}m`;
}

export default function DepartmentTimesheetPage({ department }) {
  const { role, profile } = useAuth();

  const normalizedDepartment = normalizeDepartment(department);
  const pageTitle = DEPARTMENT_LABELS[normalizedDepartment] || 'Reparto';
  const profileDepartment = normalizeDepartment(profile?.department);
  const linkedEmployeeId = profile?.employee_id ? String(profile.employee_id) : '';

  const isAdmin = role === 'admin';
  const isOffice = role === 'ufficio';
  const isProduction = role === 'produzione';

  const canAccessPage =
    isAdmin ||
    (isOffice && normalizedDepartment === 'ufficio') ||
    (isProduction && normalizedDepartment === 'produzione');

  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [employees, setEmployees] = useState([]);
  const [cdl, setCdl] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);
  const [latest, setLatest] = useState([]);

  const [employeeId, setEmployeeId] = useState(linkedEmployeeId);
  const [cdlId, setCdlId] = useState('');
  const [lavId, setLavId] = useState('');
  const [workDate, setWorkDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:00');
  const [note, setNote] = useState('');

  const previewMinutes = useMemo(() => minutesDiff(startTime, endTime), [startTime, endTime]);

  const selectedEmployeeName = useMemo(() => {
    const found = employees.find((item) => String(item.id) === String(employeeId));
    return found?.full_name || '';
  }, [employees, employeeId]);

  async function loadLatest(empId) {
    if (!empId) {
      setLatest([]);
      return;
    }

    try {
      setLoadingLatest(true);

      let query = supabase
        .from('timesheets')
        .select(`
          id,
          employee_id,
          department,
          work_date,
          start_time,
          end_time,
          minutes,
          note,
          cdl(id, code, name),
          lavorazioni(id, name)
        `)
        .eq('employee_id', Number(empId))
        .order('work_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(12);

      if (!isAdmin && isProduction) {
        query = query.eq('department', 'produzione');
      }

      if (!isAdmin && isOffice && linkedEmployeeId) {
        query = query.eq('employee_id', Number(linkedEmployeeId));
      }

      const { data, error } = await query;

      if (error) throw error;
      setLatest(data || []);
    } catch (loadError) {
      console.error(loadError);
      setErr(loadError?.message || 'Errore caricamento ultimi inserimenti');
    } finally {
      setLoadingLatest(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingLists(true);
        setErr('');

        let employeesQuery = supabase
          .from('employees')
          .select('id, full_name, is_active, department')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (!isAdmin && isOffice && linkedEmployeeId) {
          employeesQuery = employeesQuery.eq('id', Number(linkedEmployeeId));
        } else if (!isAdmin && isProduction) {
          employeesQuery = employeesQuery.eq('department', 'produzione');
        } else if (normalizedDepartment) {
          employeesQuery = employeesQuery.eq('department', normalizedDepartment);
        }

        const [employeesRes, cdlRes, lavorazioniRes] = await Promise.all([
          employeesQuery,
          supabase.from('cdl').select('id, code, name').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('lavorazioni').select('id, name').eq('is_active', true).order('name', { ascending: true }),
        ]);

        if (employeesRes.error) throw employeesRes.error;
        if (cdlRes.error) throw cdlRes.error;
        if (lavorazioniRes.error) throw lavorazioniRes.error;
        if (!alive) return;

        const departmentEmployees = employeesRes.data || [];

        const availableEmployees = isOffice
          ? departmentEmployees.filter((item) => String(item.id) === String(linkedEmployeeId))
          : departmentEmployees;

        setEmployees(availableEmployees);
        setCdl(cdlRes.data || []);
        setLavorazioni(lavorazioniRes.data || []);

        const nextEmployeeId = isOffice
          ? String(linkedEmployeeId || '')
          : employeeId || (availableEmployees[0] ? String(availableEmployees[0].id) : '');

        const nextCdlId = cdlId || (cdlRes.data?.[0] ? String(cdlRes.data[0].id) : '');
        const nextLavId = lavId || (lavorazioniRes.data?.[0] ? String(lavorazioniRes.data[0].id) : '');

        setEmployeeId(nextEmployeeId);
        setCdlId(nextCdlId);
        setLavId(nextLavId);

        if (nextEmployeeId) await loadLatest(nextEmployeeId);
      } catch (loadError) {
        console.error(loadError);
        setErr(loadError?.message || 'Errore caricamento liste');
      } finally {
        if (alive) setLoadingLists(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [normalizedDepartment, linkedEmployeeId, isOffice, isProduction, isAdmin]);

  useEffect(() => {
    if (isOffice && linkedEmployeeId) {
      setEmployeeId(String(linkedEmployeeId));
      return;
    }

    if (employeeId) {
      loadLatest(employeeId);
    }
  }, [employeeId, isOffice, linkedEmployeeId]);

  async function onSave(event) {
    event.preventDefault();
    setErr('');
    setOk('');

    const finalEmployeeId = isOffice && linkedEmployeeId ? linkedEmployeeId : employeeId;

    if (!finalEmployeeId) return setErr('Seleziona un dipendente.');
    if (!cdlId) return setErr('Seleziona una commessa (CDL).');
    if (!lavId) return setErr('Seleziona una lavorazione.');
    if (!workDate) return setErr('Seleziona la data.');
    if (!startTime || !endTime) return setErr('Inserisci orari validi.');
    if (previewMinutes <= 0) return setErr("L'orario 'Alle' deve essere dopo 'Dalle'.");

    try {
      setSaving(true);

      await insertTimesheet([
        {
          employee_id: Number(finalEmployeeId),
          cdl_id: Number(cdlId),
          lavorazione_id: Number(lavId),
          work_date: workDate,
          start_time: startTime,
          end_time: endTime,
          note: note?.trim() || null,
          department: normalizedDepartment || profileDepartment || null,
          created_by: profile?.user_id || null,
        },
      ]);

      setOk('Salvato ✅');
      setNote('');
      await loadLatest(finalEmployeeId);

      setStartTime(endTime);
      setEndTime(dayjs(`2000-01-01T${endTime}:00`).add(30, 'minute').format('HH:mm'));
    } catch (saveError) {
      console.error(saveError);
      setErr(saveError?.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
      setTimeout(() => setOk(''), 2200);
    }
  }

  if (!canAccessPage) {
    return <Navigate to="/" replace />;
  }

  if (loadingLists) {
    return (
      <div className="container pageShell">
        <section className="pageHero">
          <div className="pageBody">
            <div className="card">Caricamento...</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container pageShell">
      <section className="pageHero">
        <div className="pageHeader">
          <div className="pageHeaderMain">
            <h1 className="pageTitle">{pageTitle}</h1>
            <p className="pageSubtitle">
              Compilazione timesheet dedicata al reparto {pageTitle.toLowerCase()}.
              {isOffice && selectedEmployeeName ? ` Accesso collegato a ${selectedEmployeeName}.` : ''}
            </p>
          </div>
          <span className="badge">{pageTitle}</span>
        </div>

        <div className="pageBody">
          <div className="split">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="sub">Nuova registrazione</div>
              <div style={{ fontWeight: 750, marginTop: 4 }}>Inserisci attività</div>
            </div>
            <span className="pill">{previewMinutes} min</span>
          </div>

          <hr className="sep" />

          <form onSubmit={onSave} className="grid">
            <div className="formGroup">
              <label>{isOffice ? 'Il tuo profilo collegato' : 'Dipendente'}</label>
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={isOffice}
              >
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label>Commessa / CDL</label>
              <select value={cdlId} onChange={(event) => setCdlId(event.target.value)}>
                {cdl.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code ? `${item.code} — ` : ''}
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label>Lavorazione</label>
              <select value={lavId} onChange={(event) => setLavId(event.target.value)}>
                {lavorazioni.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid3">
              <div className="formGroup">
                <label>Data</label>
                <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
              </div>

              <div className="formGroup">
                <label>Dalle</label>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>

              <div className="formGroup">
                <label>Alle</label>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </div>
            </div>

            <div className="formGroup">
              <label>Note</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={`Scrivi cosa è stato fatto nel reparto ${pageTitle.toLowerCase()}...`}
              />
            </div>

            {err && <div className="toast err">{err}</div>}
            {ok && <div className="toast ok">{ok}</div>}

            <div className="row">
              <button className="btn btnPrimary" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
              <div className="sub">
                Totale: <b>{fmtMinutes(previewMinutes)}</b>
              </div>
              <div className="spacer" />
              <span className="sub">
                {isOffice
                  ? 'Puoi compilare solo il tuo timesheet personale.'
                  : 'Il reparto visualizza solo i propri inserimenti.'}
              </span>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="sub">Ultimi inserimenti</div>
              <div style={{ fontWeight: 750, marginTop: 4 }}>{selectedEmployeeName || '—'}</div>
            </div>
            <span className="badge">Ultimi 12</span>
          </div>

          <hr className="sep" />

          {loadingLatest ? (
            <div className="sub">Caricamento...</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {latest.map((item) => (
                <div key={item.id} className="kpi" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="pill ok">{fmtMinutes(item.minutes || 0)}</span>
                    <span className="sub">{item.work_date}</span>
                  </div>

                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    {String(item.start_time).slice(0, 5)} → {String(item.end_time).slice(0, 5)}
                  </div>

                  <div className="sub" style={{ marginTop: 6 }}>
                    <b>CDL:</b> {item.cdl?.code ? `${item.cdl.code} — ` : ''}
                    {item.cdl?.name}
                  </div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    <b>Lav:</b> {item.lavorazioni?.name}
                  </div>

                  {item.note && <div className="sub" style={{ marginTop: 8, opacity: 0.85 }}>{item.note}</div>}
                </div>
              ))}

              {!latest.length && <div className="sub">Nessun inserimento recente per questo dipendente.</div>}
            </div>
          )}
        </div>
          </div>
        </div>
      </section>
    </div>
  );
}