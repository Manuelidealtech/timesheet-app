import React, { useEffect, useMemo, useRef, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isRevision(item) {
  const code = String(item?.code || '').trim();
  return /^revisione\b/i.test(String(item?.name || '').trim()) || code === '0000' || /^REV-/i.test(code);
}

function displayCode(item) {
  if (isRevision(item)) return 'REV';
  return String(item?.code || '').trim() || 'S/C';
}

export default function CdlPicker({
  value,
  items = [],
  onChange,
  onRefresh,
  disabled = false,
  allowEmpty = false,
  emptyLabel = 'Tutte le commesse',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => items.find((item) => String(item.id) === String(value)) || null,
    [items, value],
  );

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return items;

    return items.filter((item) => {
      const haystack = normalize([
        item.code,
        item.name,
        item.client,
        isRevision(item) ? '0000 revisione rev' : '',
      ].filter(Boolean).join(' '));
      return haystack.includes(needle);
    });
  }, [items, query]);

  const revisions = useMemo(() => filtered.filter(isRevision), [filtered]);
  const commesse = useMemo(() => filtered.filter((item) => !isRevision(item)), [filtered]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  async function openPicker() {
    if (disabled) return;
    setOpen((current) => !current);
    if (!open && onRefresh) {
      try {
        await onRefresh();
      } catch {
        // Il polling automatico resta come fallback.
      }
    }
  }

  async function manualRefresh(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!onRefresh || refreshing) return;
    try {
      setRefreshing(true);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  function choose(item) {
    onChange?.(item ? String(item.id) : '');
    setOpen(false);
    setQuery('');
  }

  function renderRow(item) {
    const active = String(item.id) === String(value);
    const revision = isRevision(item);

    return (
      <button
        type="button"
        key={item.id}
        className={`cdlPickerOption${active ? ' isSelected' : ''}`}
        onClick={() => choose(item)}
      >
        <span className={`cdlPickerCode${revision ? ' isRevision' : ''}`}>{displayCode(item)}</span>
        <span className="cdlPickerOptionText">
          <strong>{item.name || 'Commessa senza descrizione'}</strong>
          <small>{item.client || (revision ? 'Revisione / assistenza tecnica' : 'Commessa Idealtech')}</small>
        </span>
        {active && <span className="cdlPickerCheck" aria-hidden="true">✓</span>}
      </button>
    );
  }

  return (
    <div className={`cdlPicker${open ? ' isOpen' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="cdlPickerTrigger"
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span className={`cdlPickerCode${isRevision(selected) ? ' isRevision' : ''}`}>{displayCode(selected)}</span>
            <span className="cdlPickerTriggerText">
              <strong>{selected.name}</strong>
              <small>{selected.client || (isRevision(selected) ? 'Revisione' : 'Commessa')}</small>
            </span>
          </>
        ) : (
          <span className="cdlPickerPlaceholder">{allowEmpty ? emptyLabel : 'Seleziona una commessa'}</span>
        )}
        <span className="cdlPickerChevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <>
          <div className="cdlPickerMobileBackdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="cdlPickerMenu" role="listbox">
            <div className="cdlPickerMenuHead">
              <div>
                <strong>Scegli la commessa</strong>
                <small>{items.length} disponibili · sincronizzate dal server</small>
              </div>
              <button type="button" className="cdlPickerRefresh" onClick={manualRefresh} disabled={refreshing}>
                <span className={refreshing ? 'isSpinning' : ''}>↻</span>
                {refreshing ? 'Aggiorno' : 'Aggiorna'}
              </button>
            </div>

            <div className="cdlPickerSearchWrap">
              <span aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca numero, cliente o descrizione..."
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Cancella ricerca">×</button>
              )}
            </div>

            <div className="cdlPickerScroll">
              {allowEmpty && !query && (
                <section className="cdlPickerGroup cdlPickerAllGroup">
                  <button
                    type="button"
                    className={`cdlPickerOption${!value ? ' isSelected' : ''}`}
                    onClick={() => choose(null)}
                  >
                    <span className="cdlPickerCode cdlPickerCodeAll">ALL</span>
                    <span className="cdlPickerOptionText">
                      <strong>{emptyLabel}</strong>
                      <small>Nessun filtro sulla commessa</small>
                    </span>
                    {!value && <span className="cdlPickerCheck" aria-hidden="true">✓</span>}
                  </button>
                </section>
              )}

              {revisions.length > 0 && (
                <section className="cdlPickerGroup">
                  <div className="cdlPickerGroupTitle">
                    <span>Revisioni</span>
                    <b>{revisions.length}</b>
                  </div>
                  {revisions.map(renderRow)}
                </section>
              )}

              {commesse.length > 0 && (
                <section className="cdlPickerGroup">
                  <div className="cdlPickerGroupTitle">
                    <span>Commesse</span>
                    <b>{commesse.length}</b>
                  </div>
                  {commesse.map(renderRow)}
                </section>
              )}

              {!filtered.length && (
                <div className="cdlPickerEmpty">
                  <strong>Nessun risultato</strong>
                  <span>Prova con numero commessa, cliente o una parola della descrizione.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
