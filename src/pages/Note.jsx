import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import '../styles/Note.css';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Note() {
  const { user, profile } = useAuth();

  const today = useMemo(() => getToday(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    loadNotes(selectedDate);
  }, [user?.id, selectedDate]);

  async function loadNotes(noteDate) {
    try {
      setLoading(true);
      setStatus('');

      const { data, error } = await supabase
        .from('daily_notes')
        .select('id, content, note_date, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('note_date', noteDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotes(data || []);
    } catch (error) {
      console.error('Errore caricamento note:', error);
      setStatus('Errore nel caricamento delle note.');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNote() {
    const cleanDraft = draft.trim();
    if (!cleanDraft) {
      setStatus('Scrivi una nota prima di salvarla.');
      return;
    }

    try {
      setSaving(true);
      setStatus('');

      const { error } = await supabase.from('daily_notes').insert({
        user_id: user.id,
        note_date: selectedDate,
        content: cleanDraft,
      });

      if (error) throw error;

      setDraft('');
      setStatus('Nota salvata correttamente.');
      await loadNotes(selectedDate);
    } catch (error) {
      console.error('Errore salvataggio nota:', error);
      setStatus('Errore durante il salvataggio della nota.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(id) {
    try {
      setStatus('');

      const { error } = await supabase
        .from('daily_notes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotes((prev) => prev.filter((note) => note.id !== id));
      setStatus('Nota eliminata.');
    } catch (error) {
      console.error('Errore eliminazione nota:', error);
      setStatus('Errore durante l’eliminazione della nota.');
    }
  }

  async function handleCopyNote(content) {
    try {
      await navigator.clipboard.writeText(content || '');
      setStatus('Nota copiata negli appunti.');
    } catch (error) {
      console.error('Errore copia nota:', error);
      setStatus('Impossibile copiare la nota.');
    }
  }

  return (
    <div className="notesPage">
      <div className="notesHero">
        <div>
          <p className="notesEyebrow">Workspace personale</p>
          <h1>Note giornaliere</h1>
          <p className="notesSubtitle">
            Salva blocchi separati durante la giornata e copia solo quelli utili nel timesheet.
          </p>
        </div>

        <div className="notesMetaCard">
          <div className="notesMetaLabel">Utente</div>
          <div className="notesMetaValue">{profile?.display_name || user?.email || 'Utente'}</div>
        </div>
      </div>

      <div className="notesComposerCard">
        <div className="notesComposerTop">
          <div className="notesField">
            <label htmlFor="note-date">Data</label>
            <input
              id="note-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="notesField">
          <label htmlFor="note-content">Nuova nota</label>
          <textarea
            id="note-content"
            rows={6}
            placeholder="Scrivi una singola attività, promemoria o blocco di testo da riutilizzare nel timesheet..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>

        <div className="notesActions">
          <button
            type="button"
            className="btn"
            onClick={handleSaveNote}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : 'Salva nota'}
          </button>
        </div>

        {status ? (
          <div className={`notesStatus ${status.toLowerCase().includes('errore') ? 'error' : 'success'}`}>
            {status}
          </div>
        ) : null}
      </div>

      <div className="notesListHeader">
        <h2>Note salvate</h2>
        <span>{loading ? 'Caricamento...' : `${notes.length} note`}</span>
      </div>

      {loading ? (
        <div className="notesEmpty">Caricamento note in corso...</div>
      ) : notes.length === 0 ? (
        <div className="notesEmpty">
          Nessuna nota salvata per questa data.
        </div>
      ) : (
        <div className="notesGrid">
          {notes.map((note) => (
            <article key={note.id} className="noteCard">
              <div className="noteCardHeader">
                <div>
                  <div className="noteCardDate">{note.note_date}</div>
                  <div className="noteCardTime">
                    Creata: {formatDateTime(note.created_at)}
                  </div>
                </div>
              </div>

              <div className="noteCardBody">
                <p>{note.content}</p>
              </div>

              <div className="noteCardActions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleCopyNote(note.content)}
                >
                  Copia per timesheet
                </button>

                <button
                  type="button"
                  className="btn btnDanger"
                  onClick={() => handleDeleteNote(note.id)}
                >
                  Elimina
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}