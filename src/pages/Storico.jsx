import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { fetchCdl, fetchLavorazioni, updateTimesheet, deleteTimesheet } from '../lib/api';
import TimesheetEditModal from '../components/TimesheetEditModal';
import { DEPARTMENT_LABELS } from '../lib/access';

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, '0')}m`;
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
    () => filteredRows.reduce((acc, r) => acc + (r.minutes || 0), 0),
    [filteredRows]
  );

  async function onDelete(row) {
    if (!isAdmin) return;
    if (!window.confirm('Vuoi eliminare questo timesheet?')) return;

    try {
      setLoading(true);
      await deleteTimesheet(row.id);
      setOk('Eliminato ✅');
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
      setOk('Modificato ✅');
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

  return (
    <div className="container pageShell">
      <section className="pageHero">
        <div className="pageHeader">
          <div className="pageHeaderMain">
            <h1 className="pageTitle">Storico Timesheet</h1>
            <p className="pageSubtitle">
            {isAdmin
              ? 'Vista completa di tutti i timesheet aziendali.'
              : isOffice
                ? 'Qui vedi solo il tuo storico personale.'
                : `Vista limitata al reparto ${DEPARTMENT_LABELS[department]?.toLowerCase() || 'assegnato'}.`}
            <span style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>
              Clicca su una riga per modificarla.
            </span>
          </p>
          </div>
          <span className="badge">Storico</span>
        </div>

        <div className="pageBody">
          <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="formGroup" style={{ minWidth: 240 }}>
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
                <option key={x.id} value={x.id}>
                  {x.full_name}
                </option>
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

          <div className="formGroup" style={{ minWidth: 260 }}>
            <label>Ricerca</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="commessa, lavorazione, note..."
            />
          </div>

          <button className="btn btnPrimary" onClick={load} disabled={loading}>
            {loading ? 'Carico...' : isOffice ? 'Aggiorna' : 'Filtra'}
          </button>

          <div className="spacer" />
          <div className="pill ok">Totale: {fmtMinutes(totalMinutes)}</div>
        </div>

        <hr className="sep" />

        {err && <div className="toast err">{err}</div>}
        {ok && <div className="toast ok">{ok}</div>}

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                {isAdmin && <th>Reparto</th>}
                {isAdmin && <th>Dipendente</th>}
                <th>Dalle</th>
                <th>Alle</th>
                <th>Totale</th>
                <th>Commessa</th>
                <th>Lavorazione</th>
                <th>Note</th>
                {isAdmin && <th className="actionsCell">Azioni</th>}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="timesheetRowClickable"
                  onClick={() => setEditRow(r)}
                  title="Clicca per modificare"
                >
                  <td>{r.work_date}</td>
                  {isAdmin && <td>{DEPARTMENT_LABELS[r.department] || r.department || '—'}</td>}
                  {isAdmin && <td>{r.employees?.full_name || '—'}</td>}
                  <td>{String(r.start_time).slice(0, 5)}</td>
                  <td>{String(r.end_time).slice(0, 5)}</td>
                  <td>{fmtMinutes(r.minutes || 0)}</td>
                  <td>{r.cdl?.code ? `${r.cdl.code} — ` : ''}{r.cdl?.name}</td>
                  <td>{r.lavorazioni?.name}</td>
                  <td className="note" title={r.note || ''}>{r.note}</td>

                  {isAdmin && (
                    <td className="actionsCell" onClick={(e) => e.stopPropagation()}>
                      <button className="btn iconBtn" onClick={() => setEditRow(r)}>
                        Modifica
                      </button>
                      <button className="btn btnDanger iconBtn" onClick={() => onDelete(r)}>
                        Elimina
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {!filteredRows.length && !loading && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 7} style={{ textAlign: 'center', opacity: 0.7, padding: 18 }}>
                    Nessun record con questi filtri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </div>
        </div>
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