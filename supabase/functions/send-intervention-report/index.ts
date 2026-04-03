import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type MachineRow = {
  model?: string;
  serial_number?: string;
};

type ItemRow = {
  work_date?: string;
  travel_from?: string;
  travel_to?: string;
  work_from?: string;
  work_to?: string;
  quantity?: number | string;
  code?: string;
  description?: string;
};

type ReportPayload = {
  reportId?: string;
  report_number?: string;
  report_date?: string;
  client_name?: string;
  city?: string;
  travel_meals?: string;
  car_km?: string;
  tolls?: string;
  overnight_stays?: string;
  machine_order_number?: string;
  tested_on?: string;
  tested_with_positive_result?: boolean;
  technician_signature?: string;
  client_signature?: string;
  notes?: string;
  machines?: MachineRow[];
  items?: ItemRow[];
};

function safe(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function formatDate(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("it-IT");
}

function drawLabelValue(
  page: any,
  label: string,
  value: string,
  x: number,
  y: number,
  labelFont: any,
  valueFont: any,
  size = 10
) {
  page.drawText(label, {
    x,
    y,
    size,
    font: labelFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(value || "-", {
    x: x + 110,
    y,
    size,
    font: valueFont,
    color: rgb(0, 0, 0),
  });
}

async function buildPdf(data: ReportPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 36;
  let y = height - margin;

  const ensureSpace = (needed = 24) => {
    if (y < 80 + needed) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
  };

  const line = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = opts?.size ?? 10;
    const font = opts?.bold ? fontBold : fontRegular;
    ensureSpace(size + 8);
    page.drawText(text, {
      x: margin,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    y -= opts?.gap ?? size + 6;
  };

  const section = (title: string) => {
    ensureSpace(28);
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: width - margin * 2,
      height: 20,
      color: rgb(0.92, 0.92, 0.92),
    });
    page.drawText(title, {
      x: margin + 8,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 28;
  };

  const wrappedText = (
    text: string,
    x: number,
    maxWidth: number,
    size = 10,
    lineHeight = 13
  ) => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    if (!words.length) {
      page.drawText("-", { x, y, size, font: fontRegular, color: rgb(0, 0, 0) });
      y -= lineHeight;
      return;
    }

    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const testWidth = fontRegular.widthOfTextAtSize(test, size);
      if (testWidth > maxWidth && current) {
        ensureSpace(lineHeight + 4);
        page.drawText(current, {
          x,
          y,
          size,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
        current = word;
      } else {
        current = test;
      }
    }

    if (current) {
      ensureSpace(lineHeight + 4);
      page.drawText(current, {
        x,
        y,
        size,
        font: fontRegular,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
  };

  page.drawText("IDEALTECH - FOGLIO INTERVENTO", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 26;

  line("Via Sondrio n. 11 - 20814 Varedo (MB) | Tel. 0362/543041 | info@idealtech.it", {
    size: 9,
    gap: 18,
  });

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 18;

  section("DATI PRINCIPALI");
  drawLabelValue(page, "Cliente:", safe(data.client_name), margin, y, fontBold, fontRegular);
  y -= 18;
  drawLabelValue(page, "Città:", safe(data.city), margin, y, fontBold, fontRegular);
  y -= 18;
  drawLabelValue(
    page,
    "Nr. foglio:",
    safe(data.report_number),
    margin,
    y,
    fontBold,
    fontRegular
  );
  y -= 18;
  drawLabelValue(
    page,
    "Data:",
    formatDate(data.report_date),
    margin,
    y,
    fontBold,
    fontRegular
  );
  y -= 22;

  section("SPESE E TRASFERTE");
  drawLabelValue(page, "Pasti:", safe(data.travel_meals), margin, y, fontBold, fontRegular);
  y -= 18;
  drawLabelValue(page, "KM auto:", safe(data.car_km), margin, y, fontBold, fontRegular);
  y -= 18;
  drawLabelValue(page, "Autostrade:", safe(data.tolls), margin, y, fontBold, fontRegular);
  y -= 18;
  drawLabelValue(
    page,
    "Pernottamenti:",
    safe(data.overnight_stays),
    margin,
    y,
    fontBold,
    fontRegular
  );
  y -= 22;

  section("MACCHINE");
  const machines = Array.isArray(data.machines) ? data.machines : [];
  if (!machines.length) {
    line("Nessuna macchina inserita.");
  } else {
    machines.forEach((m, index) => {
      ensureSpace(30);
      line(
        `${index + 1}. Modello: ${safe(m.model) || "-"}   |   Nr. serie: ${safe(
          m.serial_number
        ) || "-"}`,
        { size: 10 }
      );
    });
  }
  y -= 6;

  section("RIGHE INTERVENTO / RICAMBI");
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    line("Nessuna riga inserita.");
  } else {
    items.forEach((item, index) => {
      ensureSpace(60);
      line(`Riga ${index + 1}`, { bold: true });
      line(
        `Data: ${formatDate(item.work_date)} | Viaggio: ${safe(item.travel_from)}-${safe(
          item.travel_to
        )} | Lavoro: ${safe(item.work_from)}-${safe(item.work_to)}`
      );
      line(
        `Q.tà: ${safe(item.quantity)} | Codice: ${safe(item.code)} | Descrizione: ${safe(
          item.description
        )}`
      );
      y -= 4;
    });
  }

  section("COLLAUDO");
  drawLabelValue(
    page,
    "Nr. ordine macchina:",
    safe(data.machine_order_number),
    margin,
    y,
    fontBold,
    fontRegular
  );
  y -= 18;
  drawLabelValue(
    page,
    "Collaudata il:",
    formatDate(data.tested_on),
    margin,
    y,
    fontBold,
    fontRegular
  );
  y -= 18;
  drawLabelValue(
    page,
    "Esito positivo:",
    data.tested_with_positive_result ? "Sì" : "No",
    margin,
    y,
    fontBold,
    fontRegular
  );
  y -= 22;

  section("ANNOTAZIONI");
  wrappedText(safe(data.notes) || "-", margin, width - margin * 2, 10, 13);
  y -= 10;

  section("FIRME");
  line(`Firma incaricato Idealtech: ${safe(data.technician_signature) || "-"}`);
  line(`Firma cliente: ${safe(data.client_signature) || "-"}`);

  return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: corsHeaders }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const reportRecipient =
      Deno.env.get("REPORT_RECIPIENT") || "lucia.bisceglia@idealtech.it";
    const mailFrom = Deno.env.get("MAIL_FROM");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Secret RESEND_API_KEY non configurato",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!mailFrom) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Secret MAIL_FROM non configurato",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body: ReportPayload = await req.json();

    if (!safe(body.client_name)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campo client_name obbligatorio",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const pdfBytes = await buildPdf(body);

    const base64Pdf = btoa(
      Array.from(pdfBytes, (byte) => String.fromCharCode(byte)).join("")
    );

    const reportNumber = safe(body.report_number) || "SENZA-NUMERO";
    const reportDate = formatDate(body.report_date) || "-";
    const clientName = safe(body.client_name);

    const emailPayload = {
      from: mailFrom,
      to: [reportRecipient],
      subject: `Foglio intervento ${reportNumber} - ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Nuovo foglio intervento compilato</h2>
          <p><strong>Cliente:</strong> ${clientName}</p>
          <p><strong>Città:</strong> ${safe(body.city) || "-"}</p>
          <p><strong>Numero foglio:</strong> ${reportNumber}</p>
          <p><strong>Data:</strong> ${reportDate}</p>
          <p><strong>Note:</strong> ${safe(body.notes) || "-"}</p>
          <p>In allegato trovi il PDF del foglio intervento.</p>
        </div>
      `,
      attachments: [
        {
          filename: `foglio-intervento-${reportNumber}.pdf`,
          content: base64Pdf,
        },
      ],
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invio email fallito",
          details: resendResult,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email inviata correttamente",
        recipient: reportRecipient,
        resend: resendResult,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});