import { jsPDF } from "jspdf";

function safe(value) {
  return value == null || value === "" ? "—" : String(value);
}

function drawLabelValue(doc, label, value, x, y, labelWidth = 42) {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(safe(value), x + labelWidth, y);
}

function ensurePage(doc, cursorY, needed = 12) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + needed < pageHeight - 18) return cursorY;
  doc.addPage();
  return 18;
}

function normalizePdfData(source = {}) {
  const tested =
    source.tested === true ||
    Boolean(source.tested_on) ||
    source.tested_result === "Positivo" ||
    source.tested_result === "Negativo";

  return {
    ...source,
    meals: source.travel_meals ?? source.meals ?? "",
    km_auto: source.car_km ?? source.km_auto ?? "",
    tolls: source.tolls ?? "",
    overnight_stays: source.overnight_stays ?? "",
    tested,
    tested_on: source.tested_on ?? source.tested_date ?? "",
    tested_result:
      source.tested_result ??
      (source.tested_with_positive_result
        ? "Positivo"
        : tested
        ? "Negativo"
        : "Non eseguito"),
  };
}

async function loadLogoAsDataUrl(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildInterventionPdf(report) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const data = normalizePdfData(report);

  const marginX = 14;
  let y = 16;

  const logoDataUrl = await loadLogoAsDataUrl("/logo-idealtech.png");

  // --- HEADER ALTO ---
  const logoX = 14;
  const logoY = 10;
  const logoW = 58;
  const logoH = 18;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 60, 15);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text("IDEALTECH", logoX, 18);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Foglio di prestazione d'opera", logoX, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Nr. ${safe(data.report_number)}`, pageWidth - 58, 18);

  doc.setFont("helvetica", "normal");
  doc.text(`Data ${safe(data.report_date)}`, pageWidth - 58, 25);

  // spazio sotto header
  y = 42;

  // --- BLOCCO DATI PRINCIPALI ---
doc.roundedRect(12, y - 6, pageWidth - 24, 40, 3, 3);

// Riga 1
drawLabelValue(doc, "Cliente", data.client_name, 18, y + 2, 24);
drawLabelValue(doc, "Città", data.city, 108, y + 2, 18);

// Riga 2
drawLabelValue(doc, "Pasti", data.meals, 18, y + 14, 24);
drawLabelValue(doc, "Km auto", data.km_auto, 58, y + 14, 24);

// Riga 3
drawLabelValue(doc, "Autostrade", data.tolls, 18, y + 26, 26);
drawLabelValue(doc, "Pernottamenti", data.overnight_stays, 108, y + 26, 30);

y += 44;

  // --- RIGHE LAVORO ---
doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.text("Righe lavoro e ricambi", marginX, y);
y += 6;

const workRows =
  Array.isArray(data.work_rows) && data.work_rows.length ? data.work_rows : [];

const rowsToRender = workRows.length ? workRows : [{}];

rowsToRender.forEach((row, index) => {
  y = ensurePage(doc, y, 28);

  const boxX = 14;
  const boxW = pageWidth - 28;
  const boxH = 24;

  doc.roundedRect(boxX, y - 4, boxW, boxH, 3, 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Riga ${index + 1}`, 18, y + 1);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  drawLabelValue(doc, "Data", row.date ?? row.work_date, 18, y + 8, 14);
  drawLabelValue(
    doc,
    "Viaggio",
    `${safe(row.travel_from)} - ${safe(row.travel_to)}`,
    62,
    y + 8,
    16
  );
  drawLabelValue(
    doc,
    "Lavoro",
    `${safe(row.work_from)} - ${safe(row.work_to)}`,
    118,
    y + 8,
    14
  );

  drawLabelValue(doc, "Q.tà", row.quantity, 18, y + 16, 14);
  drawLabelValue(doc, "Codice", row.code, 46, y + 16, 16);

  doc.setFont("helvetica", "bold");
  doc.text("Descrizione", 90, y + 16);
  doc.setFont("helvetica", "normal");

  const description = doc.splitTextToSize(safe(row.description), 88);
  doc.text(description.slice(0, 2), 118, y + 16);

  y += 28;
});

  // --- MACCHINE ---
  y += 6;
  y = ensurePage(doc, y, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Macchine", marginX, y);
  y += 6;

  const machines =
    Array.isArray(data.machines) && data.machines.length ? data.machines : [];

  if (!machines.length) {
    doc.setFont("helvetica", "normal");
    doc.text("—", 18, y);
    y += 8;
  } else {
    machines.forEach((machine, index) => {
      y = ensurePage(doc, y, 14);
      doc.roundedRect(14, y - 4, pageWidth - 28, 12, 2, 2);
      drawLabelValue(doc, `Macchina ${index + 1}`, machine.model, 18, y + 1, 24);
      drawLabelValue(doc, "Nr serie", machine.serial_number, pageWidth / 2 + 2, y + 1, 20);
      y += 14;
    });
  }

  // --- ANNOTAZIONI ---
  y += 2;
  y = ensurePage(doc, y, 44);

  doc.setFont("helvetica", "bold");
  doc.text("Annotazioni", marginX, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.roundedRect(14, y, pageWidth - 28, 38, 2, 2);

  const notes = doc.splitTextToSize(safe(data.notes), pageWidth - 34);
  doc.text(notes, 17, y + 6);

  // --- COLLAUDO E FIRME ---
  y += 46;
  y = ensurePage(doc, y, 28);

  doc.roundedRect(14, y - 4, pageWidth - 28, 24, 3, 3);
  drawLabelValue(doc, "Collaudata", data.tested ? "Sì" : "No", 18, y + 2, 24);
  drawLabelValue(doc, "Data", data.tested_on, 72, y + 2, 14);
  drawLabelValue(
    doc,
    "Esito",
    data.tested ? data.tested_result : "Non eseguito",
    120,
    y + 2,
    16
  );
  drawLabelValue(doc, "Firma incaricato", data.technician_signature, 18, y + 10, 34);
  drawLabelValue(doc, "Firma cliente", data.client_signature, 120, y + 10, 28);

  // --- FOOTER ---
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "Via Sondrio n. 11 - 20814 Varedo (MB) • Tel. 0362/543041 • info@idealtech.it",
    14,
    288
  );

  return doc;
}

export function downloadInterventionPdf(doc, fileName) {
  doc.save(fileName);
}