import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex <= 0) continue;
      const key = trimmed.slice(0, equalIndex).trim();
      let value = trimmed.slice(equalIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await loadEnvFile(path.join(PROJECT_ROOT, '.env'));
await loadEnvFile(path.join(__dirname, '.env.commesse'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMMESSE_ROOT_PATH = process.env.COMMESSE_ROOT_PATH;
const SCAN_INTERVAL_MINUTES = positiveNumber(process.env.COMMESSE_SCAN_INTERVAL_MINUTES, 15);
const REQUEST_POLL_SECONDS = positiveNumber(process.env.COMMESSE_REQUEST_POLL_SECONDS, 10);
const MAX_DEPTH = Math.max(1, Math.floor(positiveNumber(process.env.COMMESSE_SCAN_MAX_DEPTH, 12)));
const RUN_ONCE = process.argv.includes('--once');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !COMMESSE_ROOT_PATH) {
  console.error('\nConfigurazione incompleta. Crea server/.env.commesse partendo da server/.env.commesse.example.');
  console.error('Servono SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e COMMESSE_ROOT_PATH.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXPECTED_FOLDERS = [
  { key: '00', folder: '00_Ordine e scheda lavorazione', label: 'Ordine e scheda lavorazione' },
  { key: '10', folder: '10_Distinte', label: 'Distinte' },
  { key: '20', folder: '20_Disegni meccanici', label: 'Disegni meccanici' },
  { key: '30', folder: '30_Programmi', label: 'Programmi' },
  { key: '40', folder: '40_Foto', label: 'Foto' },
  { key: '50', folder: '50_Schemi elettrici', label: 'Schemi elettrici' },
  { key: '60', folder: '60_Manuali', label: 'Manuali' },
  { key: '70', folder: '70_Scheda di Collaudo', label: 'Scheda di Collaudo' },
  { key: '80', folder: '80_Gantt', label: 'Gantt' },
  { key: '90', folder: '90_Certificati', label: 'Certificati' },
  { key: '100', folder: '100_Scheda Costi', label: 'Scheda Costi' },
];

// Cartelle tecniche presenti nella root che NON sono commesse.
// Restano escluse anche se in futuro dovessero cambiare altre regole di riconoscimento.
const IGNORED_ROOT_FOLDERS = new Set([
  'costi',
  '01_directory di base da copiare',
]);

function isCommessaRootFolder(entry) {
  if (!entry.isDirectory()) return false;

  const folderName = String(entry.name || '').trim();
  if (!folderName || folderName.startsWith('.')) return false;

  // Esclusioni esplicite delle cartelle tecniche.
  if (IGNORED_ROOT_FOLDERS.has(folderName.toLowerCase())) return false;

  // Le commesse aziendali valide iniziano con un codice di 4 cifre
  // (es. "0631 (2633-2026) LINEA TRAPPOLE TOPI - ZAPI").
  return /^\d{4}(?=\s|\(|-|_|$)/.test(folderName);
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCommessaFolder(folderName) {
  const trimmed = String(folderName || '').trim();
  const codeMatch = trimmed.match(/^([^\s(]+)/);
  const code = codeMatch?.[1] || '';

  let name = trimmed;
  if (code) name = name.slice(code.length).trim();
  name = name.replace(/^\([^)]*\)\s*/, '').trim();
  name = name.replace(/^[-–—]+\s*/, '').trim();

  const dashParts = name.split(/\s+-\s+/);
  const client = dashParts.length > 1 ? dashParts[dashParts.length - 1].trim() : null;

  return {
    code: code || null,
    name: name || trimmed,
    client,
  };
}

function isPlaceholderCommessaCode(code) {
  return normalize(code) === '0000';
}

function revisionInternalCode(folderName) {
  const hash = createHash('md5')
    .update(normalize(folderName))
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `REV-${hash}`;
}

function isRevisionCdlRow(row) {
  const code = String(row?.code || '').trim();
  const name = String(row?.name || '').trim();
  return /^revisione\b/i.test(name) || code === '0000' || /^REV-/i.test(code);
}

function findMatchingCdl(folderName, parsed, cdlRows) {
  const parsedCode = normalize(parsed.code);
  const parsedName = normalize(parsed.name);

  // REGOLA FONDAMENTALE:
  // per una commessa normale il codice a 4 cifre e' l'identificativo univoco.
  // Non facciamo MAI fallback sul nome: due commesse diverse possono avere la
  // stessa descrizione/macchina (es. 0638 e 0639 = ISOTEX - DRUM 200).
  // Il vecchio fallback sul nome le collegava erroneamente alla CDL 5096 DRUM 200.
  if (parsedCode && !isPlaceholderCommessaCode(parsed.code)) {
    return cdlRows.find((row) => normalize(row.code) === parsedCode) || null;
  }

  // Le revisioni senza numero commessa usano 0000 solo come prefisso cartella.
  // In CDL hanno un codice tecnico REV-XXXXXXXX stabile e univoco.
  if (isPlaceholderCommessaCode(parsed.code)) {
    const expectedRevisionCode = normalize(revisionInternalCode(folderName));
    const exactRevisionCode = cdlRows.find(
      (row) => normalize(row.code) === expectedRevisionCode,
    );
    if (exactRevisionCode) return exactRevisionCode;

    // Compatibilita' con eventuali revisioni legacy gia' presenti nel DB:
    // il match per nome e' consentito SOLO tra righe riconosciute come revisione.
    return cdlRows.find(
      (row) => isRevisionCdlRow(row) && parsedName && normalize(row.name) === parsedName,
    ) || null;
  }

  return null;
}

function findExpectedDirectory(expected, directoryNames) {
  const exact = directoryNames.find((name) => normalize(name) === normalize(expected.folder));
  if (exact) return exact;

  const prefixPattern = new RegExp(`^${expected.key}(?:_|\\s|-)`, 'i');
  return directoryNames.find((name) => prefixPattern.test(name.trim())) || null;
}

function isIgnoredFile(fileName) {
  const name = String(fileName || '').toLowerCase();
  return name === 'thumbs.db'
    || name === 'desktop.ini'
    || name === '.ds_store'
    || name.startsWith('~$');
}

async function scanFilesRecursive(folderPath, depth = 0) {
  let entries;
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch (error) {
    return {
      fileCount: 0,
      lastModified: null,
      error: error?.code || error?.message || 'Errore lettura cartella',
    };
  }

  let fileCount = 0;
  let lastModifiedMs = 0;
  let firstError = null;

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isFile()) {
      if (isIgnoredFile(entry.name)) continue;
      fileCount += 1;
      try {
        const stat = await fs.stat(entryPath);
        lastModifiedMs = Math.max(lastModifiedMs, stat.mtimeMs || 0);
      } catch (error) {
        firstError ||= error?.code || error?.message || 'Errore lettura file';
      }
      continue;
    }

    if (entry.isDirectory() && depth < MAX_DEPTH) {
      const child = await scanFilesRecursive(entryPath, depth + 1);
      fileCount += child.fileCount;
      if (child.lastModified) {
        lastModifiedMs = Math.max(lastModifiedMs, new Date(child.lastModified).getTime());
      }
      firstError ||= child.error;
    }
  }

  return {
    fileCount,
    lastModified: lastModifiedMs ? new Date(lastModifiedMs).toISOString() : null,
    error: firstError,
  };
}

async function scanExpectedFolders(commessaPath) {
  let rootEntries;
  try {
    rootEntries = await fs.readdir(commessaPath, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Impossibile leggere ${commessaPath}: ${error?.message || error}`);
  }

  const directoryNames = rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const statuses = [];

  // Poche scansioni contemporanee per non saturare il file server.
  const concurrency = 3;
  for (let index = 0; index < EXPECTED_FOLDERS.length; index += concurrency) {
    const batch = EXPECTED_FOLDERS.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map(async (expected) => {
      const actualFolder = findExpectedDirectory(expected, directoryNames);
      if (!actualFolder) {
        return {
          key: expected.key,
          label: expected.label,
          expectedFolder: expected.folder,
          actualFolder: null,
          exists: false,
          hasFiles: false,
          fileCount: 0,
          lastModified: null,
          error: null,
        };
      }

      const result = await scanFilesRecursive(path.join(commessaPath, actualFolder));
      return {
        key: expected.key,
        label: expected.label,
        expectedFolder: expected.folder,
        actualFolder,
        exists: true,
        hasFiles: result.fileCount > 0,
        fileCount: result.fileCount,
        lastModified: result.lastModified,
        error: result.error,
      };
    }));
    statuses.push(...batchResults);
  }

  return statuses;
}

async function getCdlRows() {
  const { data, error } = await supabase
    .from('cdl')
    .select('id, code, name, client, is_active');
  if (error) throw new Error(`Lettura tabella cdl fallita: ${error.message}`);
  return data || [];
}

// Mantiene la tabella CDL allineata alle cartelle commessa realmente presenti sul file server.
// In questo modo il menu a tendina del timesheet usa la stessa sorgente della Gestione Commesse:
// se compare una nuova cartella (es. 0631), viene creata/riattivata automaticamente anche in CDL.
async function syncCdlFromCommessaFolders(commessaFolders) {
  const cdlRows = await getCdlRows();
  let inserted = 0;
  let reactivated = 0;
  let enriched = 0;

  for (const folderName of commessaFolders) {
    const parsed = parseCommessaFolder(folderName);
    let matched = findMatchingCdl(folderName, parsed, cdlRows);

    if (!matched) {
      // Le revisioni usano 0000 solo come prefisso sul file server.
      // In CDL assegniamo un codice tecnico univoco e stabile (REV-XXXXXXXX):
      // evita qualunque conflitto UNIQUE/NOT NULL su cdl.code e permette di
      // avere un numero illimitato di revisioni senza numero commessa reale.
      const payload = {
        code: isPlaceholderCommessaCode(parsed.code) ? revisionInternalCode(folderName) : parsed.code,
        name: parsed.name,
        client: parsed.client,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('cdl')
        .insert(payload)
        .select('id, code, name, client, is_active')
        .single();

      if (error) {
        throw new Error(`Creazione CDL ${folderName} fallita: ${error.message}`);
      }

      cdlRows.push(data);
      inserted += 1;
      continue;
    }

    const patch = {};

    if (matched.is_active !== true) {
      patch.is_active = true;
    }

    // Se e' una revisione, normalizziamo sempre il codice tecnico in modo
    // deterministico. Questo ripara automaticamente vecchi record con 0000 o NULL.
    if (isPlaceholderCommessaCode(parsed.code)) {
      const expectedRevisionCode = revisionInternalCode(folderName);
      if (String(matched.code || '').trim() !== expectedRevisionCode) {
        patch.code = expectedRevisionCode;
      }
    }

    // Completa solo eventuali dati mancanti senza sovrascrivere descrizioni
    // che potrebbero essere state personalizzate manualmente in anagrafica.
    if (!isPlaceholderCommessaCode(parsed.code) && !String(matched.code || '').trim() && parsed.code) {
      patch.code = parsed.code;
    }
    if (!String(matched.name || '').trim() && parsed.name) {
      patch.name = parsed.name;
    }
    if (!String(matched.client || '').trim() && parsed.client) {
      patch.client = parsed.client;
    }

    if (Object.keys(patch).length) {
      const { data, error } = await supabase
        .from('cdl')
        .update(patch)
        .eq('id', matched.id)
        .select('id, code, name, client, is_active')
        .single();

      if (error) {
        throw new Error(`Aggiornamento CDL ${folderName} fallito: ${error.message}`);
      }

      const index = cdlRows.findIndex((row) => row.id === matched.id);
      if (index >= 0) cdlRows[index] = data;
      matched = data;

      if (patch.is_active === true) reactivated += 1;
      if (Object.keys(patch).some((key) => key !== 'is_active')) enriched += 1;
    }
  }

  const revisionFolders = commessaFolders.filter((folderName) => isPlaceholderCommessaCode(parseCommessaFolder(folderName).code)).length;

  // Rilettura finale dal database: la lista usata da Gestione Commesse e quella
  // resa disponibile ai Timesheet derivano esattamente dallo stesso stato persistito.
  const persistedRows = await getCdlRows();
  const persistedRevisions = persistedRows.filter(isRevisionCdlRow);

  if (inserted || reactivated || enriched || revisionFolders) {
    console.log(`  Sincronizzazione CDL: ${inserted} create, ${reactivated} riattivate, ${enriched} aggiornate, ${revisionFolders} revisioni cartella, ${persistedRevisions.length} revisioni disponibili nei Timesheet.`);
    for (const row of persistedRevisions) {
      console.log(`    REV -> id=${row.id} | ${row.code || 'senza codice'} | ${row.name}`);
    }
  }

  return persistedRows;
}

async function upsertCommessaStatus(folderName, cdlRows) {
  const commessaPath = path.join(COMMESSE_ROOT_PATH, folderName);
  const parsed = parseCommessaFolder(folderName);
  const matchedCdl = findMatchingCdl(folderName, parsed, cdlRows);

  try {
    const folderStatus = await scanExpectedFolders(commessaPath);
    const completedFolders = folderStatus.filter((item) => item.hasFiles).length;
    const totalFiles = folderStatus.reduce((sum, item) => sum + Number(item.fileCount || 0), 0);
    const completionPercentage = Math.round((completedFolders / EXPECTED_FOLDERS.length) * 100);

    const payload = {
      cdl_id: matchedCdl?.id ?? null,
      commessa_folder: folderName,
      commessa_code: matchedCdl?.code || parsed.code,
      commessa_name: matchedCdl?.name || parsed.name,
      client: matchedCdl?.client || parsed.client,
      completion_percentage: completionPercentage,
      completed_folders: completedFolders,
      expected_folders: EXPECTED_FOLDERS.length,
      total_files: totalFiles,
      folder_status: folderStatus,
      scanned_at: new Date().toISOString(),
      scan_error: null,
    };

    const { error } = await supabase
      .from('commessa_document_status')
      .upsert(payload, { onConflict: 'commessa_folder' });
    if (error) throw error;

    console.log(`  ${folderName}: ${completedFolders}/${EXPECTED_FOLDERS.length} (${completionPercentage}%)`);
  } catch (error) {
    const payload = {
      cdl_id: matchedCdl?.id ?? null,
      commessa_folder: folderName,
      commessa_code: matchedCdl?.code || parsed.code,
      commessa_name: matchedCdl?.name || parsed.name,
      client: matchedCdl?.client || parsed.client,
      completion_percentage: 0,
      completed_folders: 0,
      expected_folders: EXPECTED_FOLDERS.length,
      total_files: 0,
      folder_status: [],
      scanned_at: new Date().toISOString(),
      scan_error: error?.message || String(error),
    };

    const { error: dbError } = await supabase
      .from('commessa_document_status')
      .upsert(payload, { onConflict: 'commessa_folder' });
    if (dbError) throw dbError;
    console.error(`  ${folderName}: ERRORE - ${payload.scan_error}`);
  }
}

async function removeStaleRows(currentFolderNames) {
  const { data, error } = await supabase
    .from('commessa_document_status')
    .select('id, commessa_folder');
  if (error) throw error;

  const current = new Set(currentFolderNames);
  const staleIds = (data || []).filter((row) => !current.has(row.commessa_folder)).map((row) => row.id);
  if (!staleIds.length) return;

  const { error: deleteError } = await supabase
    .from('commessa_document_status')
    .delete()
    .in('id', staleIds);
  if (deleteError) throw deleteError;
  console.log(`  Rimossi ${staleIds.length} record di cartelle non piu presenti.`);
}

async function scanAllCommesse(reason = 'automatico') {
  const started = Date.now();
  console.log(`\n[${new Date().toLocaleString('it-IT')}] Scansione commesse (${reason})`);
  console.log(`Root: ${COMMESSE_ROOT_PATH}`);

  const entries = await fs.readdir(COMMESSE_ROOT_PATH, { withFileTypes: true });
  const commessaFolders = entries
    .filter(isCommessaRootFolder)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' }));

  // Prima allineiamo l'anagrafica CDL alle cartelle reali del server.
  // La stessa lista alimenta poi sia Gestione Commesse sia i menu Timesheet.
  const cdlRows = await syncCdlFromCommessaFolders(commessaFolders);

  for (const folderName of commessaFolders) {
    await upsertCommessaStatus(folderName, cdlRows);
  }

  await removeStaleRows(commessaFolders);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Scansione completata: ${commessaFolders.length} commesse in ${seconds}s.\n`);
  return commessaFolders.length;
}

async function processPendingRequests() {
  const { data, error } = await supabase
    .from('commessa_scan_requests')
    .select('id')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });

  if (error) throw error;
  const ids = (data || []).map((row) => row.id);
  if (!ids.length) return false;

  await supabase.from('commessa_scan_requests').update({ status: 'running', error_message: null }).in('id', ids);

  try {
    await scanAllCommesse('richiesta admin');
    await supabase
      .from('commessa_scan_requests')
      .update({ status: 'completed', processed_at: new Date().toISOString(), error_message: null })
      .in('id', ids);
  } catch (error) {
    const message = error?.message || String(error);
    await supabase
      .from('commessa_scan_requests')
      .update({ status: 'failed', processed_at: new Date().toISOString(), error_message: message })
      .in('id', ids);
    console.error('Scansione richiesta fallita:', message);
  }

  return true;
}

let scanRunning = false;
async function safeScan(reason) {
  if (scanRunning) return;
  scanRunning = true;
  try {
    await scanAllCommesse(reason);
  } catch (error) {
    console.error('Scansione fallita:', error?.message || error);
  } finally {
    scanRunning = false;
  }
}

async function safeProcessRequests() {
  if (scanRunning) return;
  scanRunning = true;
  try {
    await processPendingRequests();
  } catch (error) {
    console.error('Controllo richieste fallito:', error?.message || error);
  } finally {
    scanRunning = false;
  }
}

if (RUN_ONCE) {
  try {
    await scanAllCommesse('manuale --once');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

console.log('Agent Gestione Commesse avviato.');
console.log(`Scansione automatica ogni ${SCAN_INTERVAL_MINUTES} minuti; richieste admin ogni ${REQUEST_POLL_SECONDS} secondi.`);

await safeScan('avvio agent');
setInterval(() => safeProcessRequests(), REQUEST_POLL_SECONDS * 1000);
setInterval(() => safeScan('automatico'), SCAN_INTERVAL_MINUTES * 60 * 1000);
