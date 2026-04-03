import { supabase } from "./supabase";

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchCdl() {
  const { data, error } = await supabase
    .from("cdl")
    .select("id, code, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchAllCdl() {
  const { data, error } = await supabase
    .from("cdl")
    .select("id, code, name, client, is_active")
    .order("is_active", { ascending: false })
    .order("code", { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchLavorazioni() {
  const { data, error } = await supabase
    .from("lavorazioni")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function insertTimesheet(payload) {
  const { data, error } = await supabase
    .from("timesheets")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function fetchTimesheets({ employeeId, from, to }) {
  let q = supabase
    .from("timesheets")
    .select(`
      id,
      employee_id,
      work_date,
      start_time,
      end_time,
      minutes,
      note,
      cdl_id,
      lavorazione_id,
      employees(full_name),
      cdl(id, code, name),
      lavorazioni(id, name)
    `)
    .order("work_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (employeeId) q = q.eq("employee_id", employeeId);
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function fetchTimesheetsLatest({ employeeId, limit = 10 }) {
  let q = supabase
    .from("timesheets")
    .select(`
      id,
      employee_id,
      work_date,
      start_time,
      end_time,
      minutes,
      note,
      cdl_id,
      lavorazione_id,
      employees(full_name),
      cdl(id, code, name),
      lavorazioni(id, name)
    `)
    .order("work_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(limit);

  if (employeeId) q = q.eq("employee_id", employeeId);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function updateTimesheet(id, patch) {
  const { data, error } = await supabase
    .from("timesheets")
    .update(patch)
    .eq("id", id)
    .select(`
      id,
      employee_id,
      work_date,
      start_time,
      end_time,
      minutes,
      note,
      cdl_id,
      lavorazione_id,
      employees(full_name),
      cdl(id, code, name),
      lavorazioni(id, name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTimesheet(id) {
  const { error } = await supabase
    .from("timesheets")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/* =========================
   FOGLI INTERVENTO
========================= */

function mapWorkRowsForDb(workRows = []) {
  return workRows
    .filter((row) => Object.values(row || {}).some(Boolean))
    .map((row) => ({
      work_date: row.date || null,
      travel_from: row.travel_from || "",
      travel_to: row.travel_to || "",
      work_from: row.work_from || "",
      work_to: row.work_to || "",
      quantity: row.quantity || null,
      code: row.code || "",
      description: row.description || "",
    }));
}

function mapMachinesForDb(machines = []) {
  return machines
    .filter((machine) => Object.values(machine || {}).some(Boolean))
    .map((machine) => ({
      model: machine.model || "",
      serial_number: machine.serial_number || "",
    }));
}

function extractReportFields(payload) {
  return {
    report_number: payload.report_number || null,
    report_date: payload.report_date || null,
    client_name: payload.client_name || "",
    city: payload.city || "",
    travel_meals: payload.travel_meals || "",
    car_km: payload.car_km || "",
    tolls: payload.tolls || "",
    overnight_stays: payload.overnight_stays || "",
    machine_order_number: payload.machine_order_number || "",
    tested_on: payload.tested_on || null,
    tested_with_positive_result:
      payload.tested_with_positive_result === true,
    technician_signature: payload.technician_signature || "",
    client_signature: payload.client_signature || "",
    notes: payload.notes || "",
    pdf_sent_at: payload.pdf_sent_at || null,
    pdf_file_name: payload.pdf_file_name || null,
  };
}

function mapReportFromDb(report) {
  return {
    ...report,
    work_rows: (report.intervention_report_items || []).map((row) => ({
      id: row.id,
      date: row.work_date || "",
      travel_from: row.travel_from || "",
      travel_to: row.travel_to || "",
      work_from: row.work_from || "",
      work_to: row.work_to || "",
      quantity: row.quantity || "",
      code: row.code || "",
      description: row.description || "",
    })),
    machines: (report.intervention_report_machines || []).map((machine) => ({
      id: machine.id,
      model: machine.model || "",
      serial_number: machine.serial_number || "",
    })),
  };
}

async function fetchSingleInterventionReport(id) {
  const { data, error } = await supabase
    .from("intervention_reports")
    .select(`
      *,
      intervention_report_items (
        id,
        report_id,
        work_date,
        travel_from,
        travel_to,
        work_from,
        work_to,
        quantity,
        code,
        description
      ),
      intervention_report_machines (
        id,
        report_id,
        model,
        serial_number
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return mapReportFromDb(data);
}

export async function fetchInterventionReports() {
  const { data, error } = await supabase
    .from("intervention_reports")
    .select(`
      *,
      intervention_report_items (
        id,
        report_id,
        work_date,
        travel_from,
        travel_to,
        work_from,
        work_to,
        quantity,
        code,
        description
      ),
      intervention_report_machines (
        id,
        report_id,
        model,
        serial_number
      )
    `)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapReportFromDb);
}

export async function createInterventionReport(payload) {
  const reportFields = extractReportFields(payload);

  const { data: report, error: reportError } = await supabase
    .from("intervention_reports")
    .insert([reportFields])
    .select("*")
    .single();

  if (reportError) throw reportError;

  const workRows = mapWorkRowsForDb(payload.work_rows).map((row) => ({
    ...row,
    report_id: report.id,
  }));

  const machines = mapMachinesForDb(payload.machines).map((machine) => ({
    ...machine,
    report_id: report.id,
  }));

  if (workRows.length) {
    const { error: itemsError } = await supabase
      .from("intervention_report_items")
      .insert(workRows);

    if (itemsError) throw itemsError;
  }

  if (machines.length) {
    const { error: machinesError } = await supabase
      .from("intervention_report_machines")
      .insert(machines);

    if (machinesError) throw machinesError;
  }

  return await fetchSingleInterventionReport(report.id);
}

export async function updateInterventionReport(id, patch) {
  const reportFields = extractReportFields(patch);

  const { error: reportError } = await supabase
    .from("intervention_reports")
    .update(reportFields)
    .eq("id", id);

  if (reportError) throw reportError;

  const { error: deleteItemsError } = await supabase
    .from("intervention_report_items")
    .delete()
    .eq("report_id", id);

  if (deleteItemsError) throw deleteItemsError;

  const { error: deleteMachinesError } = await supabase
    .from("intervention_report_machines")
    .delete()
    .eq("report_id", id);

  if (deleteMachinesError) throw deleteMachinesError;

  const workRows = mapWorkRowsForDb(patch.work_rows).map((row) => ({
    ...row,
    report_id: id,
  }));

  const machines = mapMachinesForDb(patch.machines).map((machine) => ({
    ...machine,
    report_id: id,
  }));

  if (workRows.length) {
    const { error: itemsError } = await supabase
      .from("intervention_report_items")
      .insert(workRows);

    if (itemsError) throw itemsError;
  }

  if (machines.length) {
    const { error: machinesError } = await supabase
      .from("intervention_report_machines")
      .insert(machines);

    if (machinesError) throw machinesError;
  }

  return await fetchSingleInterventionReport(id);
}

export async function deleteInterventionReport(id) {
  const { error } = await supabase
    .from("intervention_reports")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function fetchNextInterventionReportNumber() {
  const { data, error } = await supabase.rpc("generate_intervention_report_number");

  if (error) throw error;
  return data;
}