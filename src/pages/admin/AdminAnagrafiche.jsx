import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="cardHeader">
        <div style={{ fontWeight: 850, fontSize: 18 }}>{title}</div>
      </div>
      <hr className="sep" />
      {children}
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cardHeader">
          <div style={{ fontWeight: 850, fontSize: 18 }}>{title}</div>
          <button className="btn" onClick={onClose}>Chiudi</button>
        </div>
        <hr className="sep" />
        {children}
      </div>
    </div>
  );
}

export default function AdminAnagrafiche() {
  const [tab, setTab] = useState("employees");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [employees, setEmployees] = useState([]);
  const [cdl, setCdl] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);
  const [cdlFilter, setCdlFilter] = useState("all");

  // create forms
  const [empName, setEmpName] = useState("");
  const [empCost, setEmpCost] = useState("0");

  const [cdlCode, setCdlCode] = useState("");
  const [cdlName, setCdlName] = useState("");
  const [cdlClient, setCdlClient] = useState("");

  const [lavName, setLavName] = useState("");

  // edit modal
  const [edit, setEdit] = useState(null); // {table, row}
  const [editFields, setEditFields] = useState({});

  function toast(msg) {
    setOk(msg);
    setTimeout(() => setOk(""), 2200);
  }

  async function loadAll() {
    setErr("");
    const [e, c, l] = await Promise.all([
      supabase.from("employees").select("*").order("full_name"),
      supabase.from("cdl").select("*").order("is_active", { ascending: false }).order("code", { ascending: true }),
      supabase.from("lavorazioni").select("*").order("name"),
    ]);

    if (e.error) throw e.error;
    if (c.error) throw c.error;
    if (l.error) throw l.error;

    setEmployees(e.data || []);
    setCdl(c.data || []);
    setLavorazioni(l.data || []);
  }

  useEffect(() => {
    loadAll().catch((e2) => setErr(e2?.message || "Errore caricamento"));
  }, []);

  // CREATE
  async function addEmployee() {
    setErr("");
    if (!empName.trim()) return setErr("Inserisci il nome del dipendente.");
    const cost = Number(String(empCost).replace(",", "."));
    if (Number.isNaN(cost)) return setErr("Costo orario non valido.");

    const { error } = await supabase.from("employees").insert({
      full_name: empName.trim(),
      hourly_cost: cost,
      is_active: true,
    });

    if (error) return setErr(error.message);
    setEmpName("");
    setEmpCost("0");
    toast("Dipendente aggiunto ✅");
    await loadAll();
  }

  async function addCdl() {
    setErr("");
    if (!cdlName.trim()) return setErr("Inserisci il nome/descrizione commessa.");
    const { error } = await supabase.from("cdl").insert({
      code: cdlCode.trim() || null,
      name: cdlName.trim(),
      client: cdlClient.trim() || null,
      is_active: true,
    });
    if (error) return setErr(error.message);
    setCdlCode(""); setCdlName(""); setCdlClient("");
    toast("Commessa aggiunta ✅");
    await loadAll();
  }

  async function addLav() {
    setErr("");
    if (!lavName.trim()) return setErr("Inserisci il nome lavorazione.");
    const { error } = await supabase.from("lavorazioni").insert({
      name: lavName.trim(),
      is_active: true,
    });
    if (error) return setErr(error.message);
    setLavName("");
    toast("Lavorazione aggiunta ✅");
    await loadAll();
  }

  // TOGGLE ACTIVE
  async function toggle(table, row) {
    setErr("");
    const { error } = await supabase
      .from(table)
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) return setErr(error.message);
    toast("Aggiornato ✅");
    await loadAll();
  }

  // EDIT OPEN
  function openEdit(table, row) {
    setErr("");
    setEdit({ table, row });
    if (table === "employees") {
      setEditFields({
        full_name: row.full_name || "",
        hourly_cost: String(row.hourly_cost ?? 0),
      });
    } else if (table === "cdl") {
      setEditFields({
        code: row.code || "",
        name: row.name || "",
        client: row.client || "",
      });
    } else if (table === "lavorazioni") {
      setEditFields({ name: row.name || "" });
    }
  }

  // EDIT SAVE
  async function saveEdit() {
    if (!edit) return;
    setErr("");

    const { table, row } = edit;

    let patch = {};
    if (table === "employees") {
      if (!editFields.full_name?.trim()) return setErr("Nome dipendente obbligatorio.");
      const cost = Number(String(editFields.hourly_cost).replace(",", "."));
      if (Number.isNaN(cost)) return setErr("Costo orario non valido.");
      patch = { full_name: editFields.full_name.trim(), hourly_cost: cost };
    }
    if (table === "cdl") {
      if (!editFields.name?.trim()) return setErr("Nome commessa obbligatorio.");
      patch = {
        code: editFields.code?.trim() || null,
        name: editFields.name.trim(),
        client: editFields.client?.trim() || null,
      };
    }
    if (table === "lavorazioni") {
      if (!editFields.name?.trim()) return setErr("Nome lavorazione obbligatorio.");
      patch = { name: editFields.name.trim() };
    }

    const { error } = await supabase.from(table).update(patch).eq("id", row.id);
    if (error) return setErr(error.message);

    toast("Modificato ✅");
    setEdit(null);
    await loadAll();
  }

  // DELETE
  async function remove(table, row) {
    setErr("");
    const yes = window.confirm("Confermi eliminazione? (Se è già usato nei timesheet non si potrà eliminare)");
    if (!yes) return;

    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) return setErr(error.message);

    toast("Eliminato ✅");
    await loadAll();
  }

  const filteredCdl = cdl.filter((x) => {
    if (cdlFilter === "active") return x.is_active === true;
    if (cdlFilter === "inactive") return x.is_active === false;
    return true;
  });

  function renderStatusBadge(isActive) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 86,
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 0.2,
        background: isActive ? "rgba(34, 197, 94, 0.14)" : "rgba(239, 68, 68, 0.14)",
        color: isActive ? "#86efac" : "#fca5a5",
        border: isActive ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid rgba(239, 68, 68, 0.35)",
      }}
    >
      {isActive ? "Attiva" : "Chiusa"}
    </span>
  );
}

  return (
    <div>
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Anagrafiche</h1>
          <p className="sub">Gestisci dipendenti, commesse e lavorazioni (CRUD completo)</p>
        </div>
        <span className="badge">Setup</span>
      </div>

      <div className="card">
        <div className="row">
          <button className={`btn ${tab === "employees" ? "btnPrimary" : ""}`} onClick={() => setTab("employees")}>
            Dipendenti
          </button>
          <button className={`btn ${tab === "cdl" ? "btnPrimary" : ""}`} onClick={() => setTab("cdl")}>
            Commesse (CDL)
          </button>
          <button className={`btn ${tab === "lav" ? "btnPrimary" : ""}`} onClick={() => setTab("lav")}>
            Lavorazioni
          </button>
        </div>

        <hr className="sep" />

        {err && <div className="toast err">{err}</div>}
        {ok && <div className="toast ok">{ok}</div>}

        {/* DIPENDENTI */}
        {tab === "employees" && (
          <Section title="Dipendenti">
            <div className="grid2">
              <div className="formGroup">
                <label>Nome e Cognome</label>
                <input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Es: Mario Rossi" />
              </div>
              <div className="formGroup">
                <label>Costo orario (€)</label>
                <input value={empCost} onChange={(e) => setEmpCost(e.target.value)} placeholder="Es: 22" />
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn btnPrimary" onClick={addEmployee}>Aggiungi Dipendente</button>
            </div>

            <div className="tableWrap" style={{ marginTop: 14 }}>
              <table style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Costo</th>
                    <th>Attivo</th>
                    <th className="actionsCell">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((x) => (
                    <tr key={x.id}>
                      <td>{x.full_name}</td>
                      <td>{Number(x.hourly_cost || 0).toFixed(2)} €</td>
                      <td>
                        <button className="btn iconBtn" onClick={() => toggle("employees", x)}>
                          {x.is_active ? "Disattiva" : "Attiva"}
                        </button>
                      </td>
                      <td className="actionsCell">
                        <button className="btn btnWarn btnIcon" title="Modifica" onClick={() => openEdit("employees", x)}>✏️</button>
                        <button className="btn btnDanger btnIcon" title="Elimina" onClick={() => remove("employees", x)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {!employees.length && (
                    <tr><td colSpan="4" style={{ textAlign: "center", opacity: .7, padding: 18 }}>Nessun dipendente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* COMMESSE */}
        {tab === "cdl" && (
          <Section title="Commesse / CDL">
            <div className="row" style={{ marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
              <button
                className={`btn ${cdlFilter === "all" ? "btnPrimary" : ""}`}
                onClick={() => setCdlFilter("all")}
              >
                Tutte
              </button>
              <button
                className={`btn ${cdlFilter === "active" ? "btnPrimary" : ""}`}
                onClick={() => setCdlFilter("active")}
              >
                Attive
              </button>
              <button
                className={`btn ${cdlFilter === "inactive" ? "btnPrimary" : ""}`}
                onClick={() => setCdlFilter("inactive")}
              >
                Chiuse
              </button>
            </div>
            <div className="grid3">
              <div className="formGroup">
                <label>Codice (opzionale)</label>
                <input value={cdlCode} onChange={(e) => setCdlCode(e.target.value)} placeholder="Es: CDL-002" />
              </div>
              <div className="formGroup">
                <label>Nome / Descrizione</label>
                <input value={cdlName} onChange={(e) => setCdlName(e.target.value)} placeholder="Es: Cliente X - Assistenza" />
              </div>
              <div className="formGroup">
                <label>Cliente (opzionale)</label>
                <input value={cdlClient} onChange={(e) => setCdlClient(e.target.value)} placeholder="Es: Cliente X" />
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn btnPrimary" onClick={addCdl}>Aggiungi Commessa</button>
            </div>

            <div className="tableWrap" style={{ marginTop: 14 }}>
              <table style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Nome</th>
                    <th>Cliente</th>
                    <th>Stato</th>
                    <th>Azioni stato</th>
                    <th className="actionsCell">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCdl.map((x) => (
                    <tr key={x.id}>
                      <td>{x.code}</td>
                      <td>{x.name}</td>
                      <td>{x.client}</td>
                      <td>{renderStatusBadge(x.is_active)}</td>
                      <td>
                        <button className="btn iconBtn" onClick={() => toggle("cdl", x)}>
                          {x.is_active ? "Disattiva" : "Riattiva"}
                        </button>
                      </td>
                      <td className="actionsCell">
                        <button className="btn btnWarn btnIcon" title="Modifica" onClick={() => openEdit("cdl", x)}>✏️</button>
                        <button className="btn btnDanger btnIcon" title="Elimina" onClick={() => remove("cdl", x)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {!cdl.length && (
                   <tr><td colSpan="6" style={{ textAlign: "center", opacity: .7, padding: 18 }}>Nessuna commessa</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* LAVORAZIONI */}
        {tab === "lav" && (
          <Section title="Lavorazioni">
            <div className="grid2">
              <div className="formGroup">
                <label>Nome lavorazione</label>
                <input value={lavName} onChange={(e) => setLavName(e.target.value)} placeholder="Es: Installazione" />
              </div>
              <div className="row" style={{ alignItems: "flex-end" }}>
                <button className="btn btnPrimary" onClick={addLav}>Aggiungi</button>
              </div>
            </div>

            <div className="tableWrap" style={{ marginTop: 14 }}>
              <table style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Attiva</th>
                    <th className="actionsCell">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {lavorazioni.map((x) => (
                    <tr key={x.id}>
                      <td>{x.name}</td>
                      <td>
                        <button className="btn iconBtn" onClick={() => toggle("lavorazioni", x)}>
                          {x.is_active ? "Disattiva" : "Attiva"}
                        </button>
                      </td>
                      <td className="actionsCell">
                        <button className="btn btnWarn btnIcon" title="Modifica" onClick={() => openEdit("lavorazioni", x)}>✏️</button>
                        <button className="btn btnDanger btnIcon" title="Elimina" onClick={() => remove("lavorazioni", x)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {!lavorazioni.length && (
                    <tr><td colSpan="3" style={{ textAlign: "center", opacity: .7, padding: 18 }}>Nessuna lavorazione</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>

      <Modal
        open={!!edit}
        title={
          edit?.table === "employees" ? "Modifica Dipendente" :
          edit?.table === "cdl" ? "Modifica Commessa" :
          "Modifica Lavorazione"
        }
        onClose={() => setEdit(null)}
      >
        {edit?.table === "employees" && (
          <div className="grid">
            <div className="grid2">
              <div className="formGroup">
                <label>Nome e Cognome</label>
                <input
                  value={editFields.full_name || ""}
                  onChange={(e) => setEditFields((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div className="formGroup">
                <label>Costo orario (€)</label>
                <input
                  value={editFields.hourly_cost || ""}
                  onChange={(e) => setEditFields((p) => ({ ...p, hourly_cost: e.target.value }))}
                />
              </div>
            </div>
            <div className="row">
              <button className="btn btnPrimary" onClick={saveEdit}>Salva</button>
            </div>
          </div>
        )}

        {edit?.table === "cdl" && (
          <div className="grid">
            <div className="grid3">
              <div className="formGroup">
                <label>Codice</label>
                <input
                  value={editFields.code || ""}
                  onChange={(e) => setEditFields((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div className="formGroup">
                <label>Nome / Descrizione</label>
                <input
                  value={editFields.name || ""}
                  onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="formGroup">
                <label>Cliente</label>
                <input
                  value={editFields.client || ""}
                  onChange={(e) => setEditFields((p) => ({ ...p, client: e.target.value }))}
                />
              </div>
            </div>
            <div className="row">
              <button className="btn btnPrimary" onClick={saveEdit}>Salva</button>
            </div>
          </div>
        )}

        {edit?.table === "lavorazioni" && (
          <div className="grid">
            <div className="formGroup">
              <label>Nome lavorazione</label>
              <input
                value={editFields.name || ""}
                onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="row">
              <button className="btn btnPrimary" onClick={saveEdit}>Salva</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}