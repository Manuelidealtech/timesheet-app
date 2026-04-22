import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "../lib/supabase";
import {
  createInterventionReport,
  fetchInterventionReports,
  updateInterventionReport,
  deleteInterventionReport,
  fetchNextInterventionReportNumber,
} from "../lib/api";
import { buildInterventionPdf, downloadInterventionPdf } from "../utils/interventionPdf";

const emptyWorkRow = () => ({
  row_type: "work",
  date: dayjs().format("YYYY-MM-DD"),
  travel_from: "",
  travel_to: "",
  work_from: "",
  work_to: "",
  quantity: "",
  code: "",
  description: "",
});

const emptyReturnRow = () => ({
  ...emptyWorkRow(),
  row_type: "return",
  work_from: "",
  work_to: "",
  quantity: "",
  code: "",
  description: "Rientro",
});

const emptyMachine = () => ({
  model: "",
  serial_number: "",
});

const ensureMinWorkRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length >= 2) return safeRows;
  return [...safeRows, ...Array.from({ length: 1 - safeRows.length }, emptyWorkRow)];
};

const ensureMinMachines = (machines) => {
  const safeMachines = Array.isArray(machines) ? machines : [];
  if (safeMachines.length >= 1) return safeMachines;
  return [emptyMachine()];
};

const createDefaultForm = () => ({
  client_name: "",
  city: "",
  report_number: "",
  report_date: dayjs().format("YYYY-MM-DD"),
  travel_meals: "",
  car_km: "",
  tolls: "",
  overnight_stays: "",
  notes: "",
  tested: false,
  tested_on: "",
  tested_result: "Positivo",
  technician_signature: "",
  client_signature: "",
  machine_order_number: "",
  work_rows: ensureMinWorkRows([]),
  machines: ensureMinMachines([]),
});

function normalizeReport(payload = {}) {
  const testedValue =
    payload?.tested_with_positive_result === true
      ? "Positivo"
      : payload?.tested_with_positive_result === false && payload?.tested_on
        ? "Negativo"
        : "Non eseguito";

  return {
    ...createDefaultForm(),
    ...payload,
    tested:
      payload?.tested === true ||
      Boolean(payload?.tested_on) ||
      payload?.tested_result === "Positivo" ||
      payload?.tested_result === "Negativo",
    tested_result: payload?.tested_result || testedValue,
    work_rows: ensureMinWorkRows(
      (payload?.work_rows || []).map((row) => ({
        ...emptyWorkRow(),
        ...row,
        row_type: row?.row_type === "return" ? "return" : "work",
        date: row?.date || row?.work_date || dayjs().format("YYYY-MM-DD"),
      }))
    ),
    machines: ensureMinMachines(
      (payload?.machines || []).map((machine) => ({
        ...emptyMachine(),
        ...machine,
      }))
    ),
  };
}

function buildPayloadForDb(form) {
  const isTested = !!form.tested;
  const normalizeTime = (value) => {
    const trimmed = String(value || "").trim();
    return trimmed ? trimmed : null;
  };

  return {
    report_number: form.report_number || null,
    report_date: form.report_date || null,
    client_name: form.client_name || "",
    city: form.city || "",
    travel_meals: form.travel_meals || "",
    car_km: form.car_km || "",
    tolls: form.tolls || "",
    overnight_stays: form.overnight_stays || "",
    notes: form.notes || "",
    machine_order_number: form.machine_order_number || "",
    tested_on: isTested ? form.tested_on || null : null,
    tested_with_positive_result: isTested ? form.tested_result === "Positivo" : false,
    technician_signature: form.technician_signature || "",
    client_signature: form.client_signature || "",
    work_rows: (form.work_rows || [])
      .map((row) => {
        const isReturn = row?.row_type === "return";

        return {
          ...row,
          row_type: isReturn ? "return" : "work",
          travel_from: normalizeTime(row?.travel_from),
          travel_to: normalizeTime(row?.travel_to),
          work_from: isReturn ? null : normalizeTime(row?.work_from),
          work_to: isReturn ? null : normalizeTime(row?.work_to),
          quantity: row?.quantity || "",
          code: row?.code || "",
          description: row?.description || "",
        };
      })
      .filter((row) =>
        Boolean(
          row.date ||
          row.travel_from ||
          row.travel_to ||
          row.work_from ||
          row.work_to ||
          row.quantity ||
          row.code ||
          row.description
        )
      ),
    machines: (form.machines || []).filter((machine) => Object.values(machine).some(Boolean)),
  };
}

