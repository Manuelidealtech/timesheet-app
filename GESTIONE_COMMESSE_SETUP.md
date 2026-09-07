# Gestione commesse — installazione

La nuova pagina **Admin → Gestione commesse** controlla le 11 sottocartelle standard di ogni cartella commessa presente nel file server.

## Cosa controlla

Per ogni commessa cerca:

- `00_Ordine e scheda lavorazione`
- `10_Distinte`
- `20_Disegni meccanici`
- `30_Programmi`
- `40_Foto`
- `50_Schemi elettrici`
- `60_Manuali`
- `70_Scheda di Collaudo`
- `80_Gantt`
- `90_Certificati`
- `100_Scheda Costi`

Il controllo dei file è **ricorsivo**: un file contenuto in una sottocartella interna viene comunque conteggiato.

- Verde = almeno un file presente.
- Rosso = cartella assente o cartella presente ma vuota.
- La card cambia colore in base alla percentuale complessiva, così le commesse con pochissimi documenti saltano subito all'occhio.

## 1. Creare le tabelle su Supabase

Eseguire la migration:

`supabase/migrations/20260903_create_commessa_document_status.sql`

Si può usare Supabase CLI oppure incollare il contenuto nel **SQL Editor** del progetto Supabase.

Le policy RLS permettono di leggere questi dati soltanto agli utenti con ruolo `admin` attivo.

## 2. Configurare l'agent sul PC/server che vede la cartella di rete

Copiare:

`server/.env.commesse.example`

in:

`server/.env.commesse`

Poi compilare almeno:

```env
SUPABASE_URL=https://TUO-PROGETTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
COMMESSE_ROOT_PATH=\\SERVER\Documentazione impianti\Commesse\00-Commesse aperte 2026
```

**Importante:** la `SUPABASE_SERVICE_ROLE_KEY` non va mai inserita in `VITE_...`, nel browser o su Vercel. Deve rimanere solo sul computer aziendale che esegue l'agent.

## 3. Prima prova

Dalla cartella del progetto:

```powershell
npm run sync:commesse:once
```

Il terminale deve mostrare tutte le cartelle commessa e una percentuale, per esempio:

```text
0631 (2633-2026) LINEA TRAPPOLE TOPI - ZAPI: 8/11 (73%)
```

A questo punto la pagina **Gestione commesse** dell'admin mostrerà le card.

## 4. Avvio continuo

Per tenere il controllo aggiornato:

```powershell
npm run sync:commesse
```

Per impostazione predefinita:

- scansione completa ogni 15 minuti;
- controllo ogni 10 secondi delle richieste inviate dal pulsante **Scansiona ora** dell'app.

I tempi sono modificabili in `server/.env.commesse`.

Per uso definitivo è consigliato far partire `npm run sync:commesse` automaticamente all'avvio di Windows tramite **Utilità di pianificazione**, oppure installarlo come servizio Node con il sistema già usato in azienda.

## Come vengono abbinate le commesse

L'agent legge direttamente **tutte le cartelle presenti nella root delle commesse**; quindi la dashboard non dipende dal fatto che una commessa sia già stata associata correttamente alla tabella `cdl`.

Prova comunque ad abbinarla a `cdl` usando numero/nome per riutilizzare il nome già presente nell'app. Se non trova una corrispondenza, ricava numero e nome direttamente dal nome cartella, ad esempio:

`0631 (2633-2026) LINEA TRAPPOLE TOPI - ZAPI`

→ codice `0631`, nome `LINEA TRAPPOLE TOPI - ZAPI`.

## Sicurezza

La pagina React è protetta dalla route `RequireRole(['admin'])` e le tabelle hanno RLS admin-only. Gli utenti produzione/ufficio non possono leggere i risultati nemmeno interrogando Supabase direttamente con la chiave anonima.

## Sincronizzazione automatica con il menu Timesheet

Dalla versione aggiornata, la stessa scansione delle cartelle usata da **Gestione commesse** mantiene automaticamente allineata anche la tabella `cdl` usata dai menu a tendina dei Timesheet.

- una nuova cartella valida con codice iniziale di 4 cifre viene creata automaticamente come CDL attiva;
- una CDL già esistente ma disattivata viene riattivata se la relativa cartella è presente sul file server;
- `COSTI` e `01_DIRECTORY DI BASE DA COPIARE` continuano a essere escluse;
- le descrizioni già personalizzate manualmente in anagrafica non vengono sovrascritte; vengono completati solo eventuali campi mancanti.

Dopo aver aggiornato `server/commesse-sync.js` sul file server, eseguire una volta:

```powershell
npm run sync:commesse:once
```

Poi riavviare l'agent/attività pianificata. Da quel momento le nuove commesse rilevate dal server compariranno anche nel selettore **Commessa / CDL** del Timesheet.
