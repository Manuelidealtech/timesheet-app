# Aggiornamento revisioni 0000 e menu Timesheet live

- Le cartelle revisione con prefisso `0000` vengono trattate come commesse distinte in base al nome, quindi due revisioni diverse non vengono piu accorpate alla stessa CDL.
- La scansione manuale di Gestione Commesse continua ad aggiornare la tabella `cdl` nella stessa esecuzione.
- Il menu commesse della compilazione Timesheet si riallinea automaticamente ogni 10 secondi, al ritorno sull'app e, se disponibile, anche tramite Supabase Realtime.
- Non serve aspettare il ciclo automatico di 15 minuti dopo una scansione manuale: una volta completata la scansione, le nuove CDL diventano disponibili agli utenti in pochi secondi.

## Deploy
1. Pubblicare il frontend aggiornato su Vercel.
2. Sul file server sostituire `C:\Idealtech\timesheet-app\server\commesse-sync.js` con quello di questo progetto.
3. Riavviare l'attivita pianificata/agent `Timesheet - Sync Commesse`.
4. Premere `Scansiona ora` in Gestione Commesse.
