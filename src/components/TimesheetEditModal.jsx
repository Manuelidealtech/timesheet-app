import React, { useMemo, useState } from "react";
import dayjs from "dayjs";

function minutesDiff(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

export default function TimesheetEditModal({
  open,
  onClose,
  row,
  cdl,
  lavorazioni,
  onSave
}) {
  const [workDate, setWorkDate] = useState(row?.work_date || dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState(String(row?.start_time || "08:30").slice(0,5));
  const [endTime, setEndTime] = useState(String(row?.end_time || "09:00").slice(0,5));
  const [cdlId, setCdlId] = useState(String(row?.cdl?.id ?? row?.cdl_id ?? ""));
  const [lavId, setLavId] = useState(String(row?.lavorazioni?.id ?? row?.lavorazione_id ?? ""));
  const [note, setNote] = useState(row?.note || "");
  const [err, setErr] = useState("");

  const previewMinutes = useMemo(() => minutesDiff(startTime, endTime), [startTime, endTime]);

  // quando cambia la row (apri su record diverso) resettiamo lo state
  React.useEffect(() => {
    if (!row) return;
    setWorkDate(row.work_date);
    setStartTime(String(row.start_time).slice(0,5));
    setEndTime(String(row.end_time).slice(0,5));
    setCdlId(String(row.cdl?.id ?? row.cdl_id ?? ""));
    setLavId(String(row.lavorazioni?.id ?? row.lavorazione_id ?? ""));
    setNote(row.note || "");
    setErr("");
  }, [row]);

  if (!open) return null;

  async function handleSave() {
    setErr("");
    if (!workDate) return setErr("Seleziona la data.");
    if (!startTime || !endTime) return setErr("Orari non validi.");
    if (previewMinutes <= 0) return setErr("'Alle' deve essere dopo 'Dalle'.");
    if (!cdlId) return setErr("Seleziona una commessa.");
    if (!lavId) return setErr("Seleziona una lavorazione.");

    await onSave({
      work_date: workDate,
      start_time: startTime,
      end_time: endTime,
      cdl_id: Number(cdlId),
      lavorazione_id: Number(lavId),
      note: note?.trim() || null
    });
  }

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cardHeader">
          <div>
            <div className="sub">Modifica Timesheet</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>
              {row?.employees?.full_name || "—"}
            </div>
          </div>
          <button className="btn" onClick={onClose}>Chiudi</button>
        </div>

        <hr className="sep" />

        <div className="grid">
          <div className="grid3">
            <div className="formGroup">
              <label>Data</label>
              <input type="date" value={workDate} onChange={(e)=>setWorkDate(e.target.value)} />
            </div>
            <div className="formGroup">
              <label>Dalle</label>
              <input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} />
            </div>
            <div className="formGroup">
              <label>Alle</label>
              <input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid2">
            <div className="formGroup">
              <label>Commessa / CDL</label>
              <select value={cdlId} onChange={(e)=>setCdlId(e.target.value)}>
                <option value="">Seleziona...</option>
                {cdl.map((x)=>(
                  <option key={x.id} value={x.id}>
                    {(x.code ? `${x.code} — ` : "")}{x.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label>Lavorazione</label>
              <select value={lavId} onChange={(e)=>setLavId(e.target.value)}>
                <option value="">Seleziona...</option>
                {lavorazioni.map((x)=>(
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="formGroup">
            <label>Note</label>
            <textarea value={note} onChange={(e)=>setNote(e.target.value)} />
          </div>

          {err && <div className="toast err">{err}</div>}

          <div className="row">
            <span className="pill ok">Totale: {previewMinutes} min</span>
            <div className="spacer" />
            <button className="btn btnPrimary" onClick={handleSave}>Salva modifiche</button>
          </div>
        </div>
      </div>
    </div>
  );
}