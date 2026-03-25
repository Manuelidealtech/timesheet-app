import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "../../lib/supabase";

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export default function AdminDashboard() {
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .select(`
          id,
          minutes,
          work_date,
          employee_id,
          cdl_id,
          employees(full_name),
          cdl(code, name)
        `)
        .gte("work_date", from)
        .lte("work_date", to);

      if (error) throw error;
      setRows(data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const totalMinutes = useMemo(() => rows.reduce((a, r) => a + (r.minutes || 0), 0), [rows]);
  const totalRows = rows.length;

  const byCdl = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.cdl_id;
      const label = `${r.cdl?.code ? r.cdl.code + " — " : ""}${r.cdl?.name || "—"}`;
      const prev = map.get(key) || { label, minutes: 0 };
      prev.minutes += r.minutes || 0;
      map.set(key, prev);
    }
    return [...map.values()].sort((a,b)=>b.minutes-a.minutes).slice(0,5);
  }, [rows]);

  const byEmp = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.employee_id;
      const label = r.employees?.full_name || "—";
      const prev = map.get(key) || { label, minutes: 0 };
      prev.minutes += r.minutes || 0;
      map.set(key, prev);
    }
    return [...map.values()].sort((a,b)=>b.minutes-a.minutes).slice(0,5);
  }, [rows]);

  return (
    <div className="container">
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Dashboard</h1>
          <p className="sub">Riepilogo rapido ore nel periodo selezionato</p>
        </div>
        <span className="badge">Dashboard</span>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems:"flex-end" }}>
          <div className="formGroup">
            <label>Dal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div className="formGroup">
            <label>Al</label>
            <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>

          <button className="btn btnPrimary" onClick={load} disabled={loading}>
            {loading ? "Carico..." : "Aggiorna"}
          </button>
        </div>

        <hr className="sep" />

        {err && <div className="toast err">{err}</div>}

        <div className="grid2">
          <div className="kpi">
            <div className="label">Tempo totale</div>
            <div className="value">{fmtMinutes(totalMinutes)}</div>
          </div>
          <div className="kpi">
            <div className="label">Righe timesheet</div>
            <div className="value">{totalRows}</div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="label">Top commesse</div>
            <div style={{ marginTop: 8, display:"grid", gap:8 }}>
              {byCdl.length ? byCdl.map((x, i)=>(
                <div key={i} className="row" style={{ justifyContent:"space-between" }}>
                  <span className="sub" style={{ maxWidth: 360 }}>{x.label}</span>
                  <span className="pill ok">{fmtMinutes(x.minutes)}</span>
                </div>
              )) : <div className="sub">Nessun dato nel periodo.</div>}
            </div>
          </div>

          <div className="kpi">
            <div className="label">Top dipendenti</div>
            <div style={{ marginTop: 8, display:"grid", gap:8 }}>
              {byEmp.length ? byEmp.map((x, i)=>(
                <div key={i} className="row" style={{ justifyContent:"space-between" }}>
                  <span className="sub">{x.label}</span>
                  <span className="pill ok">{fmtMinutes(x.minutes)}</span>
                </div>
              )) : <div className="sub">Nessun dato nel periodo.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}