# Sguardo

> Sguardo misura riga per riga quanta attenzione umana ha ricevuto il codice, e fa fallire la CI se le righe delicate non le ha mai lette nessuno: è un prototipo, in C# per Windows e in Node.js con interfaccia web per Mac.
> Per provarlo **su Mac** (serve Node.js 22 o successivo) fai doppio clic su `mac/avvia.command`, oppure `cd mac && npm start`; **su Windows** fai doppio clic su `demo.cmd`, che la prima volta compila `bin\sguardo.exe`.

**Chi ha letto davvero questo codice?**

L'IA scrive sempre più codice, e la domanda che conta non è più «chi l'ha scritto?» ma «qualcuno l'ha letto?». `git blame` dice chi ha scritto una riga. Sguardo dice se una persona l'ha **letta**, e per quanto tempo.

Mentre leggi un file nel lettore di Sguardo, ogni riga accumula secondi di attenzione. Alla fine sai quali righe sono state lette, quali solo sfiorate e quali nessuno ha mai guardato. Una pipeline di CI può rifiutare il merge finché le righe delicate (pagamenti, password, rimborsi...) non sono passate davanti agli occhi di un essere umano.

Questo è un prototipo funzionante per Windows e non richiede nessuna installazione: è scritto in C# 5 e lo compila `csc.exe` di .NET Framework 4.8, già presente nel sistema. Nel repository non c'è l'eseguibile: `sguardo.cmd`, `demo.cmd` e `test.cmd` lanciano `build.cmd` da soli se `bin\sguardo.exe` manca. Per la versione Mac vedi [Su Mac](#su-mac).

## Provalo subito

Su Windows fai doppio clic su **`demo.cmd`**.

La demo crea un piccolo negozio online in `demo\negozio`, con tre file JavaScript. Uno, `rimborsi.js`, è dichiarato «scritto dall'IA» in un commento e contiene un bug subdolo: `emettiRimborso()` controlla che l'importo sia positivo, ma non lo confronta mai con `importoRimborsabile()`, quindi si può rimborsare più di quanto è stato pagato.

Poi la demo racconta questa storia:

1. una revisione umana (simulata) legge tutto il resto e salta proprio quel blocco;
2. il rapporto mostra che il bug sta tra le righe **mai lette**;
3. `sguardo verifica` fallisce con codice 1, come farebbe in CI;
4. qualcuno legge il blocco e la verifica passa;
5. il bug viene corretto: le righe spostate restano lette, mentre la riga cambiata torna «mai letta» e la verifica fallisce di nuovo;
6. viene generato il rapporto HTML;
7. il lettore si apre per 6 secondi in autotest e salva una schermata.

Al termine trovi:

- `demo\revisione-parziale.html`, il rapporto dopo la revisione parziale;
- `demo\negozio\sguardo-rapporto.html`, il rapporto finale;
- `demo\lettore-autotest.png`, la finestra del lettore.

Nel repository questi tre file ci sono già, da un'esecuzione della demo su Windows, così puoi guardarli senza lanciarla; nei due rapporti la cartella del computer originale è stata sostituita con `C:\sguardo\demo\negozio`. La demo cancella e ricrea tutta la cartella `demo\` a ogni esecuzione. I test della versione Mac confrontano i propri rapporti con questi due.

Per i test automatici usa **`test.cmd`**. Compila, esegue i controlli e stampa OK o FALLITO per ciascuno. Esce con 1 se qualcosa non va.

## Se Windows blocca `sguardo.exe`

Su Windows 11, **Smart App Control** può bloccare gli eseguibili compilati in locale e non firmati, con il messaggio *«Un criterio di controllo dell'applicazione ha bloccato il file»*. Sguardo non tenta di aggirare questo controllo. Le strade possibili sono queste, e la scelta spetta a te:

- firmare `bin\sguardo.exe` con un certificato di firma del codice attendibile;
- usare un computer su cui Smart App Control è disattivato;
- disattivarlo da *Sicurezza di Windows → Controllo app e browser → Smart App Control*. Attenzione: una volta disattivato, **non si può riattivare** senza reinstallare o ripristinare Windows.

## Uso

Apri un terminale in questa cartella:

