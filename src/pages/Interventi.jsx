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
import SignaturePad from "../components/SignaturePad";

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
  client_email: "",
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
  client_signature_image: "",
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
    client_email: form.client_email || "",
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
    client_signature_image: form.client_signature_image || "",
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

function InterventionIcon({ name, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  };
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    route: <><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h3a4 4 0 0 0 4-4v-6a4 4 0 0 1 3-4"/></>,
    wrench: <path d="M14.7 6.3a4 4 0 0 0-5-5L7.4 3.6l3 3L8.6 8.4l-3-3-2.3 2.3a4 4 0 0 0 5 5L17 21l4-4-8.7-8.7a4 4 0 0 0 2.4-2Z"/>,
    machine: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h5M7 14h3M17 10h.01M17 14h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    signature: <><path d="M4 18c3-6 4-10 6-10 3 0-1 8 2 8 2 0 3-5 5-5 2 0 1 4 3 4"/><path d="M4 21h16"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></>,
    archive: <><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M9 13h6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  };
  return <svg {...common}>{paths[name] || paths.file}</svg>;
}

function formatReportDate(value) {
  if (!value) return "—";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY") : value;
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
  const [reportQuery, setReportQuery] = useState("");

  const selectedReport = useMemo(
    () => reports.find((item) => String(item.id) === String(selectedId)) || null,
    [reports, selectedId]
  );

  const filteredReports = useMemo(() => {
    const needle = reportQuery.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((report) =>
      [report.report_number, report.client_name, report.city, report.client_email, report.report_date]
        .filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [reports, reportQuery]);

  const sentReports = useMemo(() => reports.filter((report) => Boolean(report.pdf_sent_at)).length, [reports]);
  const pendingReports = Math.max(0, reports.length - sentReports);

  const formCompletion = useMemo(() => {
    const hasWork = (form.work_rows || []).some((row) => Boolean(row?.travel_from || row?.travel_to || row?.work_from || row?.work_to || row?.code || row?.description));
    const hasMachine = (form.machines || []).some((machine) => Boolean(machine?.model || machine?.serial_number));
    const checks = [Boolean(form.client_name && form.city), hasWork, hasMachine, Boolean(form.technician_signature), Boolean(form.client_email), Boolean(form.client_signature_image)];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, percentage: Math.round((done / checks.length) * 100), checks };
  }, [form]);

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

    const clientEmail = String(source.client_email || "").trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailPattern.test(clientEmail)) {
      setErr("Inserisci un indirizzo email cliente valido prima dell'invio.");
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
        client_email: savedReport.client_email,
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
        client_signature_image: savedReport.client_signature_image,
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
      setOk("Foglio intervento inviato a Lucia e al cliente ✅");
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Errore invio email");
    } finally {
      setSendingId("");
      setTimeout(() => setOk(""), 2400);
    }
  }

  return (
    <div className="container pageShell interventionPage interventionPageV2">
      <section className="pageHero interventionHeroV2">
        <div className="interventionHeroTop">
          <div>
            <span className="interventionEyebrow">Assistenza tecnica</span>
            <h1 className="pageTitle">Fogli intervento</h1>
            <p className="pageSubtitle">Compila l’intervento, raccogli la firma del cliente e invia il PDF senza uscire dall’app.</p>
          </div>
          <button className="btn interventionNewBtn" type="button" onClick={resetForm}>
            <InterventionIcon name="plus" size={17} /> Nuovo foglio
          </button>
        </div>

        <div className="interventionHeroStats">
          <div className="interventionStatCard"><span className="interventionStatIcon"><InterventionIcon name="archive" /></span><div><small>Archivio</small><strong>{reports.length}</strong><span>fogli salvati</span></div></div>
          <div className="interventionStatCard"><span className="interventionStatIcon isSuccess"><InterventionIcon name="send" /></span><div><small>Inviati</small><strong>{sentReports}</strong><span>via email</span></div></div>
          <div className="interventionStatCard"><span className="interventionStatIcon isWarning"><InterventionIcon name="file" /></span><div><small>Da inviare</small><strong>{pendingReports}</strong><span>ancora aperti</span></div></div>
          <div className="interventionStatCard interventionStatCard--progress">
            <div className="interventionProgressRing" style={{ "--progress": `${formCompletion.percentage * 3.6}deg` }}><span>{formCompletion.percentage}%</span></div>
            <div><small>Compilazione</small><strong>{formCompletion.done}/{formCompletion.total}</strong><span>passaggi completi</span></div>
          </div>
        </div>

      </section>

      {err && <div className="toast err interventionToast">{err}</div>}
      {ok && <div className="toast ok interventionToast">{ok}</div>}

      <div className="interventionWorkspace">
        <aside className="card interventionArchivePanel">
          <div className="interventionArchiveHead">
            <div><span className="interventionSectionKicker">Archivio</span><h2>Fogli salvati</h2><p>Apri un foglio per modificarlo o reinviarlo.</p></div>
            <span className="interventionArchiveCount">{filteredReports.length}</span>
          </div>
          <div className="interventionArchiveSearch"><InterventionIcon name="search" size={16} /><input value={reportQuery} onChange={(e) => setReportQuery(e.target.value)} placeholder="Numero, cliente, città..." /></div>
          <div className="interventionArchiveList">
            {loading ? <div className="interventionArchiveEmpty">Caricamento archivio...</div> : filteredReports.length ? filteredReports.map((report) => {
              const active = String(selectedId) === String(report.id);
              return (
                <div key={report.id} className={`interventionArchiveItem ${active ? "isActive" : ""}`}>
                  <button type="button" className="interventionArchiveMain" onClick={() => setSelectedId(report.id)}>
                    <div className="interventionArchiveTopline"><span className="interventionReportNumber">#{report.report_number || "—"}</span><span className={`interventionMailStatus ${report.pdf_sent_at ? "isSent" : ""}`}>{report.pdf_sent_at ? "Inviato" : "Da inviare"}</span></div>
                    <strong>{report.client_name || "Cliente non indicato"}</strong>
                    <div className="interventionArchiveMeta"><span><InterventionIcon name="calendar" size={13} />{formatReportDate(report.report_date)}</span><span>{report.city || "Città —"}</span></div>
                  </button>
                  <button type="button" className="interventionArchiveDelete" onClick={() => handleDeleteReport(report.id)} title="Elimina foglio" aria-label="Elimina foglio"><InterventionIcon name="trash" size={15} /></button>
                </div>
              );
            }) : <div className="interventionArchiveEmpty"><InterventionIcon name="search" size={21} /><strong>Nessun foglio trovato</strong><span>Modifica la ricerca oppure crea un nuovo intervento.</span></div>}
          </div>
        </aside>

        <form className="interventionFormV2" onSubmit={handleSave}>
          <div className="interventionDocumentBar">
            <div className="interventionDocumentIdentity"><span className="interventionDocumentIcon"><InterventionIcon name="file" /></span><div><span>{selectedId ? "Foglio selezionato" : "Nuovo foglio"}</span><strong>#{form.report_number || "automatico"}</strong></div></div>
            <div className="interventionDocumentMeta"><span>{form.client_name || "Cliente da inserire"}</span><span>{formatReportDate(form.report_date)}</span>{selectedReport?.pdf_sent_at && <span className="interventionSentPill">Email inviata</span>}</div>
          </div>

          <section className="formSection interventionSectionV2">
            <div className="interventionSectionTitleV2"><span className="interventionSectionNumber">01</span><span className="interventionSectionIconV2"><InterventionIcon name="user" /></span><div><h2>Cliente e dati intervento</h2><p>Informazioni principali, data e spese di trasferta.</p></div></div>
            <div className="interventionPrimaryGrid">
              <div className="formGroup interventionFieldWide"><label>Cliente *</label><input value={form.client_name} onChange={(e) => handleField("client_name", e.target.value)} placeholder="Ragione sociale / cliente" required /></div>
              <div className="formGroup"><label>Città</label><input value={form.city} onChange={(e) => handleField("city", e.target.value)} placeholder="Località intervento" /></div>
              <div className="formGroup"><label>Data intervento</label><input type="date" value={form.report_date} onChange={(e) => handleField("report_date", e.target.value)} /></div>
              <div className="formGroup"><label>Nr. foglio</label><input value={form.report_number || "Automatico"} readOnly disabled /></div>
            </div>
            <div className="interventionTravelStrip">
              <div className="interventionTravelTitle"><span><InterventionIcon name="route" size={17} /></span><div><strong>Trasferta</strong><small>Costi e percorrenza</small></div></div>
              <div className="formGroup"><label>Pasti</label><input value={form.travel_meals} onChange={(e) => handleField("travel_meals", e.target.value)} placeholder="0" /></div>
              <div className="formGroup"><label>Km auto</label><input value={form.car_km} onChange={(e) => handleField("car_km", e.target.value)} placeholder="0 km" /></div>
              <div className="formGroup"><label>Autostrade</label><input value={form.tolls} onChange={(e) => handleField("tolls", e.target.value)} placeholder="0" /></div>
              <div className="formGroup"><label>Pernottamenti</label><input value={form.overnight_stays} onChange={(e) => handleField("overnight_stays", e.target.value)} placeholder="0" /></div>
            </div>
          </section>

          <section className="formSection interventionSectionV2">
            <div className="interventionSectionTitleV2 interventionSectionTitleV2--actions">
              <span className="interventionSectionNumber">02</span><span className="interventionSectionIconV2"><InterventionIcon name="wrench" /></span><div><h2>Attività, viaggi e ricambi</h2><p>Inserisci una riga per ogni attività o tratta di ritorno.</p></div>
              <div className="interventionSectionButtons"><button type="button" className="btn" onClick={addWorkRow}><InterventionIcon name="plus" size={15} /> Riga lavoro</button><button type="button" className="btn btnPrimary" onClick={addReturnRow}><InterventionIcon name="plus" size={15} /> Aggiungi ritorno</button></div>
            </div>
            <div className="interventionRowsV2">
              {ensureMinWorkRows(form.work_rows).map((row, index) => {
                const isReturnRow = row?.row_type === "return";
                return (
                  <div key={index} className={`interventionActivityCard ${isReturnRow ? "isReturn" : ""}`}>
                    <div className="interventionActivityHead"><div><span className="interventionActivityIndex">{String(index + 1).padStart(2, "0")}</span><strong>{isReturnRow ? "Viaggio di ritorno" : "Lavoro / ricambio"}</strong></div><button type="button" className="interventionMiniDanger" onClick={() => removeWorkRow(index)} title="Elimina riga"><InterventionIcon name="trash" size={15} /></button></div>
                    <div className="interventionActivityGrid">
                      <label className="interventionMiniField"><span>Data</span><input type="date" value={row.date || ""} onChange={(e) => handleWorkRow(index, "date", e.target.value)} /></label>
                      <label className="interventionMiniField"><span>Viaggio dalle</span><input value={row.travel_from || ""} onChange={(e) => handleWorkRow(index, "travel_from", e.target.value)} placeholder="08:00" /></label>
                      <label className="interventionMiniField"><span>Viaggio alle</span><input value={row.travel_to || ""} onChange={(e) => handleWorkRow(index, "travel_to", e.target.value)} placeholder="09:00" /></label>
                      <label className="interventionMiniField"><span>Lavoro dalle</span><input value={row.work_from || ""} onChange={(e) => handleWorkRow(index, "work_from", e.target.value)} placeholder={isReturnRow ? "—" : "09:00"} disabled={isReturnRow} readOnly={isReturnRow} /></label>
                      <label className="interventionMiniField"><span>Lavoro alle</span><input value={row.work_to || ""} onChange={(e) => handleWorkRow(index, "work_to", e.target.value)} placeholder={isReturnRow ? "—" : "17:00"} disabled={isReturnRow} readOnly={isReturnRow} /></label>
                      <label className="interventionMiniField interventionMiniField--qty"><span>Q.tà</span><input value={row.quantity || ""} onChange={(e) => handleWorkRow(index, "quantity", e.target.value)} placeholder="1" /></label>
                      <label className="interventionMiniField"><span>Codice</span><input value={row.code || ""} onChange={(e) => handleWorkRow(index, "code", e.target.value)} placeholder="Codice ricambio" /></label>
                      <label className="interventionMiniField interventionMiniField--description"><span>Descrizione</span><input value={row.description || ""} onChange={(e) => handleWorkRow(index, "description", e.target.value)} placeholder={isReturnRow ? "Rientro" : "Descrivi il lavoro eseguito"} /></label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="formSection interventionSectionV2">
            <div className="interventionSectionTitleV2 interventionSectionTitleV2--actions"><span className="interventionSectionNumber">03</span><span className="interventionSectionIconV2"><InterventionIcon name="machine" /></span><div><h2>Macchine coinvolte</h2><p>Associa modello e numero di serie all’intervento.</p></div><button type="button" className="btn interventionAddMachineBtn" onClick={addMachine}><InterventionIcon name="plus" size={15} /> Aggiungi macchina</button></div>
            <div className="interventionMachinesGrid">
              {ensureMinMachines(form.machines).map((machine, index) => (
                <div key={index} className="interventionMachineCardV2">
                  <div className="interventionMachineHead"><div><span>Macchina</span><strong>{String(index + 1).padStart(2, "0")}</strong></div><button type="button" className="interventionMiniDanger" onClick={() => removeMachine(index)} title="Elimina macchina"><InterventionIcon name="trash" size={15} /></button></div>
                  <div className="formGroup"><label>Modello</label><input value={machine.model || ""} onChange={(e) => handleMachine(index, "model", e.target.value)} placeholder="Modello macchina" /></div>
                  <div className="formGroup"><label>Numero di serie</label><input value={machine.serial_number || ""} onChange={(e) => handleMachine(index, "serial_number", e.target.value)} placeholder="S/N" /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="formSection interventionSectionV2 interventionClosureSection">
            <div className="interventionSectionTitleV2"><span className="interventionSectionNumber">04</span><span className="interventionSectionIconV2"><InterventionIcon name="check" /></span><div><h2>Chiusura, collaudo e firme</h2><p>Completa le note tecniche e raccogli i dati necessari all’invio.</p></div></div>
            <div className="interventionClosureGrid">
              <div className="interventionNotesPanel"><div className="interventionSubPanelHead"><span><InterventionIcon name="wrench" size={17} /></span><div><strong>Annotazioni intervento</strong><small>Note visibili anche nel PDF</small></div></div><textarea rows="11" value={form.notes} onChange={(e) => handleField("notes", e.target.value)} placeholder="Descrivi anomalie, attività eseguite, componenti sostituiti, verifiche finali..." /></div>
              <div className="interventionFinalPanel">
                <div className="interventionTestCard">
                  <label className="iosSwitchRow interventionSwitchV2"><div><span className="iosSwitchText">Macchina collaudata</span><small>Attiva quando il collaudo è stato eseguito</small></div><input type="checkbox" className="iosSwitchInput" checked={!!form.tested} onChange={(e) => { const checked = e.target.checked; setForm((prev) => ({ ...prev, tested: checked, tested_on: checked ? prev.tested_on || dayjs().format("YYYY-MM-DD") : "", tested_result: checked ? prev.tested_result === "Non eseguito" ? "Positivo" : prev.tested_result : "Non eseguito" })); }} /><span className="iosSwitchSlider" /></label>
                  <div className="grid2 interventionTestGrid"><div className="formGroup"><label>Data collaudo</label><input type="date" value={form.tested_on || ""} disabled={!form.tested} onChange={(e) => handleField("tested_on", e.target.value)} /></div><div className="formGroup"><label>Esito</label><select value={form.tested ? form.tested_result : "Non eseguito"} disabled={!form.tested} onChange={(e) => handleField("tested_result", e.target.value)}><option value="Positivo">Positivo</option><option value="Negativo">Negativo</option><option value="Non eseguito">Non eseguito</option></select></div></div>
                  <div className="formGroup"><label>Nr. ordine macchina</label><input value={form.machine_order_number} onChange={(e) => handleField("machine_order_number", e.target.value)} placeholder="Numero ordine" /></div>
                  <div className="formGroup"><label>Incaricato Idealtech</label><input value={form.technician_signature} onChange={(e) => handleField("technician_signature", e.target.value)} placeholder="Nome e cognome del tecnico" /></div>
                </div>
                <div className="interventionDeliveryCard"><div className="interventionSubPanelHead"><span><InterventionIcon name="mail" size={17} /></span><div><strong>Consegna digitale</strong><small>PDF al cliente + copia a Lucia</small></div></div><div className="formGroup"><label>Email cliente</label><input type="email" inputMode="email" autoComplete="email" value={form.client_email || ""} onChange={(e) => handleField("client_email", e.target.value)} placeholder="cliente@azienda.it" /></div><div className={`interventionDeliveryStatus ${form.client_email ? "isReady" : ""}`}><span>{form.client_email ? <InterventionIcon name="check" size={14} /> : <InterventionIcon name="mail" size={14} />}</span>{form.client_email ? "Indirizzo pronto per l’invio" : "Inserisci la mail fornita dal cliente"}</div></div>
                <div className="interventionSignaturePanel"><div className="interventionSubPanelHead"><span><InterventionIcon name="signature" size={18} /></span><div><strong>Firma cliente</strong><small>Firma con dito, pennino o mouse</small></div></div><SignaturePad value={form.client_signature_image || ""} onChange={(dataUrl) => handleField("client_signature_image", dataUrl)} /></div>
              </div>
            </div>
          </section>

          <div className="interventionActionDock">
            <div className="interventionActionStatus"><span className={`interventionActionDot ${selectedId ? "isSaved" : ""}`} /><div><strong>{selectedId ? `Foglio #${form.report_number || "—"}` : "Bozza non salvata"}</strong><span>{form.client_name || "Inserisci il cliente per iniziare"}</span></div></div>
            <div className="interventionActionButtons">
              <button className="btn interventionPdfBtn" type="button" onClick={() => exportPdf()}><InterventionIcon name="download" size={16} /> PDF</button>
              <button className="btn btnPrimary interventionSaveBtn" type="submit" disabled={saving}><InterventionIcon name="file" size={16} />{saving ? "Salvataggio..." : selectedId ? "Aggiorna foglio" : "Salva foglio"}</button>
              <button className="btn btnPrimary interventionSendBtn" type="button" onClick={() => sendByEmail()} disabled={sendingId === (selectedId || "draft")}><InterventionIcon name="send" size={16} />{sendingId === (selectedId || "draft") ? "Invio..." : "Invia email"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
