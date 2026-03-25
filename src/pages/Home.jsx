import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Home() {
  const { role, profile } = useAuth();

  const [missingEmployees, setMissingEmployees] = useState([]);
  const [loadingMissing, setLoadingMissing] = useState(true);
  const [missingError, setMissingError] = useState("");

  const [newsItems, setNewsItems] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState("");

  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [savingNews, setSavingNews] = useState(false);

  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadMissingEmployees() {
      try {
        setLoadingMissing(true);
        setMissingError("");

        const { data: employees, error: empError } = await supabase
          .from("employees")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (empError) throw empError;

        if (!employees || employees.length === 0) {
          if (mounted) setMissingEmployees([]);
          return;
        }

        const employeeIds = employees.map((emp) => emp.id);

        const { data: todayTimesheets, error: tsError } = await supabase
          .from("timesheets")
          .select("employee_id, work_date")
          .eq("work_date", today)
          .in("employee_id", employeeIds);

        if (tsError) throw tsError;

        const compiledToday = new Set(
          (todayTimesheets || []).map((row) => row.employee_id)
        );

        const missing = employees.filter((emp) => !compiledToday.has(emp.id));

        if (mounted) setMissingEmployees(missing);
      } catch (err) {
        console.error("Errore caricamento dipendenti mancanti:", err);
        if (mounted) setMissingError("Impossibile caricare il resoconto giornaliero.");
      } finally {
        if (mounted) setLoadingMissing(false);
      }
    }

    async function loadNews() {
      try {
        setLoadingNews(true);
        setNewsError("");

        const { data, error } = await supabase
          .from("news")
          .select("id, title, content, created_at, is_published")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (mounted) setNewsItems(data || []);
      } catch (err) {
        console.error("Errore caricamento news:", err);
        if (mounted) setNewsError("Impossibile caricare le news.");
      } finally {
        if (mounted) setLoadingNews(false);
      }
    }

    loadMissingEmployees();
    loadNews();

    return () => {
      mounted = false;
    };
  }, [today]);

  async function handleCreateNews(e) {
    e.preventDefault();

    const title = newsTitle.trim();
    const content = newsContent.trim();

    if (!title || !content) return;

    try {
      setSavingNews(true);
      setNewsError("");

      const { data, error } = await supabase
        .from("news")
        .insert([
          {
            title,
            content,
            is_published: true,
          },
        ])
        .select();

      if (error) throw error;

      const created = data?.[0];
      if (created) {
        setNewsItems((prev) => [created, ...prev]);
      }

      setNewsTitle("");
      setNewsContent("");
    } catch (err) {
      console.error("Errore creazione news:", err);
      setNewsError("Impossibile pubblicare la news.");
    } finally {
      setSavingNews(false);
    }
  }

  async function handleDeleteNews(id) {
    const ok = window.confirm("Vuoi eliminare questa news?");
    if (!ok) return;

    try {
      const { error } = await supabase.from("news").delete().eq("id", id);
      if (error) throw error;

      setNewsItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Errore eliminazione news:", err);
      setNewsError("Impossibile eliminare la news.");
    }
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="container">
      <div className="card homeCard">
        <div className="cardHeader">
          <div>
            <h1 className="h1">Timesheet</h1>
            <p className="sub">
              Ruolo: <b>{role}</b>
              {profile?.display_name ? ` — ${profile.display_name}` : ""}
            </p>
          </div>
        </div>

        <hr className="sep" />

        <div className="row">
          {role === "produzione" && (
            <>
              <Link className="btn btnPrimary" to="/produzione">
                Compila Timesheet
              </Link>
              <Link className="btn" to="/storico">
                Storico
              </Link>
            </>
          )}

          {role === "admin" && (
            <>
              <Link className="btn btnPrimary" to="/admin">
                Dashboard
              </Link>
              <Link className="btn" to="/admin/timesheets">
                Tutti i Timesheet
              </Link>
              <Link className="btn" to="/admin/riassunti">
                Riassunti
              </Link>
            </>
          )}
        </div>

        <section className="dailyReport">
          <div className="dailyReportHead">
            <div>
              <span className="dailyReportEyebrow">Monitoraggio giornaliero</span>
              <h2 className="dailyReportTitle">Compilazione timesheet di oggi</h2>
              <p className="dailyReportText">
                Qui sotto vengono mostrati i dipendenti che oggi non hanno ancora inserito alcun timesheet.
              </p>
            </div>

            {!loadingMissing && !missingError && (
              <div
                className={
                  missingEmployees.length > 0
                    ? "reportCounter reportCounterAlert"
                    : "reportCounter reportCounterOk"
                }
              >
                {missingEmployees.length > 0
                  ? `${missingEmployees.length} mancanti`
                  : "Tutti compilati"}
              </div>
            )}
          </div>

          {loadingMissing && (
            <div className="reportState reportStateNeutral">
              Caricamento resoconto...
            </div>
          )}

          {!loadingMissing && missingError && (
            <div className="reportState reportStateError">{missingError}</div>
          )}

          {!loadingMissing && !missingError && missingEmployees.length === 0 && (
            <div className="reportState reportStateSuccess">
              Tutti i dipendenti hanno già compilato almeno un timesheet oggi.
            </div>
          )}

          {!loadingMissing && !missingError && missingEmployees.length > 0 && (
            <div className="missingList">
              {missingEmployees.map((emp) => (
                <div key={emp.id} className="missingChip">
                  <span className="missingDot"></span>
                  <span>{emp.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="newsSection">
          <div className="newsHead">
            <div>
              <span className="dailyReportEyebrow">Aggiornamenti</span>
              <h2 className="dailyReportTitle">News applicazione</h2>
              <p className="dailyReportText">
                Ultime comunicazioni e aggiornamenti relativi alle applicazioni.
              </p>
            </div>
          </div>

          {role === "admin" && (
            <form className="newsComposer" onSubmit={handleCreateNews}>
              <div className="newsComposerGrid">
                <div className="formGroup">
                  <label htmlFor="news-title">Titolo news</label>
                  <input
                    id="news-title"
                    type="text"
                    value={newsTitle}
                    onChange={(e) => setNewsTitle(e.target.value)}
                    placeholder="Es. Nuovo filtro nello storico"
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="news-content">Contenuto</label>
                  <textarea
                    id="news-content"
                    value={newsContent}
                    onChange={(e) => setNewsContent(e.target.value)}
                    placeholder="Scrivi qui l’aggiornamento da mostrare agli utenti..."
                  />
                </div>
              </div>

              <div className="newsComposerActions">
                <button
                  type="submit"
                  className="btn btnPrimary"
                  disabled={savingNews || !newsTitle.trim() || !newsContent.trim()}
                >
                  {savingNews ? "Pubblicazione..." : "Pubblica news"}
                </button>
              </div>
            </form>
          )}

          {newsError && <div className="reportState reportStateError">{newsError}</div>}

          {loadingNews && (
            <div className="reportState reportStateNeutral">Caricamento news...</div>
          )}

          {!loadingNews && !newsError && newsItems.length === 0 && (
            <div className="reportState reportStateNeutral">
              Nessuna news pubblicata al momento.
            </div>
          )}

          {!loadingNews && newsItems.length > 0 && (
            <div className="newsList">
              {newsItems.map((item) => (
                <article key={item.id} className="newsItem">
                  <div className="newsMetaRow">
                    <div className="newsMetaLeft">
                      <span className="newsDate">{formatDate(item.created_at)}</span>
                      <span className="newsBadge">Aggiornamento</span>
                    </div>

                    {role === "admin" && (
                      <button
                        type="button"
                        className="btn btnRed"
                        onClick={() => handleDeleteNews(item.id)}
                      >
                        Elimina
                      </button>
                    )}
                  </div>

                  <h3 className="newsTitle">{item.title}</h3>
                  <p className="newsBody">{item.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}