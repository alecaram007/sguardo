#!/usr/bin/env node
// Demo di Sguardo: un piccolo negozio online con tre file sorgente, uno
// scritto dall'IA con un bug nei rimborsi. Una revisione umana (simulata)
// salta proprio quel blocco, e Sguardo se ne accorge.
// Tutto avviene nella cartella "demo" accanto a questo script (mac/demo).
//
// Opzioni:  --veloce   l'autotest del lettore dura 2 s invece di 6
//           --senza-lettore   salta il passo 9 (lettore in autotest)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CARRELLO, PAGAMENTI, RIMBORSI, correggiRimborsi } from '../lib/node/negozio.mjs';
import { trovaChrome } from '../lib/node/chrome.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..');
const SGUARDO = path.join(QUI, 'sguardo.mjs');
const argomenti = process.argv.slice(2);
const veloce = argomenti.includes('--veloce') || process.env.SGUARDO_VELOCE === '1';
const senzaLettore = argomenti.includes('--senza-lettore');
const demo = path.resolve(process.env.SGUARDO_DEMO_CARTELLA || path.join(RADICE, 'demo'));
const marcatore = path.join(demo, '.demo-sguardo');
const negozio = path.join(demo, 'negozio');

const colori = !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
const c = (codice, testo) => (colori ? '\x1b[' + codice + 'm' + testo + '\x1b[0m' : testo);
const scrivi = (testo = '') => process.stdout.write(testo + '\n');

if (fs.existsSync(demo)) {
  if (!fs.existsSync(marcatore)) {
    console.error("  La cartella '" + demo + "' esiste ma non l'ha creata la demo: non la tocco.");
    process.exit(1);
  }
  fs.rmSync(demo, { recursive: true, force: true });
}
fs.mkdirSync(negozio, { recursive: true });
fs.writeFileSync(marcatore, 'Cartella generata da bin/demo.mjs: viene ricreata a ogni esecuzione.\n');

let uscita = 0;
function sguardo(...args) {
  scrivi();
  scrivi(c(36, '  > sguardo ' + args.join(' ')));
  const r = spawnSync(process.execPath, [SGUARDO, ...args], { cwd: demo, stdio: 'inherit', env: process.env });
  uscita = r.status ?? 2;
}
function titolo(testo) {
  scrivi();
  scrivi();
  scrivi(c(35, '━━━ ' + testo));
}
function racconta(testo) {
  scrivi();
  for (const riga of testo.split('\n')) scrivi(c(37, '  ' + riga.trimEnd()));
}
function codiceUscita() {
  scrivi(c(uscita === 0 ? 32 : 31, '  codice di uscita: ' + uscita));
}

// ---------------------------------------------------------------------------
// Il negozio
// ---------------------------------------------------------------------------
fs.writeFileSync(path.join(negozio, 'carrello.js'), CARRELLO, 'utf8');
fs.writeFileSync(path.join(negozio, 'pagamenti.js'), PAGAMENTI, 'utf8');
const rimborsi = path.join(negozio, 'rimborsi.js');
fs.writeFileSync(rimborsi, RIMBORSI, 'utf8');

// ---------------------------------------------------------------------------
// La storia
// ---------------------------------------------------------------------------
titolo("1 · Un piccolo negozio online: tre file, uno scritto dall'IA");
scrivi();
for (const nome of fs.readdirSync(negozio).filter((n) => n.endsWith('.js')).sort()) {
  const righe = fs.readFileSync(path.join(negozio, nome), 'utf8').split(/\r\n|\n/);
  if (righe[righe.length - 1] === '') righe.pop();
  scrivi(c(1, '  ' + nome.padEnd(14) + ' ' + String(righe.length).padStart(3) + ' righe   ' + righe[1].replace(/^[/ ]+/, '')));
}
racconta(`Con l'IA che scrive sempre più codice, la domanda vera non è più «chi l'ha scritto?»
ma «qualcuno l'ha letto?». Attiviamo Sguardo nel progetto.`);
sguardo('init', 'negozio');

