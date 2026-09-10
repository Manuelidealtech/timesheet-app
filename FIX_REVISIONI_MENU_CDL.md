# Fix revisioni e menu commesse Timesheet

## Cosa cambia

- Le cartelle di revisione possono continuare a iniziare con `0000` sul file server.
- `0000` viene trattato solo come prefisso tecnico e non come numero commessa reale.
- In Supabase le revisioni sincronizzate vengono salvate in `cdl` con `code = NULL`, cosi piu revisioni possono convivere anche se sulla colonna `code` esiste un vincolo UNIQUE.
- Eventuali revisioni gia sincronizzate con `code = 0000` vengono normalizzate automaticamente alla scansione successiva.
- La Gestione Commesse continua a mostrare `0000` sulla scheda, perche deriva dal nome cartella.
- Il menu Commessa/CDL degli utenti viene aggiornato ogni 5 secondi, al focus dell'app, tramite Realtime quando disponibile e ogni volta che viene aperto.
- Il nuovo menu e ricercabile per codice, cliente e descrizione; le revisioni sono raccolte in una sezione dedicata con badge `REV`.

## Aggiornamenti richiesti

1. Deploy del progetto frontend su Vercel.
2. Sostituire sul file server `C:\Idealtech\timesheet-app\server\commesse-sync.js` con la nuova versione.
3. Riavviare l'attivita pianificata `Timesheet - Sync Commesse`.
4. Premere `Scansiona ora` in Gestione Commesse oppure eseguire una volta `npm run sync:commesse:once` sul server.

Non e richiesta alcuna migration SQL.
