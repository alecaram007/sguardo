#!/usr/bin/env node
// SGUARDO - chi ha letto davvero questo codice?
// Registra quali righe sono state lette da un essere umano, e per quanto.
//
// Uso:  node bin/sguardo.mjs <comando> [argomenti]        (sguardo aiuto)
import { esegui } from '../lib/node/comandi.mjs';

process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });
const codice = await esegui(process.argv.slice(2));
process.exitCode = codice;
// Se qualcosa resta appeso (per esempio un browser headless lento a chiudersi), esco comunque,
// ma solo dopo aver scritto tutto: con «| less» l'uscita verso la pipe può restare in attesa.
function esci() {
  if (process.stdout.writableLength > 0 || process.stderr.writableLength > 0) { setTimeout(esci, 100).unref(); return; }
  process.exit(codice);
}
setTimeout(esci, 3000).unref();
