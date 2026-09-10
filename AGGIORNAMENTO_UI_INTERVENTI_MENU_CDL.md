# Aggiornamento UI — Menu commesse e Fogli intervento

## Menu Commessa / CDL
- Il menu non viene più tagliato dal contenitore del form Timesheet.
- Aumentata l'altezza utile dell'elenco e la larghezza su desktop.
- Le righe sono leggermente più alte e leggibili.
- Su mobile resta un pannello touch a tutta larghezza.

## Fogli intervento
- L'archivio è ora una sezione richiudibile, chiusa di default.
- La compilazione è stata trasformata in un flusso guidato a 4 passaggi:
  1. Cliente
  2. Attività
  3. Macchine
  4. Chiusura
- Viene mostrato un solo passaggio alla volta.
- Sono presenti pulsanti avanti/indietro e navigazione diretta tra i passaggi.
- Lo stato di completamento dei passaggi è evidenziato graficamente.
- La zona del foglio corrente è racchiusa in un contenitore dedicato e più riconoscibile rispetto allo sfondo della pagina.
- Salvataggio, PDF e invio email restano disponibili nell'ultimo passaggio.

Queste modifiche riguardano il frontend: non è necessario aggiornare `commesse-sync.js` sul file server.