titolo('2 · La revisione: carrello e pagamenti letti tutti, rimborsi.js solo in parte');
racconta(`Il revisore legge con cura carrello.js e pagamenti.js. Di rimborsi.js legge l'inizio
e la fine, dà un'occhiata alla firma di emettiRimborso() e salta il corpo: «è dell'IA,
sembra a posto». (Qui la lettura è simulata; nella realtà la registra  sguardo leggi <file>.)`);
sguardo('simula', 'negozio/carrello.js', '1-31', '45');
sguardo('simula', 'negozio/pagamenti.js', '1-32', '50');
sguardo('simula', 'negozio/rimborsi.js', '1-19', '30');
sguardo('simula', 'negozio/rimborsi.js', '20', '1');
sguardo('simula', 'negozio/rimborsi.js', '33-41', '25');

titolo('3 · Il rapporto: chi ha letto cosa');
sguardo('rapporto', 'negozio', '--html', 'revisione-parziale.html');

titolo("4 · Dov'è il bug? Proprio tra le righe mai lette");
sguardo('mostra', 'negozio/rimborsi.js', '16-31');
racconta(`emettiRimborso() controlla solo che l'importo sia positivo: non lo confronta mai con
importoRimborsabile(). Si può rimborsare più di quanto è stato pagato, e più volte.
La funzione giusta esiste (riga 16), ma le righe che avrebbero dovuto usarla non le ha
lette nessuno. git blame direbbe chi le ha scritte; Sguardo dice che nessuno le ha lette.`);

titolo('5 · La CI chiede a Sguardo: le righe critiche sono state lette?');
sguardo('verifica', 'negozio');
codiceUscita();
racconta('La pipeline si ferma prima del merge.');

titolo('6 · Un umano legge davvero il blocco (simulato) e la verifica passa');
sguardo('simula', 'negozio/rimborsi.js', '20-31', '40');
sguardo('verifica', 'negozio');
codiceUscita();

titolo("7 · Qualcuno corregge il bug: una riga cambia e un'altra si aggiunge in cima");
const corretto = correggiRimborsi(fs.readFileSync(rimborsi, 'utf8'));
fs.writeFileSync(rimborsi, corretto.testo, 'utf8');
scrivi();
scrivi(c('2;31', '  riga 24  - ' + corretto.vecchia));
scrivi(c(32, '  riga 25  + ' + corretto.righe[24]));
scrivi(c(32, '  riga 3   + ' + corretto.righe[2]));
sguardo('mostra', 'negozio/rimborsi.js', '1-5,21-32');
racconta(`Tutte le righe sotto la 3 si sono spostate di una posizione ma restano lette: l'impronta
segue il contenuto della riga, non il suo numero. La riga corretta invece torna «mai letta»,
e ha ragione: la versione nuova non l'ha ancora letta nessuno.`);
sguardo('verifica', 'negozio');
codiceUscita();

titolo('8 · Il rapporto HTML');
sguardo('rapporto', 'negozio');

const durata = veloce ? 2 : 6;
titolo('9 · Il lettore vero: autotest della pagina per ' + durata + ' secondi');
if (senzaLettore) {
  racconta('Passo saltato (--senza-lettore).');
} else if (!trovaChrome()) {
  racconta(`Per l'autotest con schermata serve Google Chrome (o Chromium): qui non c'è, quindi salto
questo passo. Il lettore vero lo apri con  node bin/sguardo.mjs leggi demo/negozio/rimborsi.js`);
} else {
  racconta(`Il lettore si apre in un Chrome invisibile (headless): scorre da solo simulando un lettore,
salva una schermata e si chiude. È solo una prova che l'interfaccia funziona: questa attenzione
viene registrata come «simulazione», non come lettura umana.`);
  sguardo('leggi', 'negozio/rimborsi.js', '--autotest', String(durata), '--schermata', 'lettore-autotest.png');
}

titolo('Fine');
scrivi();
scrivi(c(1, '  Rapporto dopo la revisione parziale:  ' + path.join(demo, 'revisione-parziale.html')));
scrivi(c(1, '  Rapporto finale:                      ' + path.join(negozio, 'sguardo-rapporto.html')));
if (fs.existsSync(path.join(demo, 'lettore-autotest.png'))) {
  scrivi(c(1, '  Schermata del lettore:                ' + path.join(demo, 'lettore-autotest.png')));
}
scrivi();
scrivi(c(90, '  Per leggere tu la riga corretta:  node bin/sguardo.mjs leggi demo/negozio/rimborsi.js'));
scrivi(c(90, "  Oppure l'interfaccia web della demo:  node server.mjs demo/negozio"));
scrivi();
