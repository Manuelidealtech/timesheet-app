# Fix refresh autenticazione + pulsante Fogli intervento

- Sessione Supabase resa esplicitamente persistente (`persistSession`, `autoRefreshToken`).
- Rimosso il timeout aggressivo da 4 secondi sul ripristino sessione che poteva causare un falso logout al refresh.
- Se il profilo tarda a caricarsi ma la sessione è valida, l'app non rimanda più al login.
- La pagina Login reindirizza automaticamente alla pagina richiesta se la sessione persistita viene recuperata.
- Il percorso richiesto viene conservato durante un eventuale passaggio temporaneo dal login.
- `Continua · Attività` e gli altri pulsanti Continua dei Fogli intervento hanno ora uno sfondo fallback compatibile con tablet/WebView meno recenti, evitando testo bianco su sfondo bianco.

Solo deploy Vercel: nessuna modifica al sincronizzatore commesse del file server.
