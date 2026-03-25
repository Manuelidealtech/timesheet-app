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
      work_date,
      start_time,
      end_time,
      minutes,
      note,
      employees(full_name),
      cdl(code, name),
      lavorazioni(name)
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
      work_date,
      start_time,
      end_time,
      minutes,
      note,
      employees(full_name),
      cdl(code, name),
      lavorazioni(name)
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
      work_date,
      start_time,
      end_time,
      minutes,
      note,
      employees(full_name),
      cdl(code, name),
      lavorazioni(name)
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