```
sguardo init <cartella>                  attiva Sguardo in un progetto (crea .sguardo\)
sguardo leggi <file>                     apre il lettore e registra l'attenzione
sguardo rapporto [cartella]              righe lette e mai lette, più sguardo-rapporto.html
sguardo verifica [cartella]              per la CI: esce con 1 se una riga critica non è stata letta
sguardo mostra <file> [da-a]             il file in console, con lo stato di ogni riga
sguardo simula <file> <da-a> <secondi>   registra attenzione simulata (demo e test)
sguardo righe <file>                     dati grezzi riga per riga (TSV, per script)
```

Opzioni:

| Opzione | Comandi | Effetto |
|---|---|---|
| `--solo-letture` | rapporto, verifica, mostra, righe | ignora l'attenzione simulata: è l'opzione da usare in una CI vera |
| `--html <file>` | rapporto | dove scrivere il rapporto HTML (predefinito: `sguardo-rapporto.html` nella radice del progetto) |
| `--autotest <s>` | leggi | la finestra scorre da sola per `<s>` secondi, poi si chiude |
| `--schermata <png>` | leggi --autotest | salva un'immagine della finestra |

I comandi diversi da `init` cercano la cartella `.sguardo\` **risalendo** dalla cartella indicata, come fa git. Puoi quindi lanciarli anche da una sottocartella.

Codici di uscita: `0` tutto bene, `1` verifica non passata, `2` errore (per esempio nessun progetto Sguardo trovato).

Gli intervalli si scrivono `18-31`, `12` oppure `1-10,15-20`. In PowerShell la virgola crea un array, ma Sguardo riunisce comunque gli argomenti. I secondi accettano sia `2,5` sia `2.5`.

## Come funziona

### 1. Il lettore

`sguardo leggi <file>` apre una finestra WinForms disegnata interamente a mano. Mostra il codice con i numeri di riga, un font monospazio, una colorazione essenziale della sintassi e lo scorrimento con rotella, barra e tastiera.

Ogni 250 ms Sguardo controlla due condizioni:

- **la finestra ha il focus**, cioè è quella in primo piano;
- **c'è stata attività negli ultimi 20 s** dentro la finestra: movimento del mouse, rotella o tasti.

Se entrambe sono vere, quei 0,25 s vengono distribuiti tra le righe **visibili e non vuote**. Il peso di ogni riga è:

```
peso = soglia della riga × (0,06 + e^(−d² / 2σ²))
```

- `d` è la distanza in righe dal puntatore del mouse, con σ = 3,5 righe.
- Se il puntatore è fuori dal testo, il fuoco si sposta al 40% dell'area visibile e la campana si allarga.
- Il termine 0,06 è la visione periferica: se resti a lungo su una schermata, alla fine conta anche il resto.
- Il peso è proporzionale alla soglia della riga (cioè alla sua lunghezza). Così tutte le righe vicine al fuoco diventano «lette» nello stesso momento, comprese le `}` brevi.

Nel margine, una barra per riga va dal **grigio** (mai letta) all'**oliva** (sfiorata) e poi al **verde**, sempre più intenso con l'attenzione. La barra di scorrimento fa anche da mappa dell'intero file e segna in rosso le righe critiche non lette.

In alto un indicatore mostra in ogni momento se Sguardo sta registrando oppure è in pausa, e perché. In basso compare lo stato del file, per esempio *«Lette da un umano: 63% delle righe · 2 righe critiche non lette»*.

I dati si salvano ogni 10 secondi e alla chiusura. Se il file cambia su disco mentre è aperto, viene ricaricato.

### 2. L'impronta di una riga

Ogni riga è identificata dal suo contenuto, non dalla sua posizione:

```
impronta = SHA-256(riga normalizzata)[primi 6 byte] + "#" + occorrenza
```

- **Normalizzata** significa senza spazi iniziali e finali, con gli spazi interni compressi. Cambiare il rientro non cambia la riga.
- **Occorrenza** distingue le righe identiche. La prima `}` del file è `…#0`, la seconda `…#1`, e così via.

Le conseguenze sono queste:

- **le righe che si spostano** (perché sopra ne hai aggiunte o tolte) **restano lette**;
- **una riga modificata torna «mai letta»**, ed è giusto così: la versione nuova non l'ha letta nessuno;
- se una riga torna esattamente com'era, ritrova la sua attenzione.

### 3. Quando una riga è «letta»

```
soglia = max(0,4 s ; 0,05 s × caratteri non spazio)
```

La quota di 0,05 s per carattere corrisponde a 20 caratteri al secondo, una lettura attenta ma non lenta, più lenta della prosa come succede con il codice. Il minimo di 0,4 s serve alle righe brevissime, che vanno comunque guardate. Esempi reali della demo:

