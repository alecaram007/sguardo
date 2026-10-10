#!/usr/bin/env node
// SGUARDO - interfaccia web di un progetto: elenco dei file con l'impronta
// dell'attenzione e lo stato della verifica, lettore, rapporto HTML.
//
//   node server.mjs [cartella]          (oppure SGUARDO_PROGETTO=<cartella>)
//   PORT=5176 node server.mjs
//
// Senza argomenti apre la demo per Mac, mac/demo/negozio (la crea demo.command).
// Se non c'è ancora, la crea copiando la demo della versione Windows (../demo/negozio),
// che resta intatta: il lettore scrive i dati di lettura solo nella copia.
// Ascolta solo su 127.0.0.1: nessun altro computer può collegarsi.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Errore } from './lib/cultura.mjs';
import { Progetto } from './lib/node/progetto.mjs';
import { creaGestore } from './lib/node/servizio.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA_ASSEGNATA = 5176;
// Una PORT non valida (per esempio 99999 o «abc») va spiegata, non deve dare una pila di Node.
const porta = process.env.PORT ? Number(process.env.PORT) : PORTA_ASSEGNATA;
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  console.error("  Errore: PORT='" + process.env.PORT + "' non è una porta valida: serve un numero da 1 a 65535.");
  process.exit(2);
}
const DEMO_WINDOWS = path.resolve(QUI, '..', 'demo', 'negozio');
// SGUARDO_DEMO_CARTELLA come per bin/demo.mjs (la usano i test).
const DEMO_MAC = path.resolve(process.env.SGUARDO_DEMO_CARTELLA || path.join(QUI, 'demo'));

// Alla prima esecuzione copia la demo Windows in mac/demo/negozio (in una cartella
// temporanea, poi rinominata: niente copie a metà). Il marcatore permette a
// demo.command di ricrearla in seguito.
function preparaDemoMac() {
  const negozio = path.join(DEMO_MAC, 'negozio');
  if (fs.existsSync(negozio)) return negozio;
  if (!fs.existsSync(DEMO_WINDOWS)) {
    throw new Errore('La demo non c\'è ancora: creala con un doppio clic su demo.command (oppure npm run demo).');
  }
  const nuova = !fs.existsSync(DEMO_MAC);
  fs.mkdirSync(DEMO_MAC, { recursive: true });
  if (nuova) fs.writeFileSync(path.join(DEMO_MAC, '.demo-sguardo'), 'Cartella generata da bin/demo.mjs: viene ricreata a ogni esecuzione.\n');
  const tmp = fs.mkdtempSync(path.join(DEMO_MAC, '.copia-'));
  try {
    fs.cpSync(DEMO_WINDOWS, tmp, { recursive: true });
    fs.renameSync(tmp, negozio);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  console.log('  Creata la demo per Mac copiando quella della versione Windows (che resta intatta).');
  return negozio;
}

let progetto;
try {
  const cartella = process.argv[2] || process.env.SGUARDO_PROGETTO || preparaDemoMac();
  progetto = Progetto.trova(cartella);
} catch (e) {
  console.error('  Errore: ' + (e instanceof Errore ? e.message : e.message));
  console.error('  Indica una cartella con .sguardo/:  node server.mjs <cartella>   (oppure crea il progetto con  node bin/sguardo.mjs init <cartella>)');
  process.exit(2);
}

const server = http.createServer(creaGestore({ progetto, modalita: 'progetto' }));
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('  Errore: la porta ' + porta + ' è già in uso. Prova con  PORT=<altra porta> npm start');
  else if (e.code === 'EACCES') console.error('  Errore: non ho il permesso di usare la porta ' + porta + ' (quelle sotto 1024 sono riservate). Prova con  PORT=<altra porta> npm start');
  else console.error('  Errore: ' + e.message);
  process.exit(2);
});
server.listen(porta, '127.0.0.1', () => {
  console.log('');
  console.log('  Sguardo · interfaccia web');
  console.log('  progetto  ' + progetto.radice);
  console.log('  indirizzo http://127.0.0.1:' + porta + '/');
  console.log('  (Ctrl+C per chiudere)');
});

const chiudi = () => {
  server.closeAllConnections?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on('SIGINT', chiudi);
process.on('SIGTERM', chiudi);