export default function Interventi() {
  const [form, setForm] = useState(createDefaultForm());
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const selectedReport = useMemo(
    () => reports.find((item) => String(item.id) === String(selectedId)) || null,
    [reports, selectedId]
  );

  useEffect(() => {
    loadReports();
    initNewForm();
  }, []);

  async function initNewForm() {
    try {
      const nextForm = await buildNewForm();
      setForm(nextForm);
    } catch (e) {
      console.error(e);
      setErr("Errore generazione numero foglio");
    }
  }

  useEffect(() => {
    if (selectedReport) {
      setForm(normalizeReport(selectedReport));
    }
  }, [selectedReport]);

  async function loadReports() {
    try {
      setLoading(true);
      setErr("");
      const data = await fetchInterventionReports();
      setReports(data || []);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Errore caricamento fogli intervento");
    } finally {
      setLoading(false);
    }
  }

  function handleField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleWorkRow(index, field, value) {
    setForm((prev) => ({
      ...prev,
      work_rows: prev.work_rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        const nextRow = { ...row, [field]: value };

        if ((field === "row_type" && value === "return") || nextRow.row_type === "return") {
          nextRow.work_from = "";
          nextRow.work_to = "";
        }

        return nextRow;
      }),
    }));
  }

  function handleMachine(index, field, value) {
    setForm((prev) => ({
      ...prev,
      machines: prev.machines.map((machine, machineIndex) =>
        machineIndex === index ? { ...machine, [field]: value } : machine
      ),
    }));
  }

  function addWorkRow() {
    setForm((prev) => ({
      ...prev,
      work_rows: [...(Array.isArray(prev.work_rows) ? prev.work_rows : []), emptyWorkRow()],
    }));
  }

  function addReturnRow() {
    setForm((prev) => ({
      ...prev,
      work_rows: [...(Array.isArray(prev.work_rows) ? prev.work_rows : []), emptyReturnRow()],
    }));
  }

  function removeWorkRow(index) {
    setForm((prev) => {
      const nextRows = (Array.isArray(prev.work_rows) ? prev.work_rows : []).filter(
        (_, rowIndex) => rowIndex !== index
      );

      return {
        ...prev,
        work_rows: ensureMinWorkRows(nextRows),
      };
    });
  }

  function addMachine() {
    setForm((prev) => ({
      ...prev,
      machines: [...(Array.isArray(prev.machines) ? prev.machines : []), emptyMachine()],
    }));
  }

  function removeMachine(index) {
    setForm((prev) => {
      const nextMachines = (Array.isArray(prev.machines) ? prev.machines : []).filter(
        (_, machineIndex) => machineIndex !== index
      );

      return {
        ...prev,
        machines: ensureMinMachines(nextMachines),
      };
    });
  }

  async function resetForm() {
    try {
      setSelectedId("");
      setErr("");
      setOk("");

      const nextForm = await buildNewForm();
      setForm(nextForm);
    } catch (e) {
      console.error(e);
      setErr("Errore creazione nuovo foglio");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setOk("");

    const payload = buildPayloadForDb(form);

    try {
      let saved;
      if (selectedId) {
        saved = await updateInterventionReport(selectedId, payload);
        setOk("Foglio intervento aggiornato ✅");
      } else {
        saved = await createInterventionReport(payload);
        setOk("Foglio intervento salvato ✅");
      }

      await loadReports();
      if (saved?.id) setSelectedId(saved.id);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Errore salvataggio foglio intervento");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 2400);
    }
  }

  async function handleDeleteReport(reportId) {
    const confirmDelete = window.confirm("Vuoi eliminare definitivamente questo foglio intervento?");
    if (!confirmDelete) return;

    try {
      setErr("");
      setOk("");

      await deleteInterventionReport(reportId);

      if (String(selectedId) === String(reportId)) {
        setSelectedId("");
        setForm(createDefaultForm());
      }

      await loadReports();
      setOk("Foglio intervento eliminato ✅");
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Errore eliminazione foglio intervento");
    } finally {
      setTimeout(() => setOk(""), 2400);
    }
  }

  async function buildNewForm() {
    const nextNumber = await fetchNextInterventionReportNumber();

    return {
      ...createDefaultForm(),
      report_number: nextNumber || "",
    };
  }

  async function exportPdf(report = null) {
    const source = normalizeReport(report || form);
    const doc = await buildInterventionPdf(source);
    const fileName = `foglio-intervento-${source.report_number || dayjs().format("YYYYMMDD-HHmm")}.pdf`;
    downloadInterventionPdf(doc, fileName);
  }

  function uint8ToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  async function sendByEmail(report = null) {
    const source = normalizeReport(report || form);

    if (!source.client_name) {
      setErr("Compila almeno il cliente prima dell'invio.");
      return;
    }

    try {
      setSendingId(source.id || "draft");
      setErr("");
      setOk("");

      const dbPayload = buildPayloadForDb(source);

      let savedReport = source;

      if (source.id) {
        const updated = await updateInterventionReport(source.id, dbPayload);
        savedReport = normalizeReport(updated);
      } else {
        const created = await createInterventionReport(dbPayload);
        savedReport = normalizeReport(created);

        if (created?.id) {
          setSelectedId(created.id);
        }
      }

      if (!savedReport.report_number) {
        throw new Error("Numero foglio non disponibile.");
      }

      const pdfDoc = await buildInterventionPdf(savedReport);
      const pdfArrayBuffer = pdfDoc.output("arraybuffer");
      const pdfBytes = new Uint8Array(pdfArrayBuffer);
      const pdfBase64 = uint8ToBase64(pdfBytes);

      const payload = {
        report_number: savedReport.report_number,
        report_date: savedReport.report_date,
        client_name: savedReport.client_name,
        city: savedReport.city,
        travel_meals: savedReport.travel_meals,
        car_km: savedReport.car_km,
        tolls: savedReport.tolls,
        overnight_stays: savedReport.overnight_stays,
        machine_order_number: savedReport.machine_order_number,
        tested_on: savedReport.tested_on,
        tested_with_positive_result: savedReport.tested_result === "Positivo",
        technician_signature: savedReport.technician_signature,
        client_signature: savedReport.client_signature,
        notes: savedReport.notes,
        pdf_base64: pdfBase64,
        pdf_file_name: `foglio-intervento-${savedReport.report_number}.pdf`,
      };

      console.log("SEND EMAIL PAYLOAD SIZE:", JSON.stringify(payload).length);
      console.log("SEND EMAIL PAYLOAD:", {
        ...payload,
        pdf_base64: payload.pdf_base64
          ? `[base64 length: ${payload.pdf_base64.length}]`
          : null,
      });

      const { data, error } = await supabase.functions.invoke(
        "send-intervention-report",
        {
          body: payload,
        }
      );

      console.log("send-intervention-report data:", data);
      console.log("send-intervention-report error:", error);

      if (error) {
        throw new Error(error.message || "Errore funzione Supabase");
      }

      if (data?.error) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error)
        );
      }

      if (savedReport.id) {
        const updatedReport = await updateInterventionReport(savedReport.id, {
          ...buildPayloadForDb(savedReport),
          pdf_sent_at: new Date().toISOString(),
          pdf_file_name: `foglio-intervento-${savedReport.report_number}.pdf`,
        });

        setForm(normalizeReport(updatedReport));
      } else {
        setForm(savedReport);
      }

      await loadReports();
      setOk("Foglio intervento inviato via mail ✅");
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Errore invio email");
    } finally {
      setSendingId("");
      setTimeout(() => setOk(""), 2400);
    }
  }

  return (
    <div className="container pageShell">
      <section className="pageHero interventionPage">
        <div className="pageHeader">
          <div className="pageHeaderMain">
            <h1 className="pageTitle">Fogli intervento</h1>
            <p className="pageSubtitle">
              Compilazione digitale del foglio intervento, export PDF e invio diretto a Lucia.
            </p>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={resetForm}>
              Nuovo foglio
            </button>
            <button className="btn btnPrimary" type="button" onClick={() => exportPdf()}>
              Esporta PDF
            </button>
            <button
              className="btn btnPrimary"
              type="button"
              onClick={() => sendByEmail()}
              disabled={sendingId === (selectedId || "draft")}
            >
              {sendingId === (selectedId || "draft") ? "Invio..." : "Invia a Lucia"}
            </button>
          </div>
        </div>

        {err && (
          <div className="toast err" style={{ marginBottom: 12 }}>
            {err}
          </div>
        )}
        {ok && (
          <div className="toast ok" style={{ marginBottom: 12 }}>
            {ok}
          </div>
        )}

        <div className="pageBody">
          <div className="interventionLayout">
            <div className="card interventionHistoryCard">
              <div className="cardHeader">
                <div>
                  <div className="sub">Archivio</div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>Fogli salvati</div>
                </div>
                <span className="badge">{reports.length}</span>
              </div>

              <hr className="sep" />

              {loading ? (
                <div className="sub">Caricamento...</div>
              ) : reports.length ? (
                <div className="interventionHistoryList">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className={`interventionHistoryItem ${selectedId === report.id ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        className="interventionHistoryMain"
                        onClick={() => setSelectedId(report.id)}
                      >
                        <div className="interventionHistoryTop">
                          <strong>{report.report_number || "Senza numero"}</strong>
                          <span>{report.report_date || ""}</span>
                        </div>
                        <div className="interventionHistoryClient">
                          {report.client_name || "Cliente non indicato"}
                        </div>
                        <div className="interventionHistoryMeta">
                          <span>{report.city || "—"}</span>
                          <span>{report.pdf_sent_at ? "Mail inviata" : "Da inviare"}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="btn btnDanger interventionDeleteBtn"
                        onClick={() => handleDeleteReport(report.id)}
                      >
                        Elimina
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sub">Nessun foglio intervento salvato.</div>
              )}
            </div>

            <form className="card interventionFormCard" onSubmit={handleSave}>
              <div className="formSection">
                <div className="formSectionTitle">Dati principali</div>
                <div className="grid3 interventionGridTop">
                  <div className="formGroup">
                    <label>Cliente</label>
                    <input
                      value={form.client_name}
                      onChange={(e) => handleField("client_name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label>Città</label>
                    <input
                      value={form.city}
                      onChange={(e) => handleField("city", e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label>Nr. foglio</label>
                    <input value={form.report_number || "Automatico al salvataggio"} readOnly disabled />
                  </div>

                  <div className="formGroup">
                    <label>Data</label>
                    <input
                      type="date"
                      value={form.report_date}
                      onChange={(e) => handleField("report_date", e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label>Pasti</label>
                    <input
                      value={form.travel_meals}
                      onChange={(e) => handleField("travel_meals", e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label>Km auto</label>
                    <input
                      value={form.car_km}
                      onChange={(e) => handleField("car_km", e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label>Autostrade</label>
                    <input
                      value={form.tolls}
                      onChange={(e) => handleField("tolls", e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label>Pernottamenti</label>
                    <input
                      value={form.overnight_stays}
                      onChange={(e) => handleField("overnight_stays", e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label>Collaudo esito</label>
                    <select
                      value={form.tested_result}
                      onChange={(e) => handleField("tested_result", e.target.value)}
                    >
                      <option value="Positivo">Positivo</option>
                      <option value="Negativo">Negativo</option>
                      <option value="Non eseguito">Non eseguito</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="formSection">
                <div className="cardHeader interventionSectionHead">
                  <div>
                    <div className="formSectionTitle">Righe lavoro / ricambi</div>
                    <div className="sub">Replica digitale della tabella presente nel modulo PDF.</div>
                  </div>
                  <div className="interventionSectionActions">
                    <button type="button" className="btn" onClick={addWorkRow}>
                      Aggiungi riga
                    </button>
                    <button type="button" className="btn btnPrimary" onClick={addReturnRow}>
                      Aggiungi ritorno
                    </button>
                  </div>
                </div>

                <div className="interventionRowsTable">
                  {ensureMinWorkRows(form.work_rows).map((row, index) => {
                    const isReturnRow = row?.row_type === "return";

                    return (
                      <div key={index} className={`interventionRowCard ${isReturnRow ? "interventionRowCard--return" : ""}`}>
                        <div className="interventionRowCardHead">
                          <span className={`badge ${isReturnRow ? "badgeReturn" : ""}`}>
                            {isReturnRow ? "Ritorno" : "Lavoro / ricambi"}
                          </span>
                        </div>

                        <div className="interventionRowGrid">
                          <input
                            className="col-date"
                            type="date"
                            value={row.date || ""}
                            onChange={(e) => handleWorkRow(index, "date", e.target.value)}
                          />
                          <input
                            className="col-time"
                            value={row.travel_from || ""}
                            onChange={(e) => handleWorkRow(index, "travel_from", e.target.value)}
                            placeholder="Viaggio dalle"
                          />
                          <input
                            className="col-time"
                            value={row.travel_to || ""}
                            onChange={(e) => handleWorkRow(index, "travel_to", e.target.value)}
                            placeholder="Viaggio alle"
                          />
                          <input
                            className="col-time"
                            value={row.work_from || ""}
                            onChange={(e) => handleWorkRow(index, "work_from", e.target.value)}
                            placeholder={isReturnRow ? "Non richiesto per ritorno" : "Lavoro dalle"}
                            disabled={isReturnRow}
                            readOnly={isReturnRow}
                          />
                          <input
                            className="col-time"
                            value={row.work_to || ""}
                            onChange={(e) => handleWorkRow(index, "work_to", e.target.value)}
                            placeholder={isReturnRow ? "Non richiesto per ritorno" : "Lavoro alle"}
                            disabled={isReturnRow}
                            readOnly={isReturnRow}
                          />
                          <input
                            className="col-qty"
                            value={row.quantity || ""}
                            onChange={(e) => handleWorkRow(index, "quantity", e.target.value)}
                            placeholder="Q.tà"
                          />
                          <input
                            className="col-code"
                            value={row.code || ""}
                            onChange={(e) => handleWorkRow(index, "code", e.target.value)}
                            placeholder="Codice"
                          />
                          <input
                            className="col-description"
                            value={row.description || ""}
                            onChange={(e) => handleWorkRow(index, "description", e.target.value)}
                            placeholder="Descrizione"
                          />
                        </div>

                        <div className="interventionRowActions">
                          <button
                            type="button"
                            className="btn btnDanger"
                            onClick={() => removeWorkRow(index)}
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="formSection">
                <div className="cardHeader interventionSectionHead">
                  <div>
                    <div className="formSectionTitle">Macchine</div>
                    <div className="sub">Modello e numero seriale.</div>
                  </div>
                  <button type="button" className="btn" onClick={addMachine}>
                    Aggiungi macchina
                  </button>
                </div>

                <div className="grid3">
                  {ensureMinMachines(form.machines).map((machine, index) => (
                    <div key={index} className="machineCard">
                      <div className="formGroup">
                        <label>Modello</label>
                        <input
                          value={machine.model || ""}
                          onChange={(e) => handleMachine(index, "model", e.target.value)}
                        />
                      </div>

                      <div className="formGroup">
                        <label>Nr serie</label>
                        <input
                          value={machine.serial_number || ""}
                          onChange={(e) => handleMachine(index, "serial_number", e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btnDanger"
                        onClick={() => removeMachine(index)}
                      >
                        Elimina macchina
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid2">
                <div className="formSection">
                  <div className="formSectionTitle">Annotazioni</div>
                  <textarea
                    rows="8"
                    value={form.notes}
                    onChange={(e) => handleField("notes", e.target.value)}
                    placeholder="Annotazioni intervento"
                  />
                </div>

                <div className="formSection">


                  <div className="formSection">
                    <div className="formSectionTitle">Collaudo e firme</div>

                    <div className="formGroup">
                      <label className="iosSwitchRow">
                        <span className="iosSwitchText">Macchina collaudata</span>

                        <input
                          type="checkbox"
                          className="iosSwitchInput"
                          checked={!!form.tested}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setForm((prev) => ({
                              ...prev,
                              tested: checked,
                              tested_on: checked ? prev.tested_on || dayjs().format("YYYY-MM-DD") : "",
                              tested_result: checked
                                ? prev.tested_result === "Non eseguito"
                                  ? "Positivo"
                                  : prev.tested_result
                                : "Non eseguito",
                            }));
                          }}
                        />

                        <span className="iosSwitchSlider" />
                      </label>
                    </div>

                    <div className="grid2">
                      <div className="formGroup">
                        <label>Data collaudo</label>
                        <input
                          type="date"
                          value={form.tested_on || ""}
                          disabled={!form.tested}
                          onChange={(e) => handleField("tested_on", e.target.value)}
                        />
                      </div>

                      <div className="formGroup">
                        <label>Esito</label>
                        <select
                          value={form.tested ? form.tested_result : "Non eseguito"}
                          disabled={!form.tested}
                          onChange={(e) => handleField("tested_result", e.target.value)}
                        >
                          <option value="Positivo">Positivo</option>
                          <option value="Negativo">Negativo</option>
                          <option value="Non eseguito">Non eseguito</option>
                        </select>
                      </div>
                    </div>

                    <div className="formGroup">
                      <label>Nr. ordine macchina</label>
                      <input
                        value={form.machine_order_number}
                        onChange={(e) => handleField("machine_order_number", e.target.value)}
                      />
                    </div>

                    <div className="formGroup">
                      <label>Firma incaricato Idealtech</label>
                      <input
                        value={form.technician_signature}
                        onChange={(e) => handleField("technician_signature", e.target.value)}
                        placeholder="Nome e cognome"
                      />
                    </div>

                    <div className="formGroup">
                      <label>Firma cliente</label>
                      <input
                        value={form.client_signature}
                        onChange={(e) => handleField("client_signature", e.target.value)}
                        placeholder="Timbro / firma"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="row interventionActions">
                <button className="btn btnPrimary" type="submit" disabled={saving}>
                  {saving ? "Salvataggio..." : selectedId ? "Aggiorna foglio" : "Salva foglio"}
                </button>
                <button className="btn" type="button" onClick={() => exportPdf()}>
                  Esporta PDF
                </button>
                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={() => sendByEmail()}
                  disabled={sendingId === (selectedId || "draft")}
                >
                  {sendingId === (selectedId || "draft") ? "Invio..." : "Invia a Lucia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
