# Implementazione fogli intervento

## Cosa è stato aggiunto
- Nuova sezione **Fogli intervento** nel menu laterale.
- **Sidebar** fissa a sinistra con tutte le voci della vecchia navbar.
- Pagina per:
  - compilare il foglio intervento via form
  - salvare i dati su Supabase
  - esportare il PDF
  - inviare il PDF via mail a `lucia.bisceglia@idealtech.it`
- Archivio laterale dei fogli già salvati.
- Migrazione SQL per la tabella `intervention_reports`.
- Edge Function Supabase `send-intervention-email` per l'invio email con allegato PDF.

## File principali aggiunti/modificati
- `src/components/Sidebar.jsx`
- `src/pages/Interventi.jsx`
- `src/utils/interventionPdf.js`
- `src/lib/api.js`
- `src/App.jsx`
- `src/styles/sidebar.css`
- `src/styles/intervention.css`
- `supabase/migrations/20260402_create_intervention_reports.sql`
- `supabase/functions/send-intervention-email/index.ts`

## Setup necessario
### 1. Dipendenze
```bash
npm install
```

### 2. Eseguire la migration su Supabase
Esegui il file:
```sql
supabase/migrations/20260402_create_intervention_reports.sql
```

### 3. Deploy edge function
Pubblica la function:
```bash
supabase functions deploy send-intervention-email
```

### 4. Variabili ambiente edge function
Imposta nelle secrets di Supabase:
- `RESEND_API_KEY`
- `INTERVENTION_FROM_EMAIL`

Esempio mittente:
- `Idealtech <noreply@idealtech.it>`

## Nota importante sull'invio email
L'invio diretto con allegato PDF non si può fare in modo affidabile solo dal browser.
Per questo è stata predisposta una **Supabase Edge Function** che riceve il PDF in base64 e lo inoltra via email.

## PDF di riferimento
La struttura del form è stata ricavata dal modulo caricato: `FOGLIO INTERVENTO IDEALTECH.pdf`.
