import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "../../lib/supabase";

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

function eur(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

export default function AdminRiassunti() {
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  const [cdlId, setCdlId] = useState("");
  const [cdl, setCdl] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);

  async function loadLists() {
    const { data, error } = await supabase
      .from("cdl")
      .select("id, code, name")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    setCdl(data || []);
  }

  async function load() {
    setErr("");
    setLoading(true);
    try {
      let qy = supabase
        .from("timesheets")
        .select(`
          minutes,
          work_date,
          employee_id,
          cdl_id,
          employees(full_name, hourly_cost),
          cdl(code, name)
        `)
        .gte("work_date", from)
        .lte("work_date", to);

      if (cdlId) qy = qy.eq("cdl_id", Number(cdlId));

      const { data, error } = await qy;
      if (error) throw error;

      setRows(data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore caricamento riassunti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadLists();
        await load();
      } catch (e2) {
        setErr(e2?.message || "Errore inizializzazione");
      }
    })();
    // eslint-disable-next-line
  }, []);

  const summaryByCdl = useMemo(() => {
    const map = new Map();

    for (const r of rows) {
      const key = r.cdl_id;
      const label = `${r.cdl?.code ? r.cdl.code + " — " : ""}${r.cdl?.name || "—"}`;
      const prev = map.get(key) || { label, minutes: 0, cost: 0, byEmp: new Map() };

      const minutes = r.minutes || 0;
      const hourly = Number(r.employees?.hourly_cost || 0);
      const cost = (minutes / 60) * hourly;

      prev.minutes += minutes;
      prev.cost += cost;

      const empName = r.employees?.full_name || "—";
      const empPrev = prev.byEmp.get(empName) || { minutes: 0, cost: 0 };
      empPrev.minutes += minutes;
      empPrev.cost += cost;
      prev.byEmp.set(empName, empPrev);

      map.set(key, prev);
    }

    return [...map.values()]
      .map((x) => ({
        ...x,
        byEmpArr: [...x.byEmp.entries()]
          .map(([name, v]) => ({ name, ...v }))
          .sort((a,b)=>b.minutes-a.minutes),
      }))
      .sort((a,b)=>b.minutes-a.minutes);
  }, [rows]);

  const totalMinutes = useMemo(() => rows.reduce((a,r)=>a+(r.minutes||0),0), [rows]);
  const totalCost = useMemo(() => rows.reduce((a,r)=>a+((r.minutes||0)/60)*(Number(r.employees?.hourly_cost||0)),0), [rows]);

  return (
    <div className="container">
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Riassunti</h1>
          <p className="sub">Ore e costo per commessa (usando hourly_cost dei dipendenti)</p>
        </div>
        <span className="badge">Costi</span>
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

          <div className="formGroup" style={{ minWidth: 320 }}>
            <label>Commessa (opzionale)</label>
            <select value={cdlId} onChange={(e)=>setCdlId(e.target.value)}>
              <option value="">Tutte</option>
              {cdl.map((x)=>(
                <option key={x.id} value={x.id}>
                  {(x.code ? `${x.code} — ` : "")}{x.name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btnPrimary" onClick={load} disabled={loading}>
            {loading ? "Carico..." : "Aggiorna"}
          </button>

          <div className="spacer" />
          <span className="pill ok">Totale: {fmtMinutes(totalMinutes)} • {eur(totalCost)}</span>
        </div>

        <hr className="sep" />

        {err && <div className="toast err">{err}</div>}

        <div className="grid" style={{ gap: 12 }}>
          {summaryByCdl.map((c, idx)=>(
            <div key={idx} className="kpi" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent:"space-between" }}>
                <div style={{ fontWeight: 850 }}>{c.label}</div>
                <div className="row">
                  <span className="pill ok">{fmtMinutes(c.minutes)}</span>
                  <span className="pill">{eur(c.cost)}</span>
                </div>
              </div>

              <div style={{ marginTop: 10, display:"grid", gap:8 }}>
                {c.byEmpArr.map((e)=>(
                  <div key={e.name} className="row" style={{ justifyContent:"space-between" }}>
                    <span className="sub">{e.name}</span>
                    <div className="row">
                      <span className="pill ok">{fmtMinutes(e.minutes)}</span>
                      <span className="pill">{eur(e.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!summaryByCdl.length && !loading && (
            <div className="sub">Nessun timesheet nel periodo selezionato.</div>
          )}
        </div>
      </div>
    </div>
  );
}