| Riga | Caratteri | Soglia |
|---|---|---|
| `}` | 1 | 0,4 s |
| `const GIORNI_PER_IL_RESO = 30;` | 27 | 1,4 s |
| `return ordine.pagato - (ordine.rimborsato \|\| 0);` | 44 | 2,2 s |
| `async function emettiRimborso(ordine, importo, motivo) {` | 51 | 2,6 s |

Ogni riga si trova in uno di tre stati:

- **letta**: attenzione ≥ soglia;
- **sfiorata**: qualche attenzione, ma sotto soglia;
- **mai letta**: nessuna attenzione.

L'attenzione si somma tra sessioni diverse. Entrambi i valori sono configurabili in `.sguardo\regole.json`.

`sguardo simula <file> <da-a> <secondi>` distribuisce i secondi tra le righe dell'intervallo in proporzione alle loro soglie, come farebbe un lettore che legge tutto il blocco con la stessa cura. Così l'intervallo risulta letto esattamente quando i secondi raggiungono la somma delle soglie, e il comando lo dice: *«40 s su 12 righe (per leggerle tutte ne servono 20 s)»*.

### 4. Righe critiche e verifica

Una riga è **critica** se contiene una di queste parole, senza distinzione tra maiuscole e minuscole:

```
password|token|segreto|secret|pagament|payment|crypt|auth|sql|admin|delete|drop|rimbors|iban
```

Si usa `rimbors` e non `rimborso` perché la stessa radice copre anche *rimborsi*, *rimborsabile* e *rimborsato*. Lo stesso vale per `pagament`.

L'espressione è modificabile in `.sguardo\regole.json`, insieme ai marcatori che riconoscono un file «scritto dall'IA», alle estensioni considerate e alle cartelle escluse.

`sguardo verifica` elenca le righe critiche non lette ed esce con 1. In una CI vera va usato `--solo-letture`, perché altrimenti anche l'attenzione simulata conta.

### 5. Dove finiscono i dati

```
progetto\
  .sguardo\regole.json                  righe critiche, soglia, estensioni, inattività
  .sguardo\letture\rimborsi.js.json     un JSON per file, con lo stesso percorso del sorgente
  sguardo-rapporto.html                 generato da "sguardo rapporto"
```

Estratto reale dalla demo:

```json
{
  "formato": "sguardo/1",
  "file": "rimborsi.js",
  "righe": {
    "07ba3f330d38#0": {"secondi": 2.266, "simulati": 2.266, "sessioni": 2, "ultima": "2026-10-01", "origine": "simulazione"},
    "0cdb95c93bdf#0": {"secondi": 5.184, "simulati": 5.184, "sessioni": 2, "ultima": "2026-10-01", "origine": "simulazione"},
```

Il campo `origine` vale `lettura`, `simulazione` (da `sguardo simula` o dall'autotest) oppure `mista`.

### 6. Il rapporto HTML

`sguardo rapporto` scrive un unico file HTML autonomo, senza script, font o immagini esterne. Funziona offline e si allega a una pull request. Contiene:

- l'esito della verifica;
- le statistiche: percentuale di righe lette, righe mai lette, righe critiche non lette, attenzione totale e quota simulata;
- una tabella dei file con l'«impronta dell'attenzione» di ciascuno;
- la **mappa di calore** del codice. Le righe mai lette sono in ombra, sbiadite e tratteggiate. Le righe lette hanno una tinta verde proporzionale all'attenzione. Le righe critiche non lette sono in rosso, con collegamenti diretti.

Il rapporto segue il tema chiaro o scuro del sistema (`prefers-color-scheme`). Passando il mouse su una riga compaiono secondi, soglia, sessioni, ultima lettura e origine.

## Cosa esiste già, cosa è nuovo

**Esiste già:**

- `git blame` dice chi ha *scritto* ogni riga e quando;
- GitHub ha la spunta **«Viewed»**, ma vale per un *file intero* in una pull request e la mette a mano chi rivede;
- gli strumenti di code review registrano approvazioni e commenti, mai che cosa è stato effettivamente guardato;
- l'eye tracking sul codice esiste, ma nei laboratori di ricerca, con hardware dedicato.

**È nuovo:** la **provenienza dell'attenzione umana, riga per riga**. È un dato che sopravvive agli spostamenti del codice, si azzera quando una riga cambia e può fermare una pipeline. Nell'epoca del codice generato, «letto da un umano» diventa una proprietà del codice che si può misurare e verificare, accanto a «testato» e «compilato».

## Privacy: misura le righe, non le persone

- Nei dati **non c'è nessun nome**: né utente, né computer, né revisore.
- Si salvano solo **tempi aggregati per riga**: secondi totali, numero di sessioni, *giorno* dell'ultima lettura (non l'ora) e origine.
- Non si registrano sequenze di movimenti, coordinate del mouse o schermate. Le schermate esistono solo in autotest, su richiesta esplicita.
- Non si sa chi ha letto una riga, solo che qualcuno l'ha letta. Sguardo non è pensato per valutare le persone e, con questi dati, non può farlo.
- I test verificano che nei JSON non compaiano nome utente, nome del computer o percorsi assoluti.

