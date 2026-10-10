# Sguardo per Mac

**Chi ha letto davvero questo codice?** È lo stesso Sguardo della versione Windows (vedi il [README principale](../README.md)), rifatto in Node.js con un'interfaccia web, per girare su macOS senza .NET, PowerShell né installazioni: **nessun pacchetto npm**, solo i moduli integrati di Node.

Stessi comandi, stessi messaggi, stesse impronte, stessi file su disco: i dati `.sguardo/` creati su Windows si leggono qui e viceversa. I rapporti HTML della demo, rifatti con questa versione, sono identici byte per byte a quelli della versione Windows (cambiano solo data, ora e cartella: lo controlla `test/fedelta.test.mjs`).

Serve **Node.js 22 o successivo** (provato con Node 24). Per la schermata dell'autotest serve anche **Google Chrome** (o Chromium, Edge, Brave), che viene usato in modalità invisibile.

## Avvio

**Interfaccia web.** Fai doppio clic su **`avvia.command`**: parte il server e si apre il browser su `http://localhost:5176`. Senza argomenti mostra la demo per Mac (`mac/demo/negozio`, quella di `demo.command`); se non c'è ancora, la crea copiando la demo della versione Windows, che resta intatta: le letture fatte nel browser finiscono solo nella copia. In alternativa, da Terminale:

```
cd sguardo/mac
npm start                              # la demo per Mac, su http://127.0.0.1:5176
node server.mjs <cartella>             # un altro progetto con .sguardo/
SGUARDO_PROGETTO=<cartella> npm start  # idem
PORT=8080 npm start                    # un'altra porta
```

Il server ascolta solo su `127.0.0.1`: nessun altro computer può collegarsi. La pagina mostra l'esito della verifica, le statistiche, l'elenco dei file con l'«impronta dell'attenzione» e le righe critiche non lette. Un clic su un file apre il lettore; un clic su una riga critica apre il lettore proprio su quella riga. Il pulsante **Rapporto HTML** genera al momento il rapporto autonomo. L'interruttore **Solo letture vere** è l'equivalente di `--solo-letture`.

