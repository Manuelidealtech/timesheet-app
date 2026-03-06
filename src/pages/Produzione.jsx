import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  fetchEmployees,
  fetchCdl,
  fetchLavorazioni,
  insertTimesheet,
  fetchTimesheetsLatest,
} from "../lib/api";

function minutesDiff(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return Math.max(0, e - s);
}

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export default function Produzione() {
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [employees, setEmployees] = useState([]);
  const [cdl, setCdl] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);

  const [latest, setLatest] = useState([]);

  // form state
  const [employeeId, setEmployeeId] = useState("");
  const [cdlId, setCdlId] = useState("");
  const [lavId, setLavId] = useState("");

  const [workDate, setWorkDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("09:00");
  const [note, setNote] = useState("");

  const previewMinutes = useMemo(
    () => minutesDiff(startTime, endTime),
    [startTime, endTime]
  );

  const selectedEmployeeName = useMemo(() => {
    const found = employees.find((e) => String(e.id) === String(employeeId));
    return found?.full_name || "";
  }, [employees, employeeId]);

  async function loadLatest(empId) {
    if (!empId) return;
    try {
      setLoadingLatest(true);
      const data = await fetchTimesheetsLatest({ employeeId: empId, limit: 12 });
      setLatest(data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore caricamento ultimi inserimenti");
    } finally {
      setLoadingLatest(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingLists(true);
        setErr("");

        const [e, c, l] = await Promise.all([
          fetchEmployees(),
          fetchCdl(),
          fetchLavorazioni(),
        ]);

        if (!alive) return;

        setEmployees(e);
        setCdl(c);
        setLavorazioni(l);

        // default selections
        const emp = employeeId || (e?.[0] ? String(e[0].id) : "");
        const comm = cdlId || (c?.[0] ? String(c[0].id) : "");
        const lav = lavId || (l?.[0] ? String(l[0].id) : "");

        if (!employeeId && emp) setEmployeeId(emp);
        if (!cdlId && comm) setCdlId(comm);
        if (!lavId && lav) setLavId(lav);

        if (emp) await loadLatest(emp);
      } catch (e2) {
        console.error(e2);
        setErr(e2?.message || "Errore caricamento liste");
      } finally {
        setLoadingLists(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // ogni volta che cambio dipendente, aggiorno la colonna "ultimi inserimenti"
    if (employeeId) loadLatest(employeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!employeeId) return setErr("Seleziona un dipendente.");
    if (!cdlId) return setErr("Seleziona una commessa (CDL).");
    if (!lavId) return setErr("Seleziona una lavorazione.");
    if (!workDate) return setErr("Seleziona la data.");
    if (!startTime || !endTime) return setErr("Inserisci orari validi.");
    if (previewMinutes <= 0) return setErr("L'orario 'Alle' deve essere dopo 'Dalle'.");

    const payload = [{
      employee_id: Number(employeeId),
      cdl_id: Number(cdlId),
      lavorazione_id: Number(lavId),
      work_date: workDate,
      start_time: startTime,
      end_time: endTime,
      note: note?.trim() || null
    }];

    try {
      setSaving(true);
      await insertTimesheet(payload);

      setOk("Salvato ✅");
      setNote("");

      // refresh colonna destra
      await loadLatest(employeeId);

      // piccolo “auto advance” dell’orario: metto start=end e +30min
      setStartTime(endTime);
      const nextEnd = dayjs(`2000-01-01T${endTime}:00`).add(30, "minute").format("HH:mm");
      setEndTime(nextEnd);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore salvataggio");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 2200);
    }
  }

  if (loadingLists) {
    return (
      <div className="container">
        <div className="card">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Produzione</h1>
          <p className="sub">Compilazione timesheet con storico rapido per dipendente</p>
        </div>
        <span className="badge">Compilazione</span>
      </div>

      <div className="split">
        {/* LEFT: FORM */}
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
              <label>Dipendente</label>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                {employees.map((x) => (
                  <option key={x.id} value={x.id}>{x.full_name}</option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label>Commessa / CDL</label>
              <select value={cdlId} onChange={(e) => setCdlId(e.target.value)}>
                {cdl.map((x) => (
                  <option key={x.id} value={x.id}>
                    {(x.code ? `${x.code} — ` : "")}{x.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label>Lavorazione</label>
              <select value={lavId} onChange={(e) => setLavId(e.target.value)}>
                {lavorazioni.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>

            <div className="grid3">
              <div className="formGroup">
                <label>Data</label>
                <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              </div>

              <div className="formGroup">
                <label>Dalle</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>

              <div className="formGroup">
                <label>Alle</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="formGroup">
              <label>Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Scrivi cosa è stato fatto..."
              />
            </div>

            {err && <div className="toast err">{err}</div>}
            {ok && <div className="toast ok">{ok}</div>}

            <div className="row">
              <button className="btn btnPrimary" disabled={saving}>
                {saving ? "Salvataggio..." : "Salva"}
              </button>
              <div className="sub">
                Totale: <b>{fmtMinutes(previewMinutes)}</b>
              </div>
              <div className="spacer" />
              <span className="sub">Suggerimento: dopo il salvataggio ti auto-imposta il prossimo slot</span>
            </div>
          </form>
        </div>

        {/* RIGHT: LATEST */}
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="sub">Ultimi inserimenti</div>
              <div style={{ fontWeight: 750, marginTop: 4 }}>
                {selectedEmployeeName ? selectedEmployeeName : "—"}
              </div>
            </div>
            <span className="badge">Ultimi 12</span>
          </div>

          <hr className="sep" />

          {loadingLatest ? (
            <div className="sub">Caricamento...</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {latest.map((r) => (
                <div key={r.id} className="kpi" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="pill ok">{fmtMinutes(r.minutes || 0)}</span>
                    <span className="sub">{r.work_date}</span>
                  </div>

                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    {String(r.start_time).slice(0, 5)} → {String(r.end_time).slice(0, 5)}
                  </div>

                  <div className="sub" style={{ marginTop: 6 }}>
                    <b>CDL:</b> {(r.cdl?.code ? `${r.cdl.code} — ` : "")}{r.cdl?.name}
                  </div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    <b>Lav:</b> {r.lavorazioni?.name}
                  </div>

                  {r.note && (
                    <div className="sub" style={{ marginTop: 8, opacity: 0.85 }}>
                      {r.note}
                    </div>
                  )}
                </div>
              ))}

              {!latest.length && (
                <div className="sub">Nessun inserimento recente per questo dipendente.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}