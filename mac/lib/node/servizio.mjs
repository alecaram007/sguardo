// SGUARDO - il servizio HTTP locale: pagine statiche (web/), moduli condivisi (lib/)
// e una piccola API JSON. Lo usano sia "sguardo leggi" (un file, poi si chiude)
// sia server.mjs (l'interfaccia web di un intero progetto). Solo Node.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Errore, oggi, percento, secondi as Secondi } from '../cultura.mjs';
import { Stato, FileAnalizzato } from '../analisi.mjs';
import { FORMATO_IMPRONTA, normalizza } from '../impronte.mjs';
import { rapportoHtml, coloriStriscia } from '../rapporto-html.mjs';
import { analizzaFile, eseguiAnalisi, caricaRegistro, salvaRegistro, esisteFile } from './progetto.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
export const CARTELLA_WEB = path.resolve(QUI, '..', '..', 'web');
export const CARTELLA_LIB = path.resolve(QUI, '..');

// I moduli che il browser può importare: nessuno usa node:*.
const CONDIVISI = new Set(['cultura', 'sha256', 'impronte', 'json', 'regole', 'registro', 'analisi', 'evidenziatore', 'attenzione', 'rapporto-html']);

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

const CSP_PAGINE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const CSP_RAPPORTO = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

// Il rapporto resta identico a quello della riga di comando (e della versione Windows): nel
// browser aggiungo solo l'a capo nell'elenco delle parole critiche del piè di pagina, che
// senza spazi allargava la pagina oltre i 375 px di uno schermo stretto.
const A_CAPO_RAPPORTO = '<style>footer code{overflow-wrap:anywhere}</style>\n';

const MASSIMO_CORPO = 2 * 1024 * 1024;
const MASSIMO_PER_RIGA = 3600;    // secondi per riga in un solo salvataggio (solo un controllo di buon senso)
const MASSIMO_PER_INVIO = 3600;   // secondi totali in un solo salvataggio

export function firma(percorso) {
  const st = fs.statSync(percorso);
  return Math.round(st.mtimeMs) + ':' + st.size;
}

function descriviNonLetta(r) {
  return r.stato() === Stato.SFIORATA
    ? 'sfiorata, ' + Secondi(r.secondi).replaceAll(' s', '') + ' su ' + Secondi(r.soglia)
    : 'mai letta';
}

// Il riepilogo di un progetto per l'interfaccia web.
export function riepilogoProgetto(progetto, soloLetture) {
  const an = eseguiAnalisi(progetto.radice, soloLetture);
  const quotaSimulata = an.secondi <= 0 ? 0 : an.simulati / an.secondi;
  return {
    nome: path.basename(an.progetto.radice),
    radice: an.progetto.radice,
    soloLetture,
    soglia: an.progetto.regole.descriviSoglia(),
    critiche: an.progetto.regole.critiche,
    verifica: {
      passa: an.criticheNonLette === 0,
      critiche: an.critiche,
      criticheNonLette: an.criticheNonLette
    },
    totali: {
      file: an.file.length,
      ia: an.file.filter((f) => f.ia).length,
      significative: an.significative,
      lette: an.lette,
      mai: an.mai,
      sfiorate: an.sfiorate,
      frazione: an.frazione,
      percento: percento(an.frazione),
      secondi: an.secondi,
      attenzione: Secondi(an.secondi),
      simulati: an.simulati,
      quotaSimulata: percento(quotaSimulata)
    },
    file: an.file.map((f) => ({
      relativo: f.relativo,
      ia: f.ia,
      righe: f.numSignificative,
      lette: f.numLette,
      frazione: f.frazione,
      percento: percento(f.frazione),
      nonLette: FileAnalizzato.descrivi(f.intervalliNonLette()),
      criticheNonLette: f.criticheNonLette.length,
      attenzione: Secondi(f.secondiTotali),
      striscia: coloriStriscia(f)
    })),
    elencoCritiche: an.elencoCriticheNonLette().slice(0, 200).map(([f, r]) => ({
      file: f.relativo,
      numero: r.numero,
      stato: descriviNonLetta(r),
      sfiorata: r.stato() === Stato.SFIORATA,
      testo: normalizza(r.testo).slice(0, 160)
    }))
  };
}

// I dati di un file per il lettore.
export function datiFile(progetto, percorso) {
  const f = analizzaFile(progetto, percorso, false);
  return {
    relativo: f.relativo,
    estensione: f.estensione,
    ia: f.ia,
    rigaIA: f.rigaIA,
    inattivita: progetto.regole.inattivita,
    soglia: progetto.regole.descriviSoglia(),
    firma: firma(percorso),
    giorno: oggi(),
    righe: f.righe.map((r) => ({
      testo: r.testo,
      impronta: r.impronta,
      soglia: r.soglia,
      critica: r.critica,
      secondi: r.secondi,
      simulati: r.simulati,
      sessioni: r.sessioni,
      ultima: r.ultima
    }))
  };
}