**Riga di comando.** `node bin/sguardo.mjs <comando>` oppure `./sguardo.command <comando>` (con un doppio clic mostra l'aiuto). Se vuoi il comando `sguardo` ovunque: `npm link` dentro `mac/` (facoltativo, non scarica nulla).

**Demo.** Doppio clic su **`demo.command`**, oppure `npm run demo`. Ricrea `mac/demo/` (non è nel repository e non tocca la demo della versione Windows) e racconta la stessa storia del negozio con il bug nei rimborsi. Non ha pause: `SGUARDO_VELOCE=1` (o `node bin/demo.mjs --veloce`) accorcia solo l'autotest del lettore da 6 a 2 secondi e salta l'«Invio per chiudere» finale; `--senza-lettore` salta il passo 9.

**Test.** Doppio clic su **`test.command`**, oppure `npm test` (cioè `node --test`). I test che usano Chrome si saltano da soli se Chrome non c'è.

## Comandi

```
sguardo init [cartella]                  attiva Sguardo in un progetto (crea .sguardo/)
sguardo leggi <file>                     apre il lettore e registra l'attenzione
sguardo rapporto [cartella]              righe lette, righe mai lette, rapporto HTML
sguardo verifica [cartella]              per la CI: esce con 1 se una riga critica non è stata letta
sguardo mostra <file> [da-a]             il file in console con lo stato di ogni riga
sguardo simula <file> <da-a> <secondi>   registra attenzione simulata (demo e test)
sguardo righe <file>                     dati grezzi riga per riga (TSV, per script)
sguardo pulisci [cartella]               toglie dai JSON le impronte delle versioni vecchie   (novità)
```

| Opzione | Comandi | Effetto |
|---|---|---|
| `--solo-letture` | rapporto, verifica, mostra, righe | ignora l'attenzione simulata: è l'opzione da usare in una CI vera |
| `--html <file>` | rapporto | dove scrivere il rapporto HTML (predefinito: `sguardo-rapporto.html` nella radice del progetto) |
| `--autotest <s>` | leggi | la pagina scorre da sola per `<s>` secondi, poi si chiude |
| `--schermata <png>` | leggi --autotest | salva un'immagine della pagina (serve Chrome) |
| `--formato github` | verifica | aggiunge le annotazioni per GitHub Actions (novità) |
| `--prova` | pulisci | mostra cosa toglierebbe, senza toccare nulla (novità) |

Come su Windows: i comandi diversi da `init` cercano `.sguardo/` risalendo le cartelle come git; codici di uscita `0` tutto bene, `1` verifica non passata, `2` errore; intervalli `18-31`, `12` oppure `1-10,15-20`; secondi `2,5` o `2.5`.

Esempio reale, sulla demo:

```
$ node bin/sguardo.mjs simula demo/negozio/rimborsi.js 20-31 40
  simula  rimborsi.js righe 20-31: 40 s su 12 righe (per leggerle tutte ne servono 20 s)
          lette 12 su 12 · file: 100% letto · registrato come «simulazione»
```

## Il lettore

`sguardo leggi <file>` avvia un piccolo server locale su una porta libera, apre il browser predefinito (comando `open`) sulla pagina del lettore e aspetta. La logica è quella della finestra WinForms, riga per riga (è in `lib/attenzione.mjs`, condivisa tra pagina e test):

- ogni 250 ms, se **la scheda ha il focus** (`document.hasFocus()` e scheda visibile) e **c'è stata attività negli ultimi 20 s** (mouse, rotella, tasti, tocco), 0,25 s si distribuiscono tra le righe **visibili e non vuote**;
- peso = soglia della riga × (0,06 + e^(−d²/2σ²)), σ = 3,5 righe, `d` = distanza dalla riga sotto il puntatore; se il puntatore è fuori dal testo (o il dito si è alzato) il fuoco va al 40% dell'area visibile e σ = max(4; righe visibili / 2,5);
- nel margine una barra per riga va dal grigio (mai letta) all'oliva (sfiorata) al verde; la mappa a destra mostra tutto il file, segna in rosso le righe critiche non lette e si usa per scorrere;
- in alto l'indicatore dice se Sguardo registra o è in pausa, e perché; in basso lo stato del file («Lette da un umano: 94% delle righe · 1 riga critica non letta»);
- la pagina salva ogni 10 s, quando la scheda passa in secondo piano e alla chiusura (`sendBeacon`); il server rilegge il JSON dal disco, somma e scrive. Origine «lettura»;
- se il file cambia su disco la pagina lo ricarica e avvisa che le righe modificate tornano «mai lette».

Tasti: frecce, Pagina su/giù, Spazio, Inizio/Fine per scorrere; **⌘F** (o Ctrl+F, o `/`) per cercare, Invio e Maiusc+Invio per passare da un'occorrenza all'altra; **Esc** chiude la ricerca o, se è chiusa, termina la sessione (come il pulsante **Fine**). Quando la sessione finisce, il terminale stampa il riepilogo come su Windows:

```
  Sessione: 42 s di attenzione su 31 righe · origine «lettura»
  Righe lette: 63% → 94% · nessuna riga critica da leggere
```

`--autotest <s>` fa scorrere la pagina da sola (attività simulata, registrata come «simulazione»). Con `--schermata <png>` il lettore si apre in Chrome headless con una cartella di profilo temporanea, 1000×660 pixel come la finestra originale, e la schermata si cattura con il protocollo DevTools tramite il WebSocket integrato in Node: niente dipendenze.

## Differenze dalla versione Windows

- **Il lettore è una pagina web**, non una finestra WinForms. Una pagina non può chiudere la scheda in cui l'hai aperta tu: con Esc o **Fine** la sessione si chiude, l'attenzione si salva e la pagina dice che puoi chiudere la scheda. Anche chiudere direttamente la scheda chiude la sessione. Per questo il secondo messaggio di `leggi` dice «scheda» invece di «finestra» e cita anche il tocco e il pulsante «Fine».
- **«Ha il focus»** significa: la scheda è quella visibile e il browser è l'applicazione in primo piano. Su Windows si controllava la finestra in primo piano del sistema.
- **La schermata** (`--schermata`) richiede Chrome, Chromium, Edge o Brave (si può indicare il programma con `SGUARDO_CHROME=<percorso>`). Senza, `leggi --autotest --schermata` apre comunque il lettore nel browser predefinito ma esce con codice 2 e «schermata non salvata». La schermata è della pagina, non di una finestra del sistema.
- **Lo scorrimento è a pixel**, non a righe intere: la riga «visibile» più in alto è quella il cui inizio è più vicino al bordo. Esiste la normale barra di scorrimento del Mac accanto alla mappa del file.
- **Percorsi con `/`**: i messaggi dicono `.sguardo/regole.json`, `negozio/rimborsi.js`. Il JSON già usava `/` nel campo `file`. Il piè di pagina del rapporto HTML dice `.sguardo/regole.json`.
- **Colori in console** con i codici ANSI, solo se l'uscita è un terminale (e mai con `NO_COLOR`). Il «bianco» della versione Windows qui è il grassetto, per leggersi anche con i temi chiari.
- **Tema chiaro e scuro** anche nel lettore (su Windows era solo scuro); le barre del margine hanno gli stessi colori.
- Le regole in `.sguardo/regole.json` si rileggono a ogni richiesta del server web: se le modifichi, basta aggiornare la pagina.
- Variabili d'ambiente in più: `PORT` e `SGUARDO_PROGETTO` (server), `SGUARDO_CHROME`, `SGUARDO_NON_APRIRE=1` (leggi stampa l'indirizzo senza aprire il browser), `SGUARDO_PORTA_LETTORE`, `SGUARDO_OGGI` (solo per i test: fissa il giorno salvato in «ultima»).

