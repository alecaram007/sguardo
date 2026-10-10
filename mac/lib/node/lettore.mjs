// SGUARDO - "sguardo leggi": avvia un piccolo server locale, apre il lettore nel
// browser e aspetta che la sessione finisca (Esc, «Fine» o scheda chiusa).
// Solo Node.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { creaGestore } from './servizio.mjs';
import { analizzaFile } from './progetto.mjs';
import { avviaHeadless } from './chrome.mjs';

export class EsitoLettura {
  constructor() {
    this.attenzione = 0;
    this.righeToccate = 0;
    this.frazionePrima = 0;
    this.frazioneDopo = 0;
    this.criticheNonLette = 0;
    this.schermata = null;
    this.errore = null;
    this.simulata = false;
    this.percorsoDati = null;
    this.indirizzo = null;
  }
}

function apriNelBrowser(url) {
  return new Promise((risolvi) => {
    const comando = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const argomenti = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    let figlio;
    try { figlio = spawn(comando, argomenti, { stdio: 'ignore', detached: true }); }
    catch { risolvi(false); return; }
    figlio.on('error', () => risolvi(false));
    figlio.on('exit', (c) => risolvi(c === 0));
    figlio.unref();
  });
}

// opzioni: { progetto, percorso, autotest (s), schermata (png), avvisa(testo) }
export async function apriLettore({ progetto, percorso, autotest = 0, schermata = null, avvisa = () => {} }) {
  const esito = new EsitoLettura();
  const pieno = path.resolve(percorso);
  const prima = analizzaFile(progetto, pieno, false);
  esito.frazionePrima = prima.frazione;
  esito.simulata = autotest > 0;
  esito.percorsoDati = prima.percorsoDati;
  const rel = prima.relativo;

  const toccate = new Set();
  let fineRisolvi;
  const fine = new Promise((r) => { fineRisolvi = r; });
  let timerFine = null;
  let erroreSalvataggio = null;
  const chiudiTra = () => {
    if (timerFine) clearTimeout(timerFine);
    timerFine = setTimeout(() => fineRisolvi('fine'), autotest > 0 ? 50 : 1500);
  };

  const gestore = creaGestore({
    progetto,
    modalita: 'leggi',
    fileLettore: rel,
    eventi: {
      // Una nuova pagina (per esempio dopo un aggiornamento) annulla la chiusura.
      carica() { if (timerFine) { clearTimeout(timerFine); timerFine = null; } },
      salva(e, corpo) {
        if (e.relativo === rel) {
          esito.attenzione += e.somma;
          for (const t of e.toccate) toccate.add(t);
        }
        if (corpo && corpo.fine === true) {
          erroreSalvataggio = null;
          chiudiTra();
        }
      },
      // Come Chiudi() della versione Windows: se l'ultimo salvataggio non riesce la
      // sessione finisce lo stesso, con «salvataggio non riuscito» e codice 2.
      salvaFallito(messaggio, corpo) {
        if (corpo && corpo.fine === true) {
          erroreSalvataggio = 'salvataggio non riuscito: ' + messaggio;
          chiudiTra();
        }
      }
    }
  });

  const server = http.createServer(gestore);
  const portaChiesta = Number(process.env.SGUARDO_PORTA_LETTORE) || 0;
  await new Promise((ok, ko) => { server.once('error', ko); server.listen(portaChiesta, '127.0.0.1', ok); });
  const porta = server.address().port;
  let url = 'http://127.0.0.1:' + porta + '/lettore.html?f=' + encodeURIComponent(rel);
  if (autotest > 0) url += '&autotest=' + autotest;
  esito.indirizzo = url;

  let headless = null;
  const interrompi = () => fineRisolvi('interrotto');
  process.once('SIGINT', interrompi);
  process.once('SIGTERM', interrompi);
  let scadenza = null;

  try {
    if (schermata) {
      try { headless = await avviaHeadless(url); }
      catch (e) { esito.errore = 'schermata non salvata: ' + e.message; }
    }
    if (!headless) {
      if (process.env.SGUARDO_NON_APRIRE === '1') avvisa('Apri questo indirizzo nel browser:  ' + url);
      else if (!(await apriNelBrowser(url))) avvisa('Non riesco ad aprire il browser: apri tu  ' + url);
      else avvisa('Indirizzo del lettore:  ' + url + '   (Ctrl+C qui per chiudere)');
    }
    if (autotest > 0) scadenza = setTimeout(() => fineRisolvi('scaduto'), (autotest + 60) * 1000);

    const motivo = await fine;
    if (erroreSalvataggio && !esito.errore) esito.errore = erroreSalvataggio;
    if (motivo === 'scaduto' && !esito.errore) esito.errore = 'il lettore non ha risposto entro ' + Math.round(autotest + 60) + ' s';

    if (headless) {
      if (motivo === 'fine') {
        try {
          const png = await headless.cattura();
          const destinazione = path.resolve(schermata);
          fs.mkdirSync(path.dirname(destinazione), { recursive: true });
          fs.writeFileSync(destinazione, png);
          esito.schermata = destinazione;
        } catch (e) {
          esito.errore = 'schermata non salvata: ' + e.message;
        }
      }
      await headless.chiudi();
    }
  } finally {
    if (scadenza) clearTimeout(scadenza);
    if (timerFine) clearTimeout(timerFine);
    process.removeListener('SIGINT', interrompi);
    process.removeListener('SIGTERM', interrompi);
    server.closeAllConnections?.();
    await new Promise((r) => server.close(() => r()));
  }

  const dopo = analizzaFile(progetto, pieno, false);
  esito.righeToccate = toccate.size;
  esito.frazioneDopo = dopo.frazione;
  esito.criticheNonLette = dopo.criticheNonLette.length;
  return esito;
}
