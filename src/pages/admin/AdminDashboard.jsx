import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { DEPARTMENT_LABELS } from '../../lib/access';

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, '0')}m`;
}

export default function AdminDashboard() {
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [employees, setEmployees] = useState([]);

  async function load() {
    setErr('');
    setLoading(true);
    try {
      const [timesheetsRes, profilesRes, employeesRes] = await Promise.all([
        supabase
          .from('timesheets')
          .select(`
            id,
            minutes,
            work_date,
            employee_id,
            department,
            cdl_id,
            employees(full_name),
            cdl(code, name)
          `)
          .gte('work_date', from)
          .lte('work_date', to),
        supabase.from('profiles').select('user_id, role, department, is_active'),
        supabase.from('employees').select('id, department, is_active'),
      ]);

      if (timesheetsRes.error) throw timesheetsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setRows(timesheetsRes.data || []);
      setProfiles(profilesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'Errore dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalMinutes = useMemo(() => rows.reduce((a, r) => a + (r.minutes || 0), 0), [rows]);
  const totalRows = rows.length;

  const byDepartment = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.department || 'non_assegnato';
      const prev = map.get(key) || { label: DEPARTMENT_LABELS[key] || 'Non assegnato', minutes: 0, rows: 0 };
      prev.minutes += row.minutes || 0;
      prev.rows += 1;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [rows]);

  const byCdl = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.cdl_id || 'none';
      const label = `${row.cdl?.code ? `${row.cdl.code} — ` : ''}${row.cdl?.name || '—'}`;
      const prev = map.get(key) || { label, minutes: 0 };
      prev.minutes += row.minutes || 0;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  }, [rows]);

  const byEmp = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.employee_id || 'none';
      const label = row.employees?.full_name || '—';
      const prev = map.get(key) || { label, minutes: 0 };
      prev.minutes += row.minutes || 0;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  }, [rows]);

  const activeUsers = profiles.filter((item) => item.is_active !== false);
  const activeEmployees = employees.filter((item) => item.is_active !== false);
  const officeUsers = activeUsers.filter((item) => item.department === 'ufficio').length;
  const productionUsers = activeUsers.filter((item) => item.department === 'produzione').length;

  return (
    <div>
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Dashboard</h1>
          <p className="sub">Vista complessiva di timesheet, utenti e reparti nel periodo selezionato</p>
        </div>
        <span className="badge">Dashboard</span>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="formGroup">
            <label>Dal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="formGroup">
            <label>Al</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn btnPrimary" onClick={load} disabled={loading}>
            {loading ? 'Carico...' : 'Aggiorna'}
          </button>
        </div>

        <hr className="sep" />
        {err && <div className="toast err">{err}</div>}

        <div className="grid2">
          <div className="kpi"><div className="label">Tempo totale</div><div className="value">{fmtMinutes(totalMinutes)}</div></div>
          <div className="kpi"><div className="label">Righe timesheet</div><div className="value">{totalRows}</div></div>
          <div className="kpi"><div className="label">Utenti attivi</div><div className="value">{activeUsers.length}</div></div>
          <div className="kpi"><div className="label">Dipendenti attivi</div><div className="value">{activeEmployees.length}</div></div>
        </div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="label">Ripartizione utenti</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="sub">Produzione</span><span className="pill ok">{productionUsers}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="sub">Ufficio</span><span className="pill ok">{officeUsers}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="sub">Admin</span><span className="pill ok">{activeUsers.filter((item) => item.role === 'admin').length}</span></div>
            </div>
          </div>

          <div className="kpi">
            <div className="label">Ore per reparto</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {byDepartment.length ? byDepartment.map((item) => (
                <div key={item.label} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="sub">{item.label}</span>
                  <span className="pill ok">{fmtMinutes(item.minutes)}</span>
                </div>
              )) : <div className="sub">Nessun dato nel periodo.</div>}
            </div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="label">Top commesse</div>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {byCdl.length ? byCdl.map((item, index) => (
                <div key={`${item.label}-${index}`} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="sub" style={{ maxWidth: 360 }}>{item.label}</span>
                  <span className="pill ok">{fmtMinutes(item.minutes)}</span>
                </div>
              )) : <div className="sub">Nessun dato nel periodo.</div>}
            </div>
          </div>

          <div className="kpi">
            <div className="label">Top dipendenti</div>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {byEmp.length ? byEmp.map((item, index) => (
                <div key={`${item.label}-${index}`} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="sub">{item.label}</span>
                  <span className="pill ok">{fmtMinutes(item.minutes)}</span>
                </div>
              )) : <div className="sub">Nessun dato nel periodo.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