## Novità rispetto alla versione Windows

1. **`sguardo pulisci [cartella] [--prova]`** risolve il limite «il JSON conserva le impronte delle versioni vecchie e cresce nel tempo». Toglie da ogni JSON le impronte che non corrispondono più a nessuna riga attuale del file, e i dati dei file sorgente che non esistono più. Con `--prova` mostra cosa toglierebbe senza toccare nulla. Il formato resta `sguardo/1`. Il prezzo, dichiarato anche in console: una riga che torna esattamente com'era non ritrova più la sua attenzione passata. Da una sottocartella pulisce solo i file di quella cartella.
2. **Ricerca nel lettore e scorrimento orizzontale** risolvono il limite «il lettore è essenziale: niente scorrimento orizzontale, niente ricerca». Le righe lunghe non vengono più tagliate: si scorrono in orizzontale mentre il margine con numeri e barre resta fermo. ⌘F apre la ricerca, con conteggio («2 di 11»), maiuscole indifferenti o no, evidenziazione di tutte le occorrenze e salto a quella successiva.
3. **`sguardo verifica --formato github`** stampa, oltre al testo normale, una annotazione `::error file=…,line=…` per ogni riga critica non letta: in GitHub Actions compaiono direttamente sulle righe della pull request. Se la verifica passa solo grazie all'attenzione simulata, stampa un `::warning` che consiglia `--solo-letture`. Esempio di passo nel workflow:

   ```yaml
   - run: node sguardo/mac/bin/sguardo.mjs verifica . --solo-letture --formato github
   ```
4. **L'interfaccia web del progetto** (`npm start`): esito della verifica, statistiche, impronta dell'attenzione di ogni file, righe critiche non lette con un collegamento che apre il lettore proprio su quella riga, rapporto HTML generato al volo, interruttore «solo letture vere». Si aggiorna da sola quando torni sulla pagina dopo aver letto un file.

Tutto è coperto dai test (`test/novita.test.mjs`, `test/lettore.test.mjs`, `test/pagina.test.mjs`, `test/server.test.mjs`).

## I test

`node --test` esegue:

