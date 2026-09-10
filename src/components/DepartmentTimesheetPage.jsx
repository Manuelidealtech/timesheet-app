import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { insertTimesheet } from '../lib/api';
import { DEPARTMENT_LABELS, normalizeDepartment } from '../lib/access';
import CdlPicker from './CdlPicker';

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

function formatCdlLabel(item) {
  if (!item) return '—';
  const code = String(item?.code || '').trim();
  const revision = /^revisione\b/i.test(String(item?.name || '').trim()) || code === '0000' || /^REV-/i.test(code);
  const displayCode = revision ? 'REV' : code;
  return `${displayCode ? `${displayCode} — ` : ''}${item?.name || ''}`.trim();
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
          supabase.from('cdl').select('id, code, name, client').eq('is_active', true).order('code', { ascending: true }).order('name', { ascending: true }),
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

  const refreshCdlOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('cdl')
      .select('id, code, name, client')
      .eq('is_active', true)
      .order('code', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    const nextRows = data || [];
    setCdl(nextRows);
    setCdlId((currentId) => {
      if (currentId && nextRows.some((item) => String(item.id) === String(currentId))) {
        return currentId;
      }
      return nextRows[0] ? String(nextRows[0].id) : '';
    });

    return nextRows;
  }, []);

  // Mantiene il menu commesse sempre allineato con la scansione del file server.
  // Il menu si aggiorna appena viene aperto, ogni 5 secondi, al ritorno sull'app
  // e tramite Realtime quando Supabase lo rende disponibile.
  useEffect(() => {
    let active = true;
    let refreshing = false;

    const refresh = async () => {
      if (refreshing || !active) return;
      refreshing = true;
      try {
        await refreshCdlOptions();
      } catch (refreshError) {
        console.error('Aggiornamento automatico commesse fallito:', refreshError);
      } finally {
        refreshing = false;
      }
    };

    // 5 secondi: la scansione manuale dell'admin si riflette molto rapidamente
    // sui menu degli utenti senza costringerli a ricaricare la pagina.
    const intervalId = window.setInterval(refresh, 5000);

    const handleFocus = () => refresh();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const channel = supabase
      .channel(`cdl-timesheet-${normalizedDepartment || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cdl' },
        () => refresh(),
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [normalizedDepartment, refreshCdlOptions]);

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
    <div className="container pageShell timesheetEntryPage">
      <section className="pageHero timesheetEntryHero">
        <div className="pageHeader">
          <div className="pageHeaderMain">
            <span className="dailyReportEyebrow">Nuova registrazione</span>
            <h1 className="pageTitle">{pageTitle}</h1>
            <p className="pageSubtitle">
              Registra l’attività svolta nel reparto {pageTitle.toLowerCase()}.
              {isOffice && selectedEmployeeName ? ` Profilo collegato: ${selectedEmployeeName}.` : ''}
            </p>
          </div>
          <div className="timesheetHeroStatus">
            <span>Durata attuale</span>
            <strong>{fmtMinutes(previewMinutes)}</strong>
          </div>
        </div>
      </section>

      <div className="split timesheetEntryLayout">
        <section className="card timesheetFormCard">
          <div className="cardHeader">
            <div>
              <span className="dailyReportEyebrow">Attività</span>
              <h2 className="timesheetCardTitle">Compila il timesheet</h2>
            </div>
            <span className="pill timesheetDurationBadge">{previewMinutes} min</span>
          </div>

          <form onSubmit={onSave} className="grid timesheetEntryForm">
            <div className="timesheetPrimaryFields">
              <div className="formGroup">
                <label>{isOffice ? 'Il tuo profilo collegato' : 'Dipendente'}</label>
                <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={isOffice}>
                  {employees.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                </select>
              </div>

              <div className="formGroup cdlPickerFormGroup">
                <label>Commessa / CDL</label>
                <CdlPicker
                  value={cdlId}
                  items={cdl}
                  onChange={setCdlId}
                  onRefresh={refreshCdlOptions}
                  disabled={loadingLists}
                />
              </div>

              <div className="formGroup">
                <label>Lavorazione</label>
                <select value={lavId} onChange={(event) => setLavId(event.target.value)}>
                  {lavorazioni.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            </div>

            <div className="timesheetTimeGrid">
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
              <label>Note attività</label>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={`Descrivi brevemente cosa è stato fatto in ${pageTitle.toLowerCase()}...`} />
            </div>

            {err && <div className="toast err">{err}</div>}
            {ok && <div className="toast ok">{ok}</div>}

            <div className="timesheetFormActions">
              <div className="timesheetFormTotal">
                <span>Totale</span>
                <strong>{fmtMinutes(previewMinutes)}</strong>
              </div>
              <button className="btn btnPrimary timesheetSaveBtn" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva timesheet'}
              </button>
            </div>
          </form>
        </section>

        <aside className="card timesheetLatestCard">
          <div className="cardHeader">
            <div>
              <span className="dailyReportEyebrow">Cronologia rapida</span>
              <h2 className="timesheetCardTitle">Ultimi inserimenti</h2>
              <p className="sub">{selectedEmployeeName || '—'}</p>
            </div>
            <span className="badge">Ultimi 12</span>
          </div>

          {loadingLatest ? (
            <div className="reportState reportStateNeutral">Caricamento...</div>
          ) : (
            <div className="recentEntryList">
              {latest.map((item) => (
                <article key={item.id} className="recentEntryCard">
                  <div className="recentEntryTop">
                    <span className="pill ok">{fmtMinutes(item.minutes || 0)}</span>
                    <time>{item.work_date}</time>
                  </div>
                  <strong className="recentEntryTime">{String(item.start_time).slice(0, 5)} → {String(item.end_time).slice(0, 5)}</strong>
                  <div className="recentEntryMeta"><span>CDL</span><b>{formatCdlLabel(item.cdl)}</b></div>
                  <div className="recentEntryMeta"><span>Lav.</span><b>{item.lavorazioni?.name}</b></div>
                  {item.note && <p className="recentEntryNote">{item.note}</p>}
                </article>
              ))}
              {!latest.length && <div className="reportState reportStateNeutral">Nessun inserimento recente per questo dipendente.</div>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
