import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCommessaDocumentStatus,
  fetchLatestCommessaScanRequest,
  requestCommessaScan,
} from '../../lib/commesse';

const FILTERS = [
  { value: 'all', label: 'Tutte' },
  { value: 'complete', label: 'Complete' },
  { value: 'almost', label: 'Quasi complete' },
  { value: 'attention', label: 'Da completare' },
  { value: 'critical', label: 'Critiche' },
];

function severityFor(value) {
  const percentage = Number(value || 0);
  if (percentage >= 100) return { key: 'complete', label: 'Completa' };
  if (percentage >= 80) return { key: 'almost', label: 'Quasi completa' };
  if (percentage >= 50) return { key: 'attention', label: 'Da completare' };
  if (percentage >= 25) return { key: 'late', label: 'In ritardo' };
  return { key: 'critical', label: 'Critica' };
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function shortDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getFriendlyError(error) {
  if (!error) return 'Errore durante il caricamento.';
  const message = error.message || String(error);
  if (message.includes('commessa_document_status') || error.code === '42P01') {
    return 'La tabella per la Gestione commesse non risulta ancora installata su Supabase. Esegui la migration 20260903_create_commessa_document_status.sql.';
  }
  return message;
}

function FolderCheck({ item }) {
  const ok = Boolean(item?.hasFiles);
  const exists = Boolean(item?.exists);
  const count = Number(item?.fileCount || 0);
  const statusText = ok
    ? `${count} ${count === 1 ? 'file' : 'file'}${item?.lastModified ? ` · ultimo ${shortDateTime(item.lastModified)}` : ''}`
    : exists
      ? 'Cartella presente ma vuota'
      : 'Cartella non trovata';
  const errorText = item?.error ? ` · Errore: ${item.error}` : '';

  return (
    <div
      className={`commessaFolderCheck ${ok ? 'ok' : 'missing'}`}
      title={`${item?.expectedFolder || item?.label || 'Cartella'} — ${statusText}${errorText}`}
    >
      <span className="commessaFolderIcon" aria-hidden="true">{ok ? '✓' : '!'}</span>
      <span className="commessaFolderText">
        <b>{item?.key ? `${item.key} · ` : ''}{item?.label || item?.expectedFolder || 'Cartella'}</b>
        <small>{ok ? `${count} file` : exists ? 'Vuota' : 'Manca'}</small>
      </span>
    </div>
  );
}

function CommessaCard({ item }) {
  const percentage = Number(item.completion_percentage || 0);
  const severity = severityFor(percentage);
  const folderStatus = Array.isArray(item.folder_status) ? item.folder_status : [];
  const completed = Number(item.completed_folders || 0);
  const expected = Number(item.expected_folders || 11);

  return (
    <article className={`commessaCard severity-${severity.key}`}>
      <div className="commessaCardAccent" />
      <header className="commessaCardHeader">
        <div className="commessaCardIdentity">
          <div className="commessaCodeRow">
            <span className="commessaCode">{item.commessa_code || 'Senza codice'}</span>
            <span className={`commessaStateBadge state-${severity.key}`}>{severity.label}</span>
          </div>
          <h2 title={item.commessa_folder}>{item.commessa_name || item.commessa_folder}</h2>
          {item.client && <p>{item.client}</p>}
        </div>

        <div className="commessaPercent" aria-label={`${percentage}% completata`}>
          <strong>{percentage}%</strong>
          <span>{completed}/{expected}</span>
        </div>
      </header>

      <div className="commessaProgress" aria-hidden="true">
        <i style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
      </div>

      {item.scan_error ? (
        <div className="commessaScanError">
          <b>Errore scansione</b>
          <span>{item.scan_error}</span>
        </div>
      ) : (
        <div className="commessaFolderGrid">
          {folderStatus.map((folder) => (
            <FolderCheck key={folder.key || folder.expectedFolder} item={folder} />
          ))}
          {!folderStatus.length && (
            <div className="commessaNoChecks">Nessun dettaglio disponibile: attendi la prima scansione dell'agent.</div>
          )}
        </div>
      )}

      <footer className="commessaCardFooter">
        <span><b>{item.total_files || 0}</b> file nelle cartelle controllate</span>
        <span>Controllo: <b>{formatDateTime(item.scanned_at)}</b></span>
      </footer>
    </article>
  );
}

export default function AdminCommesse() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('priority');
  const [latestRequest, setLatestRequest] = useState(null);

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [statusRows, request] = await Promise.all([
        fetchCommessaDocumentStatus(),
        fetchLatestCommessaScanRequest().catch(() => null),
      ]);
      setRows(statusRows);
      setLatestRequest(request);
    } catch (loadError) {
      setError(getFriendlyError(loadError));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const active = latestRequest?.status === 'pending' || latestRequest?.status === 'running';
    if (!active) return undefined;

    const timer = window.setInterval(async () => {
      try {
        const request = await fetchLatestCommessaScanRequest();
        setLatestRequest(request);
        if (request?.status === 'completed') {
          await loadData({ quiet: true });
          setNotice('Controllo completato: i dati delle commesse sono stati aggiornati.');
        } else if (request?.status === 'failed') {
          setError(request.error_message || 'La scansione richiesta non è riuscita.');
        }
      } catch (pollError) {
        console.error('commessa request poll error', pollError);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [latestRequest?.status, loadData]);

  const stats = useMemo(() => {
    const total = rows.length;
    const complete = rows.filter((row) => Number(row.completion_percentage) >= 100).length;
    const almost = rows.filter((row) => Number(row.completion_percentage) >= 80 && Number(row.completion_percentage) < 100).length;
    const attention = rows.filter((row) => Number(row.completion_percentage) < 80).length;
    const critical = rows.filter((row) => Number(row.completion_percentage) < 25).length;
    return { total, complete, almost, attention, critical };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = rows.filter((row) => {
      const percentage = Number(row.completion_percentage || 0);
      const matchesSearch = !query || [
        row.commessa_code,
        row.commessa_name,
        row.client,
        row.commessa_folder,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      if (!matchesSearch) return false;
      if (filter === 'complete') return percentage >= 100;
      if (filter === 'almost') return percentage >= 80 && percentage < 100;
      if (filter === 'attention') return percentage >= 25 && percentage < 80;
      if (filter === 'critical') return percentage < 25;
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === 'completion-desc') {
        return Number(b.completion_percentage || 0) - Number(a.completion_percentage || 0);
      }
      if (sort === 'code') {
        return String(a.commessa_code || a.commessa_folder).localeCompare(
          String(b.commessa_code || b.commessa_folder),
          'it',
          { numeric: true, sensitivity: 'base' },
        );
      }
      // Priorità: prima le commesse più incomplete, poi per numero.
      const byCompletion = Number(a.completion_percentage || 0) - Number(b.completion_percentage || 0);
      if (byCompletion !== 0) return byCompletion;
      return String(a.commessa_code || '').localeCompare(String(b.commessa_code || ''), 'it', { numeric: true });
    });

    return result;
  }, [rows, search, filter, sort]);

  const lastScan = useMemo(() => {
    const dates = rows.map((row) => new Date(row.scanned_at).getTime()).filter(Number.isFinite);
    return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
  }, [rows]);

  async function handleRequestScan() {
    if (latestRequest?.status === 'pending' || latestRequest?.status === 'running') return;
    setRefreshing(true);
    setError('');
    setNotice('');
    try {
      const request = await requestCommessaScan();
      setLatestRequest(request);
      setNotice('Richiesta inviata all’agent sul server. La pagina si aggiornerà automaticamente al termine.');
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setRefreshing(false);
    }
  }

  const requestActive = latestRequest?.status === 'pending' || latestRequest?.status === 'running';
  const requestLabel = latestRequest?.status === 'running'
    ? 'Scansione in corso…'
    : latestRequest?.status === 'pending'
      ? 'In attesa dell’agent…'
      : 'Scansiona ora';

  return (
    <div className="container commessePage">
      <section className="adminHero commesseHero">
        <div>
          <span className="adminEyebrow">Controllo documentale</span>
          <h1>Gestione commesse</h1>
          <p>Verifica in un colpo d’occhio se ogni reparto ha caricato i file previsti nelle sottocartelle della commessa.</p>
        </div>
        <div className="adminHeroBadge commesseHeroBadge">
          <span>Ultimo controllo disponibile</span>
          <strong>{formatDateTime(lastScan)}</strong>
          <small>{rows.length ? `${rows.length} cartelle commessa rilevate` : 'In attesa della prima scansione'}</small>
        </div>
      </section>

      <section className="commessaKpiGrid" aria-label="Riepilogo commesse">
        <article className="commessaKpi total"><span>Commesse</span><strong>{stats.total}</strong><small>cartelle rilevate sul server</small></article>
        <article className="commessaKpi complete"><span>Complete</span><strong>{stats.complete}</strong><small>11/11 controlli verdi</small></article>
        <article className="commessaKpi almost"><span>Quasi complete</span><strong>{stats.almost}</strong><small>dall’80% al 99%</small></article>
        <article className="commessaKpi attention"><span>Da verificare</span><strong>{stats.attention}</strong><small>{stats.critical} critiche sotto il 25%</small></article>
      </section>

      <section className="commessaControls">
        <div className="commessaSearchWrap">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca numero, nome, cliente…"
            aria-label="Cerca commessa"
          />
        </div>

        <div className="commessaFilterTabs" role="group" aria-label="Filtra stato commesse">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={filter === item.value ? 'active' : ''}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="commessaSort">
          <span>Ordina</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="priority">Priorità</option>
            <option value="completion-desc">Più complete</option>
            <option value="code">Numero commessa</option>
          </select>
        </label>

        <div className="commessaActions">
          <button
            type="button"
            className="btn"
            onClick={() => loadData()}
            disabled={loading}
            title="Ricarica i dati già salvati su Supabase"
          >
            ↻ Aggiorna
          </button>
          <button
            type="button"
            className="btn btnPrimary commessaScanButton"
            onClick={handleRequestScan}
            disabled={refreshing || requestActive}
            title="Chiede all'agent locale di rieseguire il controllo delle cartelle"
          >
            {requestActive && <span className="commessaSpinner" aria-hidden="true" />}
            {requestLabel}
          </button>
        </div>
      </section>

      {notice && <div className="toast ok commessaNotice">{notice}</div>}
      {error && <div className="toast err commessaNotice">{error}</div>}

      {loading ? (
        <div className="commessaLoading">
          <span className="commessaSpinner large" />
          <b>Caricamento controllo commesse…</b>
        </div>
      ) : visibleRows.length ? (
        <>
          <div className="commessaResultsHead">
            <span><b>{visibleRows.length}</b> di {rows.length} commesse</span>
            <span>Verde = almeno un file presente · Rosso = cartella vuota o assente</span>
          </div>
          <section className="commessaCardGrid">
            {visibleRows.map((item) => <CommessaCard key={item.id || item.commessa_folder} item={item} />)}
          </section>
        </>
      ) : (
        <div className="commessaEmpty">
          <div className="commessaEmptyIcon">📁</div>
          <h2>{rows.length ? 'Nessuna commessa corrisponde ai filtri' : 'Nessuna scansione disponibile'}</h2>
          <p>{rows.length ? 'Modifica ricerca o filtro.' : 'Installa la migration e avvia l’agent locale sul server aziendale per popolare questa pagina.'}</p>
        </div>
      )}
    </div>
  );
}
