import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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


const PDF_LOGO_PATH = "/logo-idealtech.png";
const EXPORT_PAGE_SIZE = 1000;

function safeText(value, fallback = "-") {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

function formatDateIT(value) {
  if (!value) return "-";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD/MM/YYYY") : String(value);
}

function formatTime(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

function getCdlLabel(item) {
  if (!item) return "-";
  return `${item.code ? `${item.code} - ` : ""}${safeText(item.name)}`;
}

function getSelectedLabel(items, selectedId, fallback, formatter) {
  if (!selectedId) return fallback;
  const item = items.find((x) => String(x.id) === String(selectedId));
  return item ? formatter(item) : fallback;
}


function rowMatchesSearch(row, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const searchText = [
    row.work_date,
    row.employees?.full_name,
    row.cdl?.code,
    row.cdl?.name,
    row.lavorazioni?.name,
    row.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchText.includes(needle);
}

function getImageFormat(dataUrl) {
  if (!dataUrl) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
    return "JPEG";
  }
  return "PNG";
}

async function loadImageAsDataUrl(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Logo PDF non caricato:", error);
    return null;
  }
}

function drawPdfFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;

  doc.setDrawColor(226, 232, 240);
  doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Idealtech - Report timesheet amministrazione", 12, pageHeight - 7);
  doc.text(`Pagina ${pageNumber}`, pageWidth - 12, pageHeight - 7, { align: "right" });
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
  const [exportingPdf, setExportingPdf] = useState(null);
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

  const filtered = useMemo(() => rows.filter((row) => rowMatchesSearch(row, q)), [rows, q]);

  const totalMinutes = useMemo(
    () => filtered.reduce((a, r) => a + (r.minutes || 0), 0),
    [filtered]
  );


  function buildTimesheetsQuery({ ignorePeriod = false, pageFrom = 0, pageTo = EXPORT_PAGE_SIZE - 1 } = {}) {
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
      .order("work_date", { ascending: false })
      .order("start_time", { ascending: false })
      .range(pageFrom, pageTo);

    if (!ignorePeriod) {
      qy = qy.gte("work_date", from).lte("work_date", to);
    }

    if (employeeId) qy = qy.eq("employee_id", Number(employeeId));
    if (cdlId) qy = qy.eq("cdl_id", Number(cdlId));
    if (lavId) qy = qy.eq("lavorazione_id", Number(lavId));

    return qy;
  }

  async function fetchTimesheetsForExport({ ignorePeriod = false } = {}) {
    const allRows = [];
    let pageFrom = 0;

    while (true) {
      const pageTo = pageFrom + EXPORT_PAGE_SIZE - 1;
      const { data, error } = await buildTimesheetsQuery({ ignorePeriod, pageFrom, pageTo });

      if (error) throw error;

      const batch = data || [];
      allRows.push(...batch);

      if (batch.length < EXPORT_PAGE_SIZE) break;
      pageFrom += EXPORT_PAGE_SIZE;
    }

    return allRows.filter((row) => rowMatchesSearch(row, q));
  }

  async function exportTimesheetsPdf({ ignorePeriod = false } = {}) {
    setErr("");
    setExportingPdf(ignorePeriod ? "all" : "period");

    try {
      const exportRows = await fetchTimesheetsForExport({ ignorePeriod });

      if (!exportRows.length) {
        setErr("Nessun timesheet da esportare con i filtri attuali.");
        return;
      }

      const totalExportMinutes = exportRows.reduce((sum, row) => sum + (row.minutes || 0), 0);
      const periodLabel = ignorePeriod
        ? "Tutto lo storico"
        : `${formatDateIT(from)} - ${formatDateIT(to)}`;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 12;
      const logoDataUrl = await loadImageAsDataUrl(PDF_LOGO_PATH);
      const generatedAt = dayjs().format("DD/MM/YYYY HH:mm");

      const employeeLabel = getSelectedLabel(
        employees,
        employeeId,
        "Tutti i dipendenti",
        (x) => x.full_name
      );
      const cdlLabel = getSelectedLabel(cdl, cdlId, "Tutte le commesse", getCdlLabel);
      const lavLabel = getSelectedLabel(lavorazioni, lavId, "Tutte le lavorazioni", (x) => x.name);
      const searchLabel = q.trim() ? q.trim() : "Nessuna ricerca testuale";

      const totalsByEmployee = Object.values(
        exportRows.reduce((acc, row) => {
          const name = row.employees?.full_name || "Senza dipendente";
          if (!acc[name]) acc[name] = { name, count: 0, minutes: 0 };
          acc[name].count += 1;
          acc[name].minutes += row.minutes || 0;
          return acc;
        }, {})
      ).sort((a, b) => a.name.localeCompare(b.name));

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 36, "F");
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 34, pageWidth, 2, "F");

      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX, 7, 42, 19, 3, 3, "F");
        doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), marginX + 2, 9, 38, 15, undefined, "FAST");
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text("IDEALTECH", marginX, 18);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("Report Timesheet", 62, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`Esportato il ${generatedAt}`, 62, 22);
      doc.text(`Periodo: ${periodLabel}`, 62, 28);

      const cardY = 44;
      const cardW = (pageWidth - marginX * 2 - 18) / 4;
      const cards = [
        { label: "Record", value: String(exportRows.length), sub: "Timesheet esportati" },
        { label: "Ore totali", value: fmtMinutes(totalExportMinutes), sub: "Periodo esportato" },
        { label: "Dipendenti", value: String(totalsByEmployee.length), sub: "Con ore registrate" },
        { label: ignorePeriod ? "Archivio" : "Periodo", value: periodLabel, sub: ignorePeriod ? "Senza filtro data" : "Intervallo selezionato" },
      ];

      cards.forEach((card, index) => {
        const x = marginX + index * (cardW + 6);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, cardY, cardW, 24, 3, 3, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, cardY, cardW, 24, 3, 3, "S");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(card.label.toUpperCase(), x + 4, cardY + 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(card.value.length > 22 ? 10 : 14);
        doc.setTextColor(15, 23, 42);
        doc.text(card.value, x + 4, cardY + 15);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(card.sub, x + 4, cardY + 21);
      });

      autoTable(doc, {
        startY: 76,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        body: [
          ["Dipendente", employeeLabel, "Commessa", cdlLabel],
          ["Lavorazione", lavLabel, "Ricerca", searchLabel],
        ],
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 25 },
          1: { cellWidth: 110 },
          2: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 25 },
          3: { cellWidth: "auto" },
        },
      });

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 86) + 6,
        margin: { left: marginX, right: marginX },
        head: [["Riepilogo dipendente", "Record", "Ore totali"]],
        body: totalsByEmployee.map((x) => [x.name, String(x.count), fmtMinutes(x.minutes)]),
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.2,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { halign: "right", cellWidth: 25 },
          2: { halign: "right", cellWidth: 35, fontStyle: "bold" },
        },
        tableWidth: 160,
      });

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 116) + 8,
        margin: { top: 18, left: marginX, right: marginX, bottom: 18 },
        head: [["Data", "Dipendente", "Dalle", "Alle", "Totale", "Commessa", "Lavorazione", "Note"]],
        body: exportRows.map((row) => [
          formatDateIT(row.work_date),
          safeText(row.employees?.full_name),
          formatTime(row.start_time),
          formatTime(row.end_time),
          fmtMinutes(row.minutes || 0),
          getCdlLabel(row.cdl),
          safeText(row.lavorazioni?.name),
          safeText(row.note),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          cellPadding: 2.2,
        },
        styles: {
          font: "helvetica",
          fontSize: 7.4,
          cellPadding: 1.8,
          overflow: "linebreak",
          valign: "middle",
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 34 },
          2: { halign: "center", cellWidth: 14 },
          3: { halign: "center", cellWidth: 14 },
          4: { halign: "right", cellWidth: 20, fontStyle: "bold" },
          5: { cellWidth: 54 },
          6: { cellWidth: 40 },
          7: { cellWidth: "auto" },
        },
        didDrawPage: () => {
          const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;

          if (pageNumber > 1) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text("Report Timesheet", marginX, 10);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${periodLabel} · ${fmtMinutes(totalExportMinutes)}`, pageWidth - marginX, 10, {
              align: "right",
            });
          }

          drawPdfFooter(doc);
        },
      });

      const filename = ignorePeriod
        ? `timesheet_tutto_storico_${dayjs().format("YYYY-MM-DD")}.pdf`
        : `timesheet_${from || "inizio"}_${to || "fine"}.pdf`;
      doc.save(filename);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Errore durante la generazione del PDF");
    } finally {
      setExportingPdf(null);
    }
  }

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

          <button
            className="btn"
            type="button"
            onClick={() => exportTimesheetsPdf()}
            disabled={loading || !!exportingPdf || !filtered.length}
            title="Esporta in PDF i timesheet del periodo selezionato e dei filtri attuali"
          >
            {exportingPdf === "period" ? "Genero PDF..." : "Esporta PDF"}
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => exportTimesheetsPdf({ ignorePeriod: true })}
            disabled={loading || !!exportingPdf}
            title="Esporta tutto lo storico ignorando il filtro data, mantenendo gli altri filtri"
          >
            {exportingPdf === "all" ? "Genero tutto..." : "Esporta tutto"}
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