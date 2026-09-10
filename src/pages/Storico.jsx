import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { fetchCdl, fetchLavorazioni, updateTimesheet, deleteTimesheet } from '../lib/api';
import TimesheetEditModal from '../components/TimesheetEditModal';
import { DEPARTMENT_LABELS } from '../lib/access';

function fmtMinutes(m) {
  const safe = Number(m) || 0;
  const h = Math.floor(safe / 60);
  const mm = safe % 60;
  return `${h}h ${String(mm).padStart(2, '0')}m`;
}

function compactDate(value) {
  if (!value) return { day: '—', month: '' };
  const parsed = dayjs(value);
  if (!parsed.isValid()) return { day: value, month: '' };
  return {
    day: parsed.format('DD'),
    month: parsed.format('MMM').replace('.', '').toUpperCase(),
  };
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    list: <><path d="M8 6h11M8 12h11M8 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M4 13l2 5a7 7 0 0 0 11.9-3"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };

  return <svg {...common}>{paths[name] || paths.list}</svg>;
}

export default function Storico() {
  const { role, profile } = useAuth();

  const isAdmin = role === 'admin';
  const isOffice = role === 'ufficio';
  const department = profile?.department || null;
  const linkedEmployeeId = profile?.employee_id ? String(profile.employee_id) : '';

  const [employees, setEmployees] = useState([]);
  const [cdl, setCdl] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);

  const [employeeId, setEmployeeId] = useState(linkedEmployeeId);
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [q, setQ] = useState('');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [editRow, setEditRow] = useState(null);

  async function loadAllLists() {
    let employeesQuery = supabase
      .from('employees')
      .select('id, full_name, department')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (isAdmin) {
      // admin vede tutti i dipendenti
    } else if (isOffice && linkedEmployeeId) {
      employeesQuery = employeesQuery.eq('id', Number(linkedEmployeeId));
    } else if (department) {
      employeesQuery = employeesQuery.eq('department', department);
    }

    const [e, c, l] = await Promise.all([employeesQuery, fetchCdl(), fetchLavorazioni()]);

    if (e.error) throw e.error;

    const employeeList = e.data || [];

    setEmployees(employeeList);
    setCdl(c || []);
    setLavorazioni(l || []);

    if (isOffice && linkedEmployeeId) {
      setEmployeeId(linkedEmployeeId);
    } else if (!employeeId && employeeList[0]) {
      setEmployeeId(String(employeeList[0].id));
    }
  }

  async function load() {
    setErr('');
    setOk('');

    try {
      setLoading(true);

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
          cdl_id,
          lavorazione_id,
          employees(full_name, department),
          cdl(id, code, name),
          lavorazioni(id, name)
        `)
        .gte('work_date', from)
        .lte('work_date', to)
        .order('work_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (isOffice && linkedEmployeeId) {
        query = query.eq('employee_id', Number(linkedEmployeeId));
      } else if (employeeId) {
        query = query.eq('employee_id', Number(employeeId));
      }

      if (!isAdmin && !isOffice && department) {
        query = query.eq('department', department);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRows(data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'Errore caricamento storico');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllLists().catch((e2) => {
      console.error(e2);
      setErr(e2?.message || 'Errore liste');
    });
  }, [isAdmin, isOffice, department, linkedEmployeeId]);

  useEffect(() => {
    setEmployeeId(linkedEmployeeId);
  }, [linkedEmployeeId]);

  useEffect(() => {
    if (isOffice && linkedEmployeeId) {
      load();
      return;
    }

    if (employeeId || isAdmin) {
      load();
    }
  }, [employeeId, isAdmin, isOffice, linkedEmployeeId, department, from, to]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r) => {
      const searchable = [
        r.work_date,
        r.employees?.full_name,
        r.employees?.department,
        r.department,
        r.cdl?.code,
        r.cdl?.name,
        r.lavorazioni?.name,
        r.note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(needle);
    });
  }, [rows, q]);

  const totalMinutes = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (Number(r.minutes) || 0), 0),
    [filteredRows]
  );

  const uniqueDays = useMemo(
    () => new Set(filteredRows.map((row) => row.work_date).filter(Boolean)).size,
    [filteredRows]
  );

  const uniqueCommesse = useMemo(
    () => new Set(filteredRows.map((row) => row.cdl_id).filter(Boolean)).size,
    [filteredRows]
  );

  const averageMinutes = uniqueDays ? Math.round(totalMinutes / uniqueDays) : 0;

  const selectedEmployeeName = useMemo(() => {
    if (!employeeId) return isAdmin ? 'Tutti i dipendenti' : 'Profilo corrente';
    return employees.find((employee) => String(employee.id) === String(employeeId))?.full_name || 'Dipendente';
  }, [employeeId, employees, isAdmin]);

  const periodLabel = useMemo(() => {
    const start = dayjs(from);
    const end = dayjs(to);
    if (!start.isValid() || !end.isValid()) return '';
    return `${start.format('DD MMM')} – ${end.format('DD MMM YYYY')}`;
  }, [from, to]);

  async function onDelete(row) {
    if (!isAdmin) return;
    if (!window.confirm('Vuoi eliminare questo timesheet?')) return;

    try {
      setLoading(true);
      await deleteTimesheet(row.id);
      setOk('Timesheet eliminato');
      await load();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'Errore eliminazione');
    } finally {
      setLoading(false);
      setTimeout(() => setOk(''), 2200);
    }
  }

  async function onSaveEdit(patch) {
    try {
      setLoading(true);
      setErr('');
      setOk('');
      await updateTimesheet(editRow.id, patch);
      setOk('Timesheet aggiornato');
      setEditRow(null);
      await load();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'Errore modifica');
    } finally {
      setLoading(false);
      setTimeout(() => setOk(''), 2200);
    }
  }

  function applyPreset(type) {
    const today = dayjs();

    if (type === 'today') {
      setFrom(today.format('YYYY-MM-DD'));
      setTo(today.format('YYYY-MM-DD'));
      return;
    }

    if (type === 'week') {
      setFrom(today.subtract(6, 'day').format('YYYY-MM-DD'));
      setTo(today.format('YYYY-MM-DD'));
      return;
    }

    setFrom(today.startOf('month').format('YYYY-MM-DD'));
    setTo(today.format('YYYY-MM-DD'));
  }

  return (
    <div className="container pageShell historyPage">
      <section className="pageHero historyHero">
        <div className="historyHeroTop">
          <div>
            <span className="historyEyebrow">Archivio operativo</span>
            <h1 className="pageTitle">Storico Timesheet</h1>
            <p className="pageSubtitle">
              {isAdmin
                ? 'Consulta l’attività aziendale con una vista chiara, filtrabile e pronta per il controllo.'
                : isOffice
                  ? 'Il tuo archivio personale, organizzato per periodo, commessa e lavorazione.'
                  : `Storico del reparto ${DEPARTMENT_LABELS[department]?.toLowerCase() || 'assegnato'}, con tutti i dettagli operativi.`}
            </p>
          </div>

          <div className="historyHeroContext">
            <span className="historyHeroContextLabel">Vista corrente</span>
            <strong>{selectedEmployeeName}</strong>
            <span>{periodLabel}</span>
          </div>
        </div>

        <div className="historyMetricGrid">
          <div className="historyMetricCard historyMetricCard--primary">
            <div className="historyMetricIcon"><Icon name="clock" /></div>
            <div>
              <span>Tempo totale</span>
              <strong>{fmtMinutes(totalMinutes)}</strong>
              <small>nel periodo selezionato</small>
            </div>
          </div>
          <div className="historyMetricCard">
            <div className="historyMetricIcon"><Icon name="list" /></div>
            <div>
              <span>Registrazioni</span>
              <strong>{filteredRows.length}</strong>
              <small>righe timesheet</small>
            </div>
          </div>
          <div className="historyMetricCard">
            <div className="historyMetricIcon"><Icon name="calendar" /></div>
            <div>
              <span>Giorni lavorati</span>
              <strong>{uniqueDays}</strong>
              <small>media {fmtMinutes(averageMinutes)} / giorno</small>
            </div>
          </div>
          <div className="historyMetricCard">
            <div className="historyMetricIcon"><Icon name="briefcase" /></div>
            <div>
              <span>Commesse</span>
              <strong>{uniqueCommesse}</strong>
              <small>commesse distinte</small>
            </div>
          </div>
        </div>
      </section>

      <section className="card historyControlPanel">
        <div className="historyControlHead">
          <div>
            <span className="historySectionEyebrow">Filtri</span>
            <h2>Trova subito quello che cerchi</h2>
          </div>
          <div className="historyQuickRanges" aria-label="Intervalli rapidi">
            <button type="button" className="historyRangeBtn" onClick={() => applyPreset('today')}>Oggi</button>
            <button type="button" className="historyRangeBtn" onClick={() => applyPreset('week')}>Ultimi 7 giorni</button>
            <button type="button" className="historyRangeBtn" onClick={() => applyPreset('month')}>Questo mese</button>
          </div>
        </div>

        <div className="historyFiltersGrid">
          <div className="formGroup historyFilterEmployee">
            <label>
              {isOffice
                ? 'Il tuo profilo collegato'
                : profile?.employee_id
                  ? 'Dipendente associato'
                  : 'Dipendente'}
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={isOffice || Boolean(profile?.employee_id)}
            >
              {!employeeId && <option value="">Tutti</option>}
              {employees.map((x) => (
                <option key={x.id} value={x.id}>{x.full_name}</option>
              ))}
            </select>
          </div>

          <div className="formGroup">
            <label>Dal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="formGroup">
            <label>Al</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="formGroup historySearchField">
            <label>Ricerca libera</label>
            <div className="historySearchInput">
              <Icon name="search" size={17} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Commessa, lavorazione, note..."
              />
            </div>
          </div>

          <button className="btn btnPrimary historyApplyBtn" onClick={load} disabled={loading}>
            <Icon name={loading ? 'refresh' : 'filter'} size={17} />
            {loading ? 'Aggiorno...' : isOffice ? 'Aggiorna' : 'Applica filtri'}
          </button>
        </div>
      </section>

      {err && <div className="toast err historyToast">{err}</div>}
      {ok && <div className="toast ok historyToast">{ok}</div>}

      <section className="card historyResultsPanel">
        <div className="historyResultsHead">
          <div>
            <span className="historySectionEyebrow">Risultati</span>
            <h2>{filteredRows.length} {filteredRows.length === 1 ? 'registrazione' : 'registrazioni'}</h2>
            <p>{q ? `Risultati filtrati per “${q}”` : `Periodo ${periodLabel}`}</p>
          </div>
          <div className="historyTotalBadge">
            <span>Totale</span>
            <strong>{fmtMinutes(totalMinutes)}</strong>
          </div>
        </div>

        {filteredRows.length ? (
          <>
            <div className="historyDesktopTable">
              <div className="tableWrap historyTableWrap">
                <table className="historyTable">
                  <thead>
                    <tr>
                      <th>Data</th>
                      {isAdmin && <th>Reparto</th>}
                      {isAdmin && <th>Dipendente</th>}
                      <th>Orario</th>
                      <th>Durata</th>
                      <th>Commessa</th>
                      <th>Lavorazione</th>
                      <th>Note</th>
                      {isAdmin && <th className="actionsCell">Azioni</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const dateParts = compactDate(r.work_date);
                      return (
                        <tr
                          key={r.id}
                          className="timesheetRowClickable historyTableRow"
                          onClick={() => setEditRow(r)}
                          title="Clicca per aprire il dettaglio"
                        >
                          <td>
                            <div className="historyDateCell">
                              <strong>{dateParts.day}</strong>
                              <span>{dateParts.month}</span>
                            </div>
                          </td>
                          {isAdmin && <td><span className="historyDepartmentTag">{DEPARTMENT_LABELS[r.department] || r.department || '—'}</span></td>}
                          {isAdmin && <td><strong className="historyEmployeeName">{r.employees?.full_name || '—'}</strong></td>}
                          <td>
                            <div className="historyTimeCell">
                              <span>{String(r.start_time || '').slice(0, 5)}</span>
                              <span className="historyTimeArrow">→</span>
                              <span>{String(r.end_time || '').slice(0, 5)}</span>
                            </div>
                          </td>
                          <td><span className="historyDurationBadge">{fmtMinutes(r.minutes || 0)}</span></td>
                          <td>
                            <div className="historyJobCell">
                              {r.cdl?.code && <span>{r.cdl.code}</span>}
                              <strong>{r.cdl?.name || 'Nessuna commessa'}</strong>
                            </div>
                          </td>
                          <td><span className="historyWorkTag">{r.lavorazioni?.name || '—'}</span></td>
                          <td><div className="historyNoteCell" title={r.note || ''}>{r.note || '—'}</div></td>
                          {isAdmin && (
                            <td className="actionsCell" onClick={(e) => e.stopPropagation()}>
                              <div className="historyRowActions">
                                <button className="btn btnSmall historyIconAction" onClick={() => setEditRow(r)} title="Modifica">
                                  <Icon name="edit" size={16} />
                                </button>
                                <button className="btn btnSmall btnDanger historyIconAction" onClick={() => onDelete(r)} title="Elimina">
                                  <Icon name="trash" size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="historyMobileList">
              {filteredRows.map((r) => {
                const dateParts = compactDate(r.work_date);
                return (
                  <button key={r.id} type="button" className="historyMobileCard" onClick={() => setEditRow(r)}>
                    <div className="historyMobileDate">
                      <strong>{dateParts.day}</strong>
                      <span>{dateParts.month}</span>
                    </div>
                    <div className="historyMobileMain">
                      <div className="historyMobileTopline">
                        <strong>{r.cdl?.code ? `${r.cdl.code} · ${r.cdl?.name || ''}` : r.cdl?.name || 'Nessuna commessa'}</strong>
                        <span>{fmtMinutes(r.minutes || 0)}</span>
                      </div>
                      {isAdmin && <div className="historyMobileEmployee">{r.employees?.full_name || '—'} · {DEPARTMENT_LABELS[r.department] || r.department || '—'}</div>}
                      <div className="historyMobileMeta">
                        <span>{String(r.start_time || '').slice(0, 5)} → {String(r.end_time || '').slice(0, 5)}</span>
                        <span>{r.lavorazioni?.name || '—'}</span>
                      </div>
                      {r.note && <p>{r.note}</p>}
                    </div>
                    <span className="historyMobileChevron"><Icon name="chevron" size={17} /></span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="historyEmptyState">
            <div className="historyEmptyIcon"><Icon name="search" size={24} /></div>
            <strong>Nessun timesheet trovato</strong>
            <p>Prova a cambiare intervallo, dipendente oppure testo di ricerca.</p>
          </div>
        )}
      </section>

      <TimesheetEditModal
        open={!!editRow}
        row={editRow}
        employees={employees}
        cdl={cdl}
        lavorazioni={lavorazioni}
        onClose={() => setEditRow(null)}
        onSave={onSaveEdit}
      />
    </div>
  );
}