| File | Cosa controlla |
|---|---|
| `test/cli.test.mjs` | il port di `src/test.ps1`: init, soglie, impronte (spostate, modificate, identiche), verifica e codici di uscita, regole configurabili, rapporto e HTML autonomo, ricerca di `.sguardo/` risalendo, privacy dei JSON (nessun nome utente, nome del computer o percorso assoluto) |
| `test/leggi.test.mjs` | `sguardo leggi`: server temporaneo, fine della sessione, riepilogo, errori; e la sezione «lettore, autotest» di `test.ps1` con Chrome vero: chiusura automatica, PNG ≥ 400×300 con almeno 20 colori, attenzione «simulazione» nel JSON |
| `test/lettore.test.mjs` | la logica del lettore: pesi, fuoco e campana, quando si registra, colori del margine, autotest, ricerca |
| `test/pagina.test.mjs` | le pagine vere in Chrome headless: lettura registrata come «lettura», pausa per inattività, ricerca, righe lunghe, ricarica del file cambiato, pagina del progetto, niente scorrimento orizzontale a 375 px |
| `test/server.test.mjs` | pagine, API, sicurezza (Host, Origin, percorsi fuori dal progetto), una sessione di lettura simulata, `server.mjs` |
| `test/nucleo.test.mjs` | SHA-256 contro `node:crypto`, impronte, formati italiani, JSON riscritti identici byte per byte, regole, evidenziatore, intervalli |
| `test/fedelta.test.mjs` | rifà la demo e confronta i rapporti con quelli della versione Windows; legge i dati demo esistenti (su una copia) |
| `test/lanciatori.test.mjs` | `avvia.command` (con un finto `open`: apre il browser sul proprio server, non su un altro programma che occupa la porta, e lo spegne alla chiusura) e `sguardo.command`, da una cartella con spazi e accenti |
| `test/revisione.test.mjs` | regressioni trovate in revisione: ordine dei file come su Windows, JSON vuoti, `pulisci` che non tocca i dati di file esistenti, `leggi` con salvataggio finale fallito, uscita verso una pipe lenta |

I test lavorano in cartelle temporanee e non toccano `../demo`.

## Limiti onesti

Valgono tutti quelli della versione Windows (è un'euristica, non eye tracking; la soglia non tiene conto della complessità; le righe identiche possono scambiarsi la lettura; un vero prodotto vivrebbe nell'editor), tranne i due risolti sopra. In più:

- **Il browser non sa dove guardi più di quanto lo sapesse WinForms**: sa che la scheda è attiva e dove sta il puntatore. Sul telefono o sul trackpad senza puntatore sopra il testo, il fuoco va al 40% dell'area visibile.
- **Chiusure brusche**: se il browser si chiude di colpo o premi Ctrl+C nel terminale mentre la pagina è aperta, si possono perdere gli ultimi secondi (al massimo 10) non ancora salvati. Di solito `sendBeacon` alla chiusura della scheda li salva.
- **Schede in secondo piano**: il browser rallenta i timer delle schede nascoste, ma lì Sguardo è comunque in pausa.
- **Concorrenza**: il server scrive in modo atomico e somma a quanto c'è su disco; due processi diversi che scrivono nello stesso istante (per esempio `simula` mentre il lettore salva) possono ancora perdere una frazione di secondo, come su Windows.
- **Una sola macchina**: i dati restano nella cartella del progetto; non c'è unione tra più revisori.
- **La schermata** dipende da un browser Chromium installato; senza, la si può fare a mano.

## Com'è fatto

```
mac/
  package.json            nessuna dipendenza; npm start / npm test / npm run demo
  server.mjs              interfaccia web del progetto (127.0.0.1, porta PORT o 5176)
  bin/sguardo.mjs         la riga di comando
  bin/demo.mjs            la demo narrata
  lib/                    il nucleo, moduli ES senza node:* (li usa anche il browser)
    cultura.mjs           formati italiani (secondi, percentuali, date), errori
    sha256.mjs            SHA-256 in JavaScript puro, sincrono
    impronte.mjs          normalizzazione e impronte delle righe
    json.mjs              lettura e scrittura del JSON come la versione Windows
    regole.mjs            regole.json: critiche, marcatori IA, soglia, estensioni
    registro.mjs          il registro dell'attenzione, formato sguardo/1
    analisi.mjs           stato di ogni riga, file analizzato, analisi di una cartella
    evidenziatore.mjs     colorazione della sintassi
    attenzione.mjs        la logica del lettore: pesi, fuoco, registrazione, colori, ricerca
    rapporto-html.mjs     il rapporto HTML autonomo
    node/                 solo Node: disco, server HTTP, comandi, Chrome headless, demo
  web/                    index.html + app.js (progetto), lettore.html + lettore.js, CSS, icona
  test/                   node --test
  *.command               lanciatori per il doppio clic nel Finder
```
