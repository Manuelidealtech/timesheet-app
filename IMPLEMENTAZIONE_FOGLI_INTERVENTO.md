# Implementazione fogli intervento

## Funzioni disponibili
- Compilazione digitale del foglio intervento.
- Salvataggio e archivio su Supabase.
- Esportazione PDF.
- Firma manuale del cliente con dito, pennino o mouse.
- La firma viene salvata nel foglio e riportata graficamente nel PDF.
- Campo **Email cliente** compilabile al momento dell'intervento.
- Pulsante **Invia email**: invia il PDF al cliente e una copia nascosta a Lucia.

## File principali
- `src/pages/Interventi.jsx`
- `src/components/SignaturePad.jsx`
- `src/utils/interventionPdf.js`
- `src/lib/api.js`
- `src/styles/intervention.css`
- `supabase/migrations/20260908_add_intervention_client_email_signature.sql`
- `supabase/functions/send-intervention-report/index.ts`

## Aggiornamento necessario su Supabase

### 1. Eseguire la migration
Eseguire nel SQL Editor di Supabase:

```sql
alter table if exists public.intervention_reports
  add column if not exists client_email text null,
  add column if not exists client_signature_image text null;
```

Oppure eseguire tutto il file:

`supabase/migrations/20260908_add_intervention_client_email_signature.sql`

### 2. Pubblicare la Edge Function aggiornata
Dalla root del progetto:

```bash
npx supabase functions deploy send-intervention-report
```

### 3. Secrets della Edge Function
Devono essere configurati:
- `RESEND_API_KEY`
- `MAIL_FROM`
- `REPORT_RECIPIENT`

`REPORT_RECIPIENT` deve essere impostato all'indirizzo di Lucia. Se non viene impostato, la function usa come fallback:

`lucia.bisceglia@idealtech.it`

Esempio di `MAIL_FROM`:

`Idealtech <noreply@idealtech.it>`

## Modalità di invio
Il cliente viene inserito nel campo `to`. Lucia viene inserita in `bcc`, quindi riceve la stessa email e lo stesso PDF senza esporre al cliente l'indirizzo interno.

Il PDF allegato è quello generato dall'app, perciò contiene anche la firma manuale acquisita sul tablet/telefono.

## Nota deploy
Questa modifica riguarda Vercel + Supabase. Non richiede aggiornamenti a `commesse-sync.js` sul file server.
