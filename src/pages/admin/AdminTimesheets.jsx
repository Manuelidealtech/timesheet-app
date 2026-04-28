import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

function calcMinutes(start, end) {
  if (!start || !end) return 0;

  const startDate = dayjs(`2000-01-01T${start}`);
  const endDate = dayjs(`2000-01-01T${end}`);

  const diff = endDate.diff(startDate, "minute");
  return diff > 0 ? diff : 0;
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
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [err, setErr] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [editForm, setEditForm] = useState({
    employee_id: "",
    work_date: "",
    start_time: "",
    end_time: "",
    cdl_id: "",
    lavorazione_id: "",
    note: "",
  });

  async function loadLists() {
    const [e, c, l] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name"),

      supabase
        .from("cdl")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("lavorazioni")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
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
        r.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return s.includes(needle);
    });
  }, [rows, q]);

  const totalMinutes = useMemo(
    () => filtered.reduce((a, r) => a + (r.minutes || 0), 0),
    [filtered]
  );

  function openEditModal(row) {
    setErr("");
    setEditRow(row);

    setEditForm({
      employee_id: row.employee_id ? String(row.employee_id) : "",
      work_date: row.work_date || "",
      start_time: row.start_time ? String(row.start_time).slice(0, 5) : "",
      end_time: row.end_time ? String(row.end_time).slice(0, 5) : "",
      cdl_id: row.cdl_id ? String(row.cdl_id) : "",
      lavorazione_id: row.lavorazione_id ? String(row.lavorazione_id) : "",
      note: row.note || "",
    });

    setEditOpen(true);
  }

  function closeEditModal() {
    if (saving) return;

    setEditOpen(false);
    setEditRow(null);

    setEditForm({
      employee_id: "",
      work_date: "",
      start_time: "",
      end_time: "",
      cdl_id: "",
      lavorazione_id: "",
      note: "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();

    if (!editRow) return;

    setErr("");

    if (!editForm.employee_id) {
      setErr("Seleziona un dipendente.");
      return;
    }

    if (!editForm.work_date) {
      setErr("Inserisci la data.");
      return;
    }

    if (!editForm.start_time || !editForm.end_time) {
      setErr("Inserisci ora di inizio e ora di fine.");
      return;
    }

    const minutes = calcMinutes(editForm.start_time, editForm.end_time);

    if (minutes <= 0) {
      setErr("L'orario di fine deve essere successivo all'orario di inizio.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        employee_id: Number(editForm.employee_id),
        work_date: editForm.work_date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        cdl_id: editForm.cdl_id ? Number(editForm.cdl_id) : null,
        lavorazione_id: editForm.lavorazione_id ? Number(editForm.lavorazione_id) : null,
        note: editForm.note?.trim() || null,
      };

      const { error } = await supabase
        .from("timesheets")
        .update(payload)
        .eq("id", editRow.id);

      if (error) throw error;

      await load();
      closeEditModal();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTimesheet(row) {
    setErr("");

    const employeeName = row.employees?.full_name || "questo utente";
    const confirmed = window.confirm(
      `Vuoi davvero eliminare il timesheet di ${employeeName} del ${row.work_date}?\n\nQuesta azione non può essere annullata.`
    );

    if (!confirmed) return;

    setDeletingId(row.id);

    try {
      const { error } = await supabase
        .from("timesheets")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      setRows((prev) => prev.filter((x) => x.id !== row.id));
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore durante l'eliminazione");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Tutti i Timesheet</h1>
          <p className="sub">
            Filtri per dipendente / periodo / commessa / lavorazione + ricerca testuale
          </p>
        </div>

        <div className="row">
          <button className="btn" onClick={() => nav(-1)}>
            ← Indietro
          </button>
          <span className="badge">Filtri</span>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="formGroup" style={{ minWidth: 240 }}>
            <label>Dipendente</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Tutti</option>
              {employees.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="formGroup" style={{ minWidth: 260 }}>
            <label>Commessa (CDL)</label>
            <select value={cdlId} onChange={(e) => setCdlId(e.target.value)}>
              <option value="">Tutte</option>
              {cdl.map((x) => (
                <option key={x.id} value={x.id}>
                  {(x.code ? `${x.code} — ` : "")}
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="formGroup" style={{ minWidth: 220 }}>
            <label>Lavorazione</label>
            <select value={lavId} onChange={(e) => setLavId(e.target.value)}>
              <option value="">Tutte</option>
              {lavorazioni.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
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

          <div className="formGroup" style={{ minWidth: 240 }}>
            <label>Ricerca</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="note, commessa, nome..."
            />
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
                <th style={{ textAlign: "right" }}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.work_date}</td>
                  <td>{r.employees?.full_name}</td>
                  <td>{String(r.start_time).slice(0, 5)}</td>
                  <td>{String(r.end_time).slice(0, 5)}</td>
                  <td>{fmtMinutes(r.minutes || 0)}</td>
                  <td>
                    {(r.cdl?.code ? `${r.cdl.code} — ` : "")}
                    {r.cdl?.name}
                  </td>
                  <td>{r.lavorazioni?.name}</td>
                  <td className="note" title={r.note || ""}>
                    {r.note}
                  </td>
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                      <button
                        className="btn btnSmall"
                        type="button"
                        onClick={() => openEditModal(r)}
                        disabled={deletingId === r.id}
                      >
                        Modifica
                      </button>

                      <button
                        className="btn btnSmall btnDanger"
                        type="button"
                        onClick={() => deleteTimesheet(r)}
                        disabled={deletingId === r.id}
                      >
                        {deletingId === r.id ? "Elimino..." : "Elimina"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filtered.length && !loading && (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", opacity: 0.7, padding: 18 }}>
                    Nessun record con questi filtri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editOpen && (
        <div className="modalOverlay" onMouseDown={closeEditModal}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cardHeader" style={{ marginBottom: 14 }}>
              <div>
                <h2 className="h2">Modifica timesheet</h2>
                <p className="sub">Aggiorna i dati inseriti dall’utente</p>
              </div>

              <button className="btn" type="button" onClick={closeEditModal} disabled={saving}>
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit}>
              <div className="adminTimesheetEditGrid">
                <div className="formGroup">
                  <label>Dipendente</label>
                  <select
                    value={editForm.employee_id}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, employee_id: e.target.value }))
                    }
                  >
                    <option value="">Seleziona dipendente</option>
                    {employees.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formGroup">
                  <label>Data</label>
                  <input
                    type="date"
                    value={editForm.work_date}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, work_date: e.target.value }))
                    }
                  />
                </div>

                <div className="formGroup">
                  <label>Ora inizio</label>
                  <input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, start_time: e.target.value }))
                    }
                  />
                </div>

                <div className="formGroup">
                  <label>Ora fine</label>
                  <input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, end_time: e.target.value }))
                    }
                  />
                </div>

                <div className="formGroup">
                  <label>Commessa</label>
                  <select
                    value={editForm.cdl_id}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, cdl_id: e.target.value }))
                    }
                  >
                    <option value="">Nessuna commessa</option>
                    {cdl.map((x) => (
                      <option key={x.id} value={x.id}>
                        {(x.code ? `${x.code} — ` : "")}
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formGroup">
                  <label>Lavorazione</label>
                  <select
                    value={editForm.lavorazione_id}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, lavorazione_id: e.target.value }))
                    }
                  >
                    <option value="">Nessuna lavorazione</option>
                    {lavorazioni.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="formGroup" style={{ marginTop: 14 }}>
                <label>Note</label>
                <textarea
                  rows="4"
                  value={editForm.note}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, note: e.target.value }))
                  }
                  placeholder="Descrizione attività..."
                />
              </div>

              <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
                <span className="pill ok">
                  Totale: {fmtMinutes(calcMinutes(editForm.start_time, editForm.end_time))}
                </span>

                <div className="row">
                  <button className="btn" type="button" onClick={closeEditModal} disabled={saving}>
                    Annulla
                  </button>

                  <button className="btn btnPrimary" type="submit" disabled={saving}>
                    {saving ? "Salvataggio..." : "Salva modifiche"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}