// Dal percorso chiesto dalla pagina al percorso pieno. L'errore «non è dentro il
// progetto» della riga di comando contiene percorsi assoluti: alla pagina basta il nome chiesto.
function daRelativo(progetto, f) {
  try { return progetto.daRelativo(f); }
  catch (e) {
    if (e instanceof Errore && e.message.includes(' non è dentro il progetto ')) throw new Errore("Il file '" + f + "' non è dentro il progetto.");
    throw e;
  }
}

// Il messaggio d'errore per la pagina: in italiano, senza pile né percorsi assoluti del Mac
// (quelli dentro il progetto diventano relativi, come «.sguardo/regole.json»).
export function messaggioPerPagina(e, progetto) {
  if (!(e instanceof Errore)) {
    const codice = e && e.code;
    if (codice === 'EACCES' || codice === 'EPERM' || codice === 'EROFS') return 'Permesso negato: non riesco a leggere o scrivere i file del progetto.';
    if (codice === 'ENOSPC') return 'Il disco è pieno: non riesco a salvare.';
    return 'Errore interno del server.';
  }
  const radice = progetto.radice;
  return e.message.split(radice + path.sep).join('').split(radice).join('.');
}

// Applica un salvataggio del lettore: rilegge dal disco, somma, scrive.
// corpo: { f, sessione, simulata, righe: { impronta: secondi }, nuove: [impronta], fine }
export function applicaSalvataggio(progetto, corpo) {
  if (corpo === null || typeof corpo !== 'object') throw new Errore('Dati non validi.');
  const percorso = daRelativo(progetto, corpo.f);
  if (!esisteFile(percorso)) throw new Errore("Il file '" + corpo.f + "' non esiste.");
  const righe = corpo.righe && typeof corpo.righe === 'object' && !Array.isArray(corpo.righe) ? corpo.righe : {};
  const nuove = new Set(Array.isArray(corpo.nuove) ? corpo.nuove.filter((x) => typeof x === 'string') : []);
  const voci = [];
  let somma = 0;
  for (const [impronta, s] of Object.entries(righe)) {
    if (!FORMATO_IMPRONTA.test(impronta)) throw new Errore("Impronta non valida: '" + impronta + "'.");
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > MASSIMO_PER_RIGA) throw new Errore('Secondi non validi per ' + impronta + '.');
    if (s > 0) { voci.push([impronta, s]); somma += s; }
  }
  if (somma > MASSIMO_PER_INVIO) throw new Errore('Troppi secondi in un solo salvataggio.');
  const relativo = progetto.relativo(percorso);
  const percorsoDati = progetto.percorsoDati(percorso);
  const simulata = corpo.simulata === true;
  const toccate = [];
  if (voci.length > 0) {
    const reg = caricaRegistro(percorsoDati, relativo);
    const giorno = oggi();
    for (const [impronta, s] of voci) {
      const nuova = nuove.has(impronta);
      reg.aggiungi(impronta, s, simulata, nuova, giorno);
      if (nuova) toccate.push(impronta);
    }
    salvaRegistro(reg, percorsoDati);
    const aggiornate = {};
    for (const [impronta] of voci) {
      const v = reg.righe.get(impronta);
      aggiornate[impronta] = { secondi: v.secondi, simulati: v.simulati, sessioni: v.sessioni, ultima: v.ultima };
    }
    return { relativo, somma, toccate, aggiornate, percorsoDati };
  }
  return { relativo, somma: 0, toccate, aggiornate: {}, percorsoDati };
}

function invia(res, codice, tipo, corpo, intestazioni = {}) {
  res.writeHead(codice, {
    'Content-Type': tipo,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...intestazioni
  });
  res.end(corpo);
}

function json(res, codice, oggetto) {
  invia(res, codice, TIPI['.json'], JSON.stringify(oggetto));
}

class TroppoGrande extends Errore {}

// Un corpo troppo grande non si conserva: si scarta fino alla fine e si risponde 413
// (prima la connessione veniva chiusa di colpo e la pagina non riceveva nessuna risposta).
function leggiCorpo(req) {
  return new Promise((risolvi, rifiuta) => {
    const parti = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > MASSIMO_CORPO) { parti.length = 0; return; } // scarto il resto e rispondo alla fine
      parti.push(c);
    });
    req.on('end', () => (n > MASSIMO_CORPO ? rifiuta(new TroppoGrande('Richiesta troppo grande.')) : risolvi(Buffer.concat(parti).toString('utf8'))));
    req.on('error', rifiuta);
  });
}

// Accetta solo richieste rivolte a questo server locale (niente DNS rebinding).
function hostValido(req) {
  const porta = req.socket.localPort;
  const host = String(req.headers.host || '').toLowerCase();
  return host === '127.0.0.1:' + porta || host === 'localhost:' + porta || host === '[::1]:' + porta;
}

// Le richieste che scrivono devono arrivare dalle nostre pagine (o da un client senza Origin, come curl).
function origineValida(req) {
  const o = req.headers.origin;
  if (o === undefined) return true;
  const porta = req.socket.localPort;
  return o === 'http://127.0.0.1:' + porta || o === 'http://localhost:' + porta || o === 'http://[::1]:' + porta;
}