## Limiti onesti

- **È un'euristica, non eye tracking.** Sguardo sa che la finestra era attiva, che c'era attività e dove stava il puntatore, non dove guardavano gli occhi. Chi lascia la finestra aperta muovendo il mouse a caso «legge», e chi legge senza toccare nulla per più di 20 secondi va in pausa. Il dato dice «questa riga è stata davanti a una persona attiva abbastanza a lungo», non «è stata capita».
- **Un vero prodotto sarebbe un'estensione di VS Code o JetBrains,** cioè dove il codice si legge davvero. Le API dell'editor danno già righe visibili, cursore e focus. I dati viaggerebbero con git (in `git notes` o in un file versionato) e si unirebbero tra più revisori. Qui invece restano nella cartella del progetto.
- **La soglia è uguale per tutte le righe:** non tiene conto della complessità. Una regex densa e un commento della stessa lunghezza «costano» uguale.
- **Righe identiche:** se aggiungi una nuova `}` *sopra* altre `}` identiche, gli indici di occorrenza scorrono e la lettura passa da una graffa all'altra. È innocuo per righe banali, ma va saputo.
- **Il JSON conserva anche le impronte delle versioni vecchie** delle righe (così una riga ripristinata ritrova la sua lettura) e quindi cresce nel tempo. Manca un comando di pulizia.
- **Il lettore è essenziale:** niente scorrimento orizzontale (le righe molto lunghe vengono tagliate), niente ricerca, evidenziazione della sintassi approssimativa.
- **Concorrenza:** il lettore rilegge e somma prima di salvare, ma due processi che scrivono nello stesso istante possono perdere qualche frazione di secondo.
- **Smart App Control** può bloccare l'eseguibile compilato in locale (vedi sopra).

## Com'è fatto

```
sguardo.cmd          lanciatore: compila se manca bin\sguardo.exe, poi lo esegue
build.cmd            csc.exe di .NET Framework 4.8 → bin\sguardo.exe
demo.cmd / test.cmd  demo narrata e test automatici
src\Nucleo.cs        progetto, regole, impronte, registro JSON, analisi
src\Lettore.cs       la finestra: disegno, attenzione, autotest, schermata
src\RapportoHtml.cs  il rapporto HTML autonomo
src\Evidenziatore.cs colorazione della sintassi condivisa
src\Programma.cs     comandi e output in console
src\demo.ps1         la demo
src\test.ps1         i test
demo\                l'esito di un'esecuzione di demo.cmd (la demo la ricrea)
mac\                 la versione per Mac, in Node.js (vedi sotto)
```

## Su Mac

La cartella [`mac/`](mac/README.md) contiene Sguardo rifatto in Node.js con un'interfaccia web, senza dipendenze: stessi comandi, stessi messaggi, stessi dati in `.sguardo/`. Serve Node.js 22 o successivo.

- **Interfaccia web:** doppio clic su `mac/avvia.command` (apre `http://localhost:5176` sulla demo per Mac, `mac/demo/negozio`, che non è nel repository: la prima volta si crea copiando `demo/negozio`, che resta intatta), oppure `cd mac && npm start`.
- **Riga di comando:** `node mac/bin/sguardo.mjs <comando>` (per esempio `node mac/bin/sguardo.mjs verifica demo/negozio`).
- **Demo e test:** `mac/demo.command` e `mac/test.command`, oppure `npm run demo` e `npm test` dentro `mac/`.

Tutti i dettagli, le differenze e le novità sono in [mac/README.md](mac/README.md).

Licenza: da definire (per ora tutti i diritti riservati).
