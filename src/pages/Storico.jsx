import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../auth/AuthProvider";
import {
  fetchEmployees,
  fetchCdl,
  fetchLavorazioni,
  fetchTimesheets,
  updateTimesheet,
  deleteTimesheet,
} from "../lib/api";
import TimesheetEditModal from "../components/TimesheetEditModal";

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export default function Storico() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [employees, setEmployees] = useState([]);
  const [cdl, setCdl] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);

  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [q, setQ] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [editRow, setEditRow] = useState(null);

  async function loadAllLists() {
    const [e, c, l] = await Promise.all([
      fetchEmployees(),
      fetchCdl(),
      fetchLavorazioni(),
    ]);

    setEmployees(e || []);
    setCdl(c || []);
    setLavorazioni(l || []);

    if (!employeeId && e?.[0]) {
      setEmployeeId(String(e[0].id));
    }
  }

  async function load() {
    setErr("");
    setOk("");

    try {
      setLoading(true);
      const data = await fetchTimesheets({ employeeId, from, to });
      setRows(data || []);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore caricamento storico");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllLists().catch((e2) => setErr(e2?.message || "Errore liste"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (employeeId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const filteredRows = useMemo(() => {
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
    () => filteredRows.reduce((acc, r) => acc + (r.minutes || 0), 0),
    [filteredRows]
  );

  function openEdit(row) {
    setEditRow(row);
  }

  async function onDelete(row) {
    if (!isAdmin) return;

    const yes = window.confirm("Vuoi eliminare questo timesheet?");
    if (!yes) return;

    try {
      setLoading(true);
      await deleteTimesheet(row.id);
      setOk("Eliminato ✅");
      await load();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore eliminazione");
    } finally {
      setLoading(false);
      setTimeout(() => setOk(""), 2200);
    }
  }

  async function onSaveEdit(patch) {
    try {
      setLoading(true);
      setErr("");
      setOk("");

      await updateTimesheet(editRow.id, patch);

      setOk("Modificato ✅");
      setEditRow(null);
      await load();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore modifica");
    } finally {
      setLoading(false);
      setTimeout(() => setOk(""), 2200);
    }
  }

  return (
    <div>
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Storico Timesheet</h1>
          <p className="sub">
            Filtra per dipendente e periodo, ricerca testo libera.
            <span style={{ display: "block", marginTop: 4, opacity: 0.8 }}>
              Clicca su una riga per modificarla.
            </span>
          </p>
        </div>
        <span className="badge">Storico</span>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="formGroup" style={{ minWidth: 240 }}>
            <label>Dipendente</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
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
            {loading ? "Carico..." : "Filtra"}
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
                  onClick={() => openEdit(r)}
                  title="Clicca per modificare"
                >
                  <td>{r.work_date}</td>
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

                  {isAdmin && (
                    <td
                      className="actionsCell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="btn iconBtn" onClick={() => openEdit(r)}>
                        Modifica
                      </button>
                      <button
                        className="btn btnDanger iconBtn"
                        onClick={() => onDelete(r)}
                      >
                        Elimina
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {!filteredRows.length && !loading && (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    style={{ textAlign: "center", opacity: 0.7, padding: 18 }}
                  >
                    Nessun record nel periodo / filtro selezionato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TimesheetEditModal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        row={editRow}
        cdl={cdl}
        lavorazioni={lavorazioni}
        onSave={onSaveEdit}
      />
    </div>
  );
}