function servoFile(res, pieno, csp) {
  let dati;
  try { dati = fs.readFileSync(pieno); } catch { json(res, 404, { errore: 'Non trovato.' }); return; }
  const tipo = TIPI[path.extname(pieno).toLowerCase()] || 'application/octet-stream';
  invia(res, 200, tipo, dati, csp ? { 'Content-Security-Policy': csp } : {});
}

// opzioni: { progetto, modalita: 'progetto' | 'leggi', fileLettore, eventi: { carica(rel), salva(esito, corpo), salvaFallito(messaggio, corpo) } }
export function creaGestore(opzioni) {
  const { progetto, modalita = 'progetto', fileLettore = null, eventi = {} } = opzioni;
  return async function gestore(req, res) {
    try {
      if (!hostValido(req)) { json(res, 403, { errore: 'Host non ammesso.' }); return; }
      let url;
      try { url = new URL(req.url, 'http://127.0.0.1'); }
      catch { json(res, 400, { errore: 'Indirizzo non valido.' }); return; }
      const via = url.pathname;
      if (via.startsWith('/api/') || via === '/rapporto.html') progetto.aggiornaRegole();

      if (req.method === 'POST' && via === '/api/salva') {
        if (!origineValida(req)) { json(res, 403, { errore: 'Origine non ammessa.' }); return; }
        let corpo;
        try { corpo = JSON.parse(await leggiCorpo(req)); }
        catch (e) {
          if (e instanceof TroppoGrande) { res.shouldKeepAlive = false; invia(res, 413, TIPI['.json'], JSON.stringify({ errore: e.message }), { Connection: 'close' }); return; }
          json(res, 400, { errore: e instanceof Errore ? e.message : 'JSON non valido.' });
          return;
        }
        try {
          const esito = applicaSalvataggio(progetto, corpo);
          if (eventi.salva) eventi.salva(esito, corpo);
          json(res, 200, { ok: true, righe: esito.aggiornate });
        } catch (e) {
          if (eventi.salvaFallito) eventi.salvaFallito(e.message, corpo);
          json(res, e instanceof Errore ? 400 : 500, { errore: messaggioPerPagina(e, progetto) });
        }
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { errore: 'Metodo non ammesso.' }); return; }

      if (via === '/' || via === '/index.html') {
        if (modalita === 'leggi' && fileLettore) {
          res.writeHead(302, { Location: '/lettore.html?f=' + encodeURIComponent(fileLettore) });
          res.end();
          return;
        }
        servoFile(res, path.join(CARTELLA_WEB, 'index.html'), CSP_PAGINE);
        return;
      }
      if (via === '/api/info') {
        json(res, 200, { modalita, nome: path.basename(progetto.radice), radice: progetto.radice, fileLettore });
        return;
      }
      if (via === '/api/progetto') {
        json(res, 200, riepilogoProgetto(progetto, url.searchParams.get('solo') === '1'));
        return;
      }
      if (via === '/api/file' || via === '/api/file/stato') {
        let percorso;
        try {
          percorso = daRelativo(progetto, url.searchParams.get('f') || '');
          if (!esisteFile(percorso)) throw new Errore("Il file '" + url.searchParams.get('f') + "' non esiste.");
        } catch (e) { json(res, 404, { errore: messaggioPerPagina(e, progetto) }); return; }
        if (via === '/api/file/stato') { json(res, 200, { firma: firma(percorso) }); return; }
        const dati = datiFile(progetto, percorso);
        if (eventi.carica) eventi.carica(dati.relativo);
        json(res, 200, dati);
        return;
      }
      if (via === '/rapporto.html') {
        const an = eseguiAnalisi(progetto.radice, url.searchParams.get('solo') === '1');
        invia(res, 200, TIPI['.html'], rapportoHtml(an, new Date()).replace('</head>', A_CAPO_RAPPORTO + '</head>'), { 'Content-Security-Policy': CSP_RAPPORTO });
        return;
      }
      const lib = /^\/lib\/([a-z0-9-]+)\.mjs$/.exec(via);
      if (lib) {
        if (!CONDIVISI.has(lib[1])) { json(res, 404, { errore: 'Non trovato.' }); return; }
        servoFile(res, path.join(CARTELLA_LIB, lib[1] + '.mjs'));
        return;
      }
      const statico = /^\/([a-z0-9-]+\.(?:html|css|js|svg|png))$/.exec(via);
      if (statico) {
        servoFile(res, path.join(CARTELLA_WEB, statico[1]), statico[1].endsWith('.html') ? CSP_PAGINE : null);
        return;
      }
      json(res, 404, { errore: 'Non trovato.' });
    } catch (e) {
      if (res.headersSent) { res.destroy(); return; }
      json(res, e instanceof Errore ? 400 : 500, { errore: messaggioPerPagina(e, progetto) });
    }
  };
}

