import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { DEPARTMENT_LABELS } from '../../lib/access';

function fmtMinutes(value = 0) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function DonutChart({ data, total }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donutWrap">
      <svg className="donutChart" viewBox="0 0 140 140" role="img" aria-label="Ripartizione ore per reparto">
        <circle className="donutTrack" cx="70" cy="70" r={radius} />
        {data.map((item, index) => {
          const share = total ? item.minutes / total : 0;
          const dash = share * circumference;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={item.label}
              className={`donutSegment donutSegment${index + 1}`}
              cx="70"
              cy="70"
              r={radius}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
            />
          );
        })}
      </svg>
      <div className="donutCenter"><strong>{Math.round(total / 60)}</strong><span>ore totali</span></div>
    </div>
  );
}

function FlowChart({ data }) {
  const width = 760;
  const height = 230;
  const max = Math.max(...data.map((item) => item.minutes), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : 20 + index * ((width - 40) / (data.length - 1));
    const y = height - 30 - (item.minutes / max) * (height - 70);
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `20,${height - 30} ${line} ${width - 20},${height - 30}`;

  return (
    <div className="flowChartScroll">
      <svg className="flowChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Andamento delle ore giornaliere">
        <defs>
          <linearGradient id="flowArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((lineIndex) => (
          <line key={lineIndex} className="chartGridLine" x1="20" x2={width - 20} y1={35 + lineIndex * 48} y2={35 + lineIndex * 48} />
        ))}
        <polygon className="flowArea" points={area} />
        <polyline className="flowLine" points={line} />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="flowPoint" cx={point.x} cy={point.y} r="5" />
            <text className="flowLabel" x={point.x} y={height - 8} textAnchor="middle">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
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
        supabase.from('timesheets').select(`id, minutes, work_date, employee_id, department, cdl_id, employees(full_name), cdl(code, name)`).gte('work_date', from).lte('work_date', to),
        supabase.from('profiles').select('user_id, role, department, is_active'),
        supabase.from('employees').select('id, department, is_active'),
      ]);
      if (timesheetsRes.error) throw timesheetsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (employeesRes.error) throw employeesRes.error;
      setRows(timesheetsRes.data || []);
      setProfiles(profilesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error(error);
      setErr(error?.message || 'Errore dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalMinutes = useMemo(() => rows.reduce((sum, row) => sum + (row.minutes || 0), 0), [rows]);
  const activeUsers = profiles.filter((item) => item.is_active !== false);
  const activeEmployees = employees.filter((item) => item.is_active !== false);

  const byDepartment = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.department || 'non_assegnato';
      const current = map.get(key) || { label: DEPARTMENT_LABELS[key] || 'Non assegnato', minutes: 0, rows: 0 };
      current.minutes += row.minutes || 0;
      current.rows += 1;
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [rows]);

  const byDay = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => map.set(row.work_date, (map.get(row.work_date) || 0) + (row.minutes || 0)));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, minutes]) => ({ label: dayjs(date).format('DD/MM'), minutes }));
  }, [rows]);

  const ranking = (field, labelGetter) => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row[field] || 'none';
      const current = map.get(key) || { label: labelGetter(row), minutes: 0 };
      current.minutes += row.minutes || 0;
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  };

  const byCdl = useMemo(() => ranking('cdl_id', (row) => `${row.cdl?.code ? `${row.cdl.code} — ` : ''}${row.cdl?.name || 'Senza commessa'}`), [rows]);
  const byEmp = useMemo(() => ranking('employee_id', (row) => row.employees?.full_name || 'Non assegnato'), [rows]);
  const averageMinutes = rows.length ? Math.round(totalMinutes / rows.length) : 0;
  const topDepartment = byDepartment[0];

  return (
    <div className="adminPage adminDashboardPage">
      <header className="adminHero adminHeroRefined">
        <div className="adminHeroCopy">
          <span className="adminEyebrow">Analytics hub</span>
          <h1 className="adminHeroTitle">Insight operativi</h1>
          <p className="adminHeroSubtitle">Una panoramica elegante di ore, persone, commesse e andamento del lavoro.</p>
        </div>
        <div className="adminHeroBadge">
          <span>Periodo analizzato</span>
          <strong>{dayjs(from).format('DD MMM')} – {dayjs(to).format('DD MMM YYYY')}</strong>
        </div>
      </header>

      <section className="adminFilterBar">
        <div className="formGroup"><label>Dal</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="formGroup"><label>Al</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn btnPrimary" onClick={load} disabled={loading}>{loading ? 'Aggiornamento…' : 'Aggiorna dashboard'}</button>
      </section>

      {err && <div className="toast err">{err}</div>}

      <section className="adminKpiGrid">
        <article className="adminKpi adminKpiPurple"><span>Tempo registrato</span><strong>{fmtMinutes(totalMinutes)}</strong><small>{rows.length} attività nel periodo</small></article>
        <article className="adminKpi adminKpiCyan"><span>Media per attività</span><strong>{fmtMinutes(averageMinutes)}</strong><small>Durata media di ogni riga</small></article>
        <article className="adminKpi adminKpiGreen"><span>Utenti attivi</span><strong>{activeUsers.length}</strong><small>{activeEmployees.length} dipendenti operativi</small></article>
        <article className="adminKpi adminKpiOrange"><span>Reparto principale</span><strong>{topDepartment?.label || '—'}</strong><small>{topDepartment ? fmtMinutes(topDepartment.minutes) : 'Nessun dato'}</small></article>
      </section>

      <section className="adminChartGrid">
        <article className="adminPanel adminPanelWide"><div className="adminPanelHead"><div><span className="adminPanelEyebrow">Flusso operativo</span><h2>Andamento ore giornaliere</h2></div><span className="adminMiniBadge">Ultimi 14 giorni con dati</span></div>{byDay.length ? <FlowChart data={byDay} /> : <div className="adminEmpty">Nessun dato disponibile nel periodo.</div>}</article>
        <article className="adminPanel"><div className="adminPanelHead"><div><span className="adminPanelEyebrow">Distribuzione</span><h2>Ore per reparto</h2></div></div>{byDepartment.length ? <><DonutChart data={byDepartment} total={totalMinutes} /><div className="chartLegend">{byDepartment.map((item, index) => <div key={item.label}><i className={`legendDot legendDot${index + 1}`} /><span>{item.label}</span><strong>{Math.round((item.minutes / totalMinutes) * 100)}%</strong></div>)}</div></> : <div className="adminEmpty">Nessun dato.</div>}</article>
      </section>

      <section className="adminRankingGrid">
        <article className="adminPanel"><div className="adminPanelHead"><div><span className="adminPanelEyebrow">Performance</span><h2>Top commesse</h2></div></div><div className="rankingList">{byCdl.map((item, index) => <div className="rankingRow" key={`${item.label}-${index}`}><span className="rankingIndex">{index + 1}</span><div><strong>{item.label}</strong><div className="rankingBar"><i style={{ width: `${Math.max(8, (item.minutes / (byCdl[0]?.minutes || 1)) * 100)}%` }} /></div></div><b>{fmtMinutes(item.minutes)}</b></div>)}</div></article>
        <article className="adminPanel"><div className="adminPanelHead"><div><span className="adminPanelEyebrow">Persone</span><h2>Top dipendenti</h2></div></div><div className="rankingList">{byEmp.map((item, index) => <div className="rankingRow" key={`${item.label}-${index}`}><span className="rankingIndex">{index + 1}</span><div><strong>{item.label}</strong><div className="rankingBar alt"><i style={{ width: `${Math.max(8, (item.minutes / (byEmp[0]?.minutes || 1)) * 100)}%` }} /></div></div><b>{fmtMinutes(item.minutes)}</b></div>)}</div></article>
      </section>
    </div>
  );
}
