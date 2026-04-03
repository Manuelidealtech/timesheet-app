import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export default function AdminTimesheets() {
  const nav = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [cdl, setCdl] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);

  const [employeeId, setEmployeeId] = useState("");
  const [cdlId, setCdlId] = useState("");
  const [lavId, setLavId] = useState("");

  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [q, setQ] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadLists() {
    const [e, c, l] = await Promise.all([
      supabase.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
      supabase.from("cdl").select("id, code, name").eq("is_active", true).order("name"),
      supabase.from("lavorazioni").select("id, name").eq("is_active", true).order("name"),
    ]);
    if (e.error) throw e.error;
    if (c.error) throw c.error;
    if (l.error) throw l.error;
    setEmployees(e.data || []);
    setCdl(c.data || []);
    setLavorazioni(l.data || []);
  }

  async function load() {
    setErr("");
    setLoading(true);
    try {
      let qy = supabase
        .from("timesheets")
        .select(`
          id,
          work_date,
          start_time,
          end_time,
          minutes,
          note,
          employee_id,
          cdl_id,
          lavorazione_id,
          employees(full_name),
          cdl(id, code, name),
          lavorazioni(id, name)
        `)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (employeeId) qy = qy.eq("employee_id", Number(employeeId));
      if (cdlId) qy = qy.eq("cdl_id", Number(cdlId));
      if (lavId) qy = qy.eq("lavorazione_id", Number(lavId));

      const { data, error } = await qy;
      if (error) throw error;

      setRows(data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore caricamento");
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const s = [
        r.work_date,
        r.employees?.full_name,
        r.cdl?.code,
        r.cdl?.name,
        r.lavorazioni?.name,
        r.note
      ].filter(Boolean).join(" ").toLowerCase();
      return s.includes(needle);
    });
  }, [rows, q]);

  const totalMinutes = useMemo(
    () => filtered.reduce((a, r) => a + (r.minutes || 0), 0),
    [filtered]
  );

  return (
    <div>
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Tutti i Timesheet</h1>
          <p className="sub">Filtri per dipendente / periodo / commessa / lavorazione + ricerca testuale</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => nav(-1)}>← Indietro</button>
          <span className="badge">Filtri</span>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems:"flex-end" }}>
          <div className="formGroup" style={{ minWidth: 240 }}>
            <label>Dipendente</label>
            <select value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)}>
              <option value="">Tutti</option>
              {employees.map((x)=>(
                <option key={x.id} value={x.id}>{x.full_name}</option>
              ))}
            </select>
          </div>

          <div className="formGroup" style={{ minWidth: 260 }}>
            <label>Commessa (CDL)</label>
            <select value={cdlId} onChange={(e)=>setCdlId(e.target.value)}>
              <option value="">Tutte</option>
              {cdl.map((x)=>(
                <option key={x.id} value={x.id}>
                  {(x.code ? `${x.code} — ` : "")}{x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="formGroup" style={{ minWidth: 220 }}>
            <label>Lavorazione</label>
            <select value={lavId} onChange={(e)=>setLavId(e.target.value)}>
              <option value="">Tutte</option>
              {lavorazioni.map((x)=>(
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>

          <div className="formGroup">
            <label>Dal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>

          <div className="formGroup">
            <label>Al</label>
            <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>

          <div className="formGroup" style={{ minWidth: 240 }}>
            <label>Ricerca</label>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="note, commessa, nome..." />
          </div>

          <button className="btn btnPrimary" onClick={load} disabled={loading}>
            {loading ? "Carico..." : "Applica"}
          </button>

          <div className="spacer" />
          <span className="pill ok">Totale: {fmtMinutes(totalMinutes)}</span>
        </div>

        <hr className="sep" />

        {err && <div className="toast err">{err}</div>}

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dipendente</th>
                <th>Dalle</th>
                <th>Alle</th>
                <th>Totale</th>
                <th>Commessa</th>
                <th>Lavorazione</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r)=>(
                <tr key={r.id}>
                  <td>{r.work_date}</td>
                  <td>{r.employees?.full_name}</td>
                  <td>{String(r.start_time).slice(0,5)}</td>
                  <td>{String(r.end_time).slice(0,5)}</td>
                  <td>{fmtMinutes(r.minutes || 0)}</td>
                  <td>{(r.cdl?.code ? `${r.cdl.code} — ` : "")}{r.cdl?.name}</td>
                  <td>{r.lavorazioni?.name}</td>
                  <td className="note" title={r.note || ""}>{r.note}</td>
                </tr>
              ))}

              {!filtered.length && !loading && (
                <tr>
                  <td colSpan="8" style={{ textAlign:"center", opacity:.7, padding:18 }}>
                    Nessun record con questi filtri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}