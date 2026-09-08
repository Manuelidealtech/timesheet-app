# Aggiornamento Fogli intervento - firma cliente + invio email

## Cosa cambia

- Il campo testuale `Firma cliente` è stato sostituito da un riquadro di firma manuale.
- Il cliente può firmare con dito, pennino o mouse.
- La firma viene salvata sul foglio intervento e inserita graficamente nel PDF.
- È presente il campo `Email cliente per invio foglio`.
- Il vecchio pulsante `Invia a Lucia` diventa `Invia email`.
- L'email viene inviata al cliente e Lucia riceve una copia nascosta (BCC).
- Il PDF allegato è lo stesso PDF generato dall'app e contiene la firma del cliente.

## 1. Aggiornare Supabase Database

Aprire Supabase > SQL Editor ed eseguire:

```sql
alter table if exists public.intervention_reports
  add column if not exists client_email text null,
  add column if not exists client_signature_image text null;
```

Lo stesso SQL è disponibile in:

`supabase/migrations/20260908_add_intervention_client_email_signature.sql`

## 2. Pubblicare la Edge Function aggiornata

Dalla root del progetto:

```powershell
npx supabase functions deploy send-intervention-report
```

## 3. Controllare la mail interna di Lucia

La Edge Function usa il secret `REPORT_RECIPIENT` come destinatario interno.
Deve essere impostato su:

`lucia.bisceglia@idealtech.it`

Se il secret non esiste, questo indirizzo è già impostato come fallback nel codice.

Devono inoltre esistere i secrets:

- `RESEND_API_KEY`
- `MAIL_FROM`

## 4. Deploy Vercel

Dopo SQL + Edge Function, pubblicare normalmente il frontend su Vercel tramite GitHub.

## File server

Non occorre aggiornare `C:\Idealtech\timesheet-app` sul file server per questa modifica: `server/commesse-sync.js` non è stato modificato.
