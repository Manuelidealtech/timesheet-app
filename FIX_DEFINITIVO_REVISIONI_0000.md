# Fix definitivo revisioni 0000

La Gestione Commesse e il menu Timesheet usavano due tabelle diverse:

- `commessa_document_status` per la Gestione Commesse
- `cdl` per il menu Timesheet

Per questo una cartella poteva comparire nella dashboard ma non nel menu.

## 1. Eseguire una volta lo SQL

Aprire Supabase > SQL Editor ed eseguire:

`supabase/migrations/20260910_sync_cdl_from_commessa_status.sql`

Lo script:

- crea automaticamente/riattiva la CDL quando una commessa compare nella dashboard;
- collega `commessa_document_status.cdl_id` alla CDL corretta;
- gestisce piu revisioni con prefisso `0000` assegnando internamente un codice tecnico `REV-XXXXXXXX`;
- ripara immediatamente anche le revisioni gia presenti;
- lascia all'interfaccia il compito di mostrare `REV`, senza esporre il codice tecnico.

## 2. File server

Aggiornare `server/commesse-sync.js` sul file server e riavviare l'attivita pianificata.
La nuova versione usa lo stesso codice tecnico deterministico anche lato server.

## 3. Frontend

Fare il deploy Vercel del progetto aggiornato. Il menu Commessa/CDL e' ricercabile,
separa le Revisioni dalle commesse normali e cercando `0000` trova tutte le revisioni.
Anche il filtro Commessa del Registro completo usa ora lo stesso menu moderno.
