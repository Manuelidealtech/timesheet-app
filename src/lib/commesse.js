import { supabase } from './supabase';

export async function fetchCommessaDocumentStatus() {
  const { data, error } = await supabase
    .from('commessa_document_status')
    .select(`
      id,
      cdl_id,
      commessa_folder,
      commessa_code,
      commessa_name,
      client,
      completion_percentage,
      completed_folders,
      expected_folders,
      total_files,
      folder_status,
      scanned_at,
      scan_error
    `)
    .order('completion_percentage', { ascending: true })
    .order('commessa_code', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function requestCommessaScan() {
  const { data, error } = await supabase
    .from('commessa_scan_requests')
    .insert({ status: 'pending' })
    .select('id, requested_at, status')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchLatestCommessaScanRequest() {
  const { data, error } = await supabase
    .from('commessa_scan_requests')
    .select('id, requested_at, status, processed_at, error_message')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}
