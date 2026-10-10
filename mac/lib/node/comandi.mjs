// SGUARDO - chi ha letto davvero questo codice?
// I comandi della riga di comando, con gli stessi testi della versione Windows.
// Solo Node.
import fs from 'node:fs';
import path from 'node:path';
import {
  Errore, secondi as Secondi, percento as Percento, plurale as Plurale, leggiNumero, oggi, compatto, arrotondaPari
} from '../cultura.mjs';
import { Stato, FileAnalizzato, intervalli as Intervalli } from '../analisi.mjs';
import { normalizza, espandiTab, calcola } from '../impronte.mjs';
import { rapportoHtml } from '../rapporto-html.mjs';
import {
  Progetto, progettoDelFile, analizzaFile, eseguiAnalisi, caricaRegistro, salvaRegistro, leggiRighe, esisteCartella,
  confrontaRelativi
} from './progetto.mjs';

// --- console ------------------------------------------------------------------
const ANSI = {
  White: '\x1b[1m', Gray: '', DarkGray: '\x1b[90m', Green: '\x1b[32m', Red: '\x1b[31m', DarkRed: '\x1b[2;31m',
  DarkYellow: '\x1b[33m', Magenta: '\x1b[35m', Cyan: '\x1b[36m', DarkCyan: '\x1b[36m', DarkGreen: '\x1b[32m'
};

export class Console {
  constructor(flusso = process.stdout, errori = process.stderr) {
    this.flusso = flusso;
    this.errori = errori;
    const forza = process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0';
    this.colori = !process.env.NO_COLOR && (forza || Boolean(flusso.isTTY));
  }
  W(testo, colore) {
    const c = colore && this.colori ? ANSI[colore] : '';
    this.flusso.write(c ? c + testo + '\x1b[0m' : testo);
  }
  WL(testo = '', colore) {
    this.W(testo, colore);
    this.flusso.write('\n');
  }
  errore(testo) {
    this.errori.write(testo + '\n');
  }
}

function taglia(s, max) {
  if (s.length <= max) return s;
  return s.substring(0, Math.max(1, max - 1)) + '…';
}

// --- argomenti ----------------------------------------------------------------
const CON_VALORE = new Set(['autotest', 'schermata', 'html', 'formato']);

export class Argomenti {
  constructor(args) {
    this.comando = '';
    this.posizionali = [];
    this.opzioni = new Map();
    let i = 0;
    if (args.length > 0) { this.comando = args[0].toLowerCase(); i = 1; }
    for (; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--') && a.length > 2) {
        const nome = a.substring(2).toLowerCase();
        if (CON_VALORE.has(nome)) {
          if (i + 1 >= args.length) throw new Errore("L'opzione --" + nome + ' vuole un valore.');
          this.opzioni.set(nome, args[++i]);
        } else this.opzioni.set(nome, '');
      } else this.posizionali.push(a);
    }
  }
  pos(i) { return i < this.posizionali.length ? this.posizionali[i] : null; }
  ha(nome) { return this.opzioni.has(nome); }
  opz(nome) { return this.opzioni.has(nome) ? this.opzioni.get(nome) : null; }
  soloQueste(...ammesse) {
    for (const k of this.opzioni.keys()) {
      if (!ammesse.includes(k)) throw new Errore("Opzione sconosciuta per '" + this.comando + "': --" + k);
    }
  }
}

// --- punto d'ingresso -----------------------------------------------------------
export async function esegui(args, con = new Console()) {
  try {
    const a = new Argomenti(args);
    switch (a.comando) {
      case 'init': return init(a, con);
      case 'leggi': return await leggi(a, con);
      case 'rapporto': return rapporto(a, con);
      case 'verifica': return verifica(a, con);
      case 'simula': return simula(a, con);
      case 'mostra': return mostra(a, con);
      case 'righe': return righe(a, con);
      case 'pulisci': return pulisci(a, con);
      case '': case 'aiuto': case 'help': case '-h': case '--help': case '/?':
        aiuto(con);
        return 0;
      default:
        throw new Errore("Comando sconosciuto: '" + a.comando + "'. Scrivi:  sguardo aiuto");
    }
  } catch (e) {
    if (e instanceof Errore) con.errore('  Errore: ' + e.message);
    else con.errore('  Errore inatteso (' + (e && e.constructor ? e.constructor.name : 'Error') + '): ' + (e && e.message));
    return 2;
  }
}

// --- init -----------------------------------------------------------------------
function init(a, con) {
  a.soloQueste();
  const { progetto: p, esisteva } = Progetto.inizializza(a.pos(0));
  con.WL();
  if (esisteva) {
    con.WL('  Sguardo è già attivo in ' + p.radice + '. Non ho toccato nulla.', 'White');
    return 0;
  }
  con.WL('  Sguardo è attivo in ' + p.radice, 'White');
  con.WL('  .sguardo/regole.json    righe critiche, soglia di lettura, estensioni (modificabile)', 'DarkGray');
  con.WL('  .sguardo/letture/       un JSON per file: impronta della riga → secondi di attenzione', 'DarkGray');
  con.WL('  Nessun nome viene salvato: solo tempi aggregati per riga.', 'DarkGray');
  con.WL('  Per leggere un file:  sguardo leggi <file>');
  return 0;
}

// --- leggi ----------------------------------------------------------------------
async function leggi(a, con) {
  a.soloQueste('autotest', 'schermata');
  if (a.pos(0) === null) throw new Errore('Quale file? Uso:  sguardo leggi <file> [--autotest <secondi> --schermata <png>]');
  const p = progettoDelFile(a.pos(0));
  let autotest = 0;
  if (a.opz('autotest') !== null) {
    autotest = leggiNumero(a.opz('autotest'));
    if (autotest <= 0 || autotest > 600) throw new Errore('--autotest vuole un numero di secondi tra 0 e 600.');
  }
  const schermata = a.opz('schermata');
  if (schermata !== null && autotest <= 0) throw new Errore('--schermata si usa insieme a --autotest.');
  const rel = p.relativo(a.pos(0));

  con.WL();
  if (autotest > 0) {
    con.WL('  Autotest del lettore: apro ' + rel + ' per ' + Secondi(autotest) + ', scorro da solo e mi chiudo.', 'White');
    con.WL("  L'attività è simulata (il mouse vero non viene toccato) e viene registrata come «simulazione».", 'DarkGray');
  } else {
    con.WL('  Apro ' + rel + ' nel lettore di Sguardo.', 'White');
    con.WL('  Registro solo mentre la scheda è attiva e la usi (mouse, rotella, tasti, tocco). Esc o «Fine» per chiudere.', 'DarkGray');
  }

  const { apriLettore } = await import('./lettore.mjs');
  const e = await apriLettore({
    progetto: p, percorso: a.pos(0), autotest, schermata,
    avvisa: (testo) => con.WL('  ' + testo, 'DarkGray')
  });

  con.WL();
  con.W('  Sessione: ', 'Gray');
  con.W(Secondi(e.attenzione) + ' di attenzione', 'White');
  con.WL(' su ' + Plurale(e.righeToccate, 'riga', 'righe') + ' · origine «' + (e.simulata ? 'simulazione' : 'lettura') + '»', 'Gray');
  con.W('  Righe lette: ' + Percento(e.frazionePrima) + ' → ', 'Gray');
  con.W(Percento(e.frazioneDopo), 'White');
  con.W(' · ', 'Gray');
  if (e.criticheNonLette > 0) con.WL(Plurale(e.criticheNonLette, 'riga critica non letta', 'righe critiche non lette'), 'Red');
  else con.WL('nessuna riga critica da leggere', 'Green');
  con.WL('  Dati: ' + e.percorsoDati, 'DarkGray');
  if (e.schermata !== null) con.WL('  Schermata della finestra: ' + e.schermata, 'Cyan');
  if (e.errore !== null) { con.errore('  Errore: ' + e.errore); return 2; }
  return 0;
}

// --- rapporto -------------------------------------------------------------------
function barra(con, frazione, celle) {
  let piene = arrotondaPari(frazione * celle);
  if (piene === celle && frazione < 1) piene = celle - 1;
  if (piene === 0 && frazione > 0) piene = 1;
  con.W('█'.repeat(piene), 'Green');
  con.W('░'.repeat(celle - piene), 'DarkGray');
}

function stessaCartella(x, y) {
  return x.replace(/[\\/]+$/, '').toLowerCase() === y.replace(/[\\/]+$/, '').toLowerCase();
}

function intestazione(con, an, titolo) {
  con.WL();
  con.WL('  ' + titolo, 'White');
  con.WL('  progetto  ' + an.progetto.radice, 'DarkGray');
  if (!stessaCartella(an.cartella, an.progetto.radice)) con.WL('  cartella  ' + an.cartella, 'DarkGray');
  con.WL('  soglia    una riga è letta con almeno ' + an.progetto.regole.descriviSoglia() + ' di attenzione', 'DarkGray');
  if (an.soloLetture) con.WL("  --solo-letture: l'attenzione simulata non conta", 'DarkYellow');
}

function descriviStato(r) {
  return r.stato() === Stato.SFIORATA
    ? 'sfiorata, ' + Secondi(r.secondi).replaceAll(' s', '') + ' su ' + Secondi(r.soglia)
    : 'mai letta';
}

function elencoCritiche(con, righeCritiche, massimo) {
  const larghezza = righeCritiche.length === 0 ? 0 : Math.max(...righeCritiche.map(([f, r]) => (f.relativo + ':' + r.numero).length));
  const lStato = righeCritiche.length === 0 ? 0 : Math.max(...righeCritiche.map(([, r]) => descriviStato(r).length));
  let n = 0;
  for (const [f, r] of righeCritiche) {
    if (++n > massimo) { con.WL('    … e altre ' + (righeCritiche.length - massimo) + '.', 'DarkGray'); break; }
    const dove = f.relativo + ':' + r.numero;
    con.W('    ' + dove.padEnd(larghezza + 2), 'White');
    const st = r.stato();
    con.W(descriviStato(r).padEnd(lStato) + '   ', st === Stato.SFIORATA ? 'DarkYellow' : 'Red');
    con.WL(taglia(normalizza(r.testo), 72), 'Gray');
  }
}

// Percorso da scrivere nel terminale: relativo alla cartella corrente se possibile.
function perIlTerminale(percorso) {
  const pieno = path.resolve(percorso);
  const qui = process.cwd().replace(/[\\/]+$/, '') + path.sep;
  return pieno.toLowerCase().startsWith(qui.toLowerCase()) ? pieno.substring(qui.length) : pieno;
}

function quotaSimulata(an) {
  return Percento(an.secondi <= 0 ? 0 : an.simulati / an.secondi);
}

function rapporto(a, con) {
  a.soloQueste('html', 'solo-letture');
  const an = eseguiAnalisi(a.pos(0), a.ha('solo-letture'));
  const html = path.resolve(a.opz('html') ?? path.join(an.progetto.radice, 'sguardo-rapporto.html'));
  intestazione(con, an, 'SGUARDO · chi ha letto davvero questo codice?');
  con.WL();
  if (an.file.length === 0) {
    con.WL('  Nessun file sorgente qui (estensioni in .sguardo/regole.json).', 'DarkGray');
  } else {
    const lNome = Math.min(40, Math.max(16, Math.max(...an.file.map((f) => f.relativo.length + (f.ia ? 4 : 0))) + 2));
    con.WL('  ' + 'FILE'.padEnd(lNome) + 'RIGHE   LETTE              NON LETTE             CRITICHE NON LETTE', 'DarkGray');
    for (const f of an.file) {
      const nome = taglia(f.relativo, lNome - (f.ia ? 6 : 2));
      con.W('  ' + nome, 'White');
      let usati = nome.length;
      if (f.ia) { con.W('  IA', 'Magenta'); usati += 4; }
      con.W(' '.repeat(Math.max(1, lNome - usati)), 'Gray');
      con.W(String(f.numSignificative).padStart(5) + '   ', 'Gray');
      barra(con, f.frazione, 10);
      con.W(Percento(f.frazione).padStart(5) + '    ', 'White');
      const nl = FileAnalizzato.descrivi(f.intervalliNonLette());
      con.W(taglia(nl.length === 0 ? '—' : nl, 20).padEnd(22), nl.length === 0 ? 'DarkGray' : 'DarkYellow');
      const c = f.criticheNonLette.length;
      con.WL(c === 0 ? '—' : String(c), c === 0 ? 'DarkGray' : 'Red');
    }
    con.WL();
    con.W('  Totale: ', 'Gray');
    con.W(an.lette + ' righe su ' + an.significative + ' lette da un umano (' + Percento(an.frazione) + ')', 'White');
    con.W(' · ' + an.mai + ' mai lette', 'Gray');
    if (an.sfiorate > 0) con.W(' · ' + Plurale(an.sfiorate, 'sfiorata', 'sfiorate'), 'Gray');
    con.WL();
    con.W('  Critiche: ', 'Gray');
    const crit = an.criticheNonLette;
    if (crit > 0) con.WL(Plurale(crit, 'riga critica non letta', 'righe critiche non lette') + ' su ' + an.critiche, 'Red');
    else con.WL(an.critiche === 0 ? 'nessuna riga critica' : 'tutte le ' + an.critiche + ' righe critiche sono state lette', 'Green');
    if (an.simulati > 0.001 && !an.soloLetture) {
      con.WL('  Nota: il ' + quotaSimulata(an) + " dell'attenzione registrata è simulata (sguardo simula / autotest).", 'DarkYellow');
    }
    if (crit > 0) {
      con.WL();
      con.WL('  Righe critiche non lette', 'White');
      elencoCritiche(con, an.elencoCriticheNonLette(), 30);
    }
  }
  fs.mkdirSync(path.dirname(html), { recursive: true });
  fs.writeFileSync(html, rapportoHtml(an, new Date()), 'utf8');
  con.WL();
  con.WL('  Rapporto HTML: ' + html, 'Cyan');
  return 0;
}

// --- verifica -------------------------------------------------------------------
// Annotazioni di GitHub Actions: https://docs.github.com/actions (workflow commands).
function escapeDati(s) {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function escapeProprieta(s) {
  return escapeDati(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function verifica(a, con) {
  a.soloQueste('solo-letture', 'formato');
  const formato = (a.opz('formato') ?? 'testo').toLowerCase();
  if (formato !== 'testo' && formato !== 'github') throw new Errore("--formato vuole 'testo' oppure 'github'.");
  const an = eseguiAnalisi(a.pos(0), a.ha('solo-letture'));
  con.WL();
  con.WL('  SGUARDO · verifica', 'White');
  con.WL('  progetto  ' + an.progetto.radice, 'DarkGray');
  con.WL('  regole    .sguardo/regole.json · soglia ' + an.progetto.regole.descriviSoglia(), 'DarkGray');
  con.WL('  controllo ' + Plurale(an.critiche, 'riga critica', 'righe critiche') + ' in ' + Plurale(an.file.length, 'file', 'file') +
    (an.soloLetture ? " · --solo-letture: l'attenzione simulata non conta" : ''), 'DarkGray');
  con.WL();
  const nonLette = an.elencoCriticheNonLette();
  const simulata = an.simulati > 0.001 && !an.soloLetture;
  if (nonLette.length === 0) {
    if (an.critiche === 0) con.WL('  PASSA   nessuna riga critica da controllare.', 'Green');
    else con.WL('  PASSA   ' + (an.critiche === 1 ? "l'unica riga critica è stata letta" : 'tutte le ' + an.critiche + ' righe critiche sono state lette') + ' da un umano.', 'Green');
    if (simulata) con.WL('          attenzione: il ' + quotaSimulata(an) + " dell'attenzione è simulata. In una CI vera usa --solo-letture.", 'DarkYellow');
    if (formato === 'github' && simulata) {
      con.WL('::warning title=Sguardo::' + escapeDati('il ' + quotaSimulata(an) + " dell'attenzione è simulata. In una CI vera usa --solo-letture."));
    }
    return 0;
  }
  con.WL('  NON PASSA   ' + (nonLette.length === 1 ? '1 riga critica non è stata letta' : nonLette.length + ' righe critiche non sono state lette') + ' da un umano:', 'Red');
  elencoCritiche(con, nonLette, 50);
  con.WL();
  let primo = perIlTerminale(nonLette[0][0].percorso);
  if (primo.indexOf(' ') >= 0) primo = '"' + primo + '"';
  con.WL('  Qualcuno deve leggerle prima del merge:  sguardo leggi ' + primo, 'DarkGray');
  if (formato === 'github') {
    for (const [f, r] of nonLette) {
      const file = perIlTerminale(f.percorso).split(path.sep).join('/');
      con.WL('::error file=' + escapeProprieta(file) + ',line=' + r.numero + ',title=' + escapeProprieta('Sguardo: riga critica non letta') +
        '::' + escapeDati('Riga critica ' + descriviStato(r) + ': nessun umano l\'ha letta abbastanza. ' + taglia(normalizza(r.testo), 120)));
    }
  }
  return 1;
}

// --- simula ---------------------------------------------------------------------
function simula(a, con) {
  a.soloQueste();
  if (a.posizionali.length < 3) throw new Errore('Uso:  sguardo simula <file> <da>-<a> <secondi>   (es. sguardo simula app.js 18-31 40)');
  const p = progettoDelFile(a.pos(0));
  // L'ultimo argomento sono i secondi; in mezzo uno o più intervalli.
  const testoIntervalli = a.posizionali.slice(1, a.posizionali.length - 1).join(',');
  const iv = Intervalli(testoIntervalli);
  const sec = leggiNumero(a.posizionali[a.posizionali.length - 1]);
  if (sec <= 0) throw new Errore('Servono più di 0 secondi.');
  const f = analizzaFile(p, a.pos(0), false);
  const scelte = f.righe.filter((r) => !r.vuota && iv.some((x) => r.numero >= x[0] && r.numero <= x[1]));
  if (scelte.length === 0) throw new Errore('Nessuna riga non vuota in ' + a.pos(1) + ' (il file ha ' + f.righe.length + ' righe).');
  // Come un lettore che legge tutto il blocco con la stessa cura: ogni riga
  // riceve una quota proporzionale alla propria soglia (cioè alla lunghezza).
  const somma = scelte.reduce((s, r) => s + r.soglia, 0);
  const reg = caricaRegistro(f.percorsoDati, f.relativo);
  const giorno = oggi();
  for (const r of scelte) reg.aggiungi(r.impronta, (sec * r.soglia) / somma, true, true, giorno);
  salvaRegistro(reg, f.percorsoDati);

  const dopo = analizzaFile(p, a.pos(0), false);
  const numeri = new Set(scelte.map((r) => r.numero));
  const lette = dopo.righe.filter((r) => numeri.has(r.numero) && r.stato() === Stato.LETTA).length;
  con.W('  simula  ', 'DarkYellow');
  con.W(f.relativo + ' righe ' + a.pos(1), 'White');
  con.WL(': ' + Secondi(sec) + ' su ' + Plurale(scelte.length, 'riga', 'righe') +
    ' (per leggerle tutte ne servono ' + Secondi(somma) + ')', 'Gray');
  con.WL('          lette ' + lette + ' su ' + scelte.length + ' · file: ' + Percento(dopo.frazione) + ' letto · registrato come «simulazione»', 'DarkGray');
  return 0;
}

// --- mostra ---------------------------------------------------------------------
function mostra(a, con) {
  a.soloQueste('solo-letture');
  const p = progettoDelFile(a.pos(0));
  const f = analizzaFile(p, a.pos(0), a.ha('solo-letture'));
  // Come nella versione Windows, più argomenti ("1-5" "21-32") si riuniscono.
  const iv = a.pos(1) === null ? [[1, Number.MAX_SAFE_INTEGER]] : Intervalli(a.posizionali.slice(1).join(','));
  con.WL();
  con.W('  ' + f.relativo, 'White');
  if (f.ia) con.W(" · scritto dall'IA", 'Magenta');
  con.W(' · ' + Percento(f.frazione) + ' lette · ', 'Gray');
  const c = f.criticheNonLette.length;
  if (c > 0) con.WL(Plurale(c, 'riga critica non letta', 'righe critiche non lette'), 'Red');
  else con.WL('nessuna riga critica da leggere', 'Green');
  con.WL();
  const cifre = Math.max(3, String(f.righe.length).length);
  for (const r of f.righe) {
    if (!iv.some((x) => r.numero >= x[0] && r.numero <= x[1])) continue;
    const st = r.stato();
    con.W('  ' + String(r.numero).padStart(cifre) + '  ', 'DarkGray');
    switch (st) {
      case Stato.LETTA: con.W('██', 'Green'); break;
      case Stato.SFIORATA: con.W('▒▒', 'DarkYellow'); break;
      case Stato.MAI: con.W('░░', 'DarkGray'); break;
      default: con.W('  ', 'DarkGray'); break;
    }
    const criticaDaLeggere = r.critica && st !== Stato.LETTA;
    con.W(criticaDaLeggere ? ' ! ' : '   ', 'Red');
    const testo = taglia(espandiTab(r.testo), 96);
    con.WL(testo, st === Stato.LETTA ? 'Gray' : criticaDaLeggere ? 'DarkRed' : 'DarkGray');
  }
  con.WL();
  con.W('  ', 'Gray'); con.W('██', 'Green'); con.W(' letta   ', 'DarkGray');
  con.W('▒▒', 'DarkYellow'); con.W(' sfiorata   ', 'DarkGray');
  con.W('░░', 'DarkGray'); con.W(' mai letta   ', 'DarkGray');
  con.W('!', 'Red'); con.WL(' critica non letta', 'DarkGray');
  return 0;
}

// --- righe (dati grezzi per script e test) ---------------------------------------
function righe(a, con) {
  a.soloQueste('solo-letture');
  const p = progettoDelFile(a.pos(0));
  const f = analizzaFile(p, a.pos(0), a.ha('solo-letture'));
  con.WL('# numero\tstato\tsecondi\tsoglia\tcritica\torigine\tsessioni\timpronta\ttesto');
  for (const r of f.righe) {
    const st = r.stato();
    const stato = st === Stato.LETTA ? 'letta' : st === Stato.SFIORATA ? 'sfiorata' : st === Stato.MAI ? 'mai' : 'vuota';
    con.WL([
      String(r.numero), stato,
      compatto(r.secondi, 3, '.'), compatto(r.soglia, 3, '.'),
      r.critica ? '1' : '0', r.vuota ? '' : (r.secondi > 0 ? r.origine : 'nessuna'),
      String(r.sessioni), r.impronta ?? '', r.testo.replaceAll('\t', ' ')
    ].join('\t'));
  }
  return 0;
}

// --- pulisci (novità: toglie dai JSON le impronte delle versioni vecchie) ----------
function jsonDati(cartella) {
  const r = [];
  if (!esisteCartella(cartella)) return r;
  for (const v of fs.readdirSync(cartella, { withFileTypes: true })) {
    const pieno = path.join(cartella, v.name);
    if (v.isDirectory()) r.push(...jsonDati(pieno));
    else if (v.isFile() && v.name.endsWith('.json')) r.push(pieno);
  }
  return r;
}

function pulisci(a, con) {
  a.soloQueste('prova');
  const prova = a.ha('prova');
  const cartella = path.resolve(a.pos(0) ?? '.');
  if (!esisteCartella(cartella)) throw new Errore("La cartella '" + cartella + "' non esiste.");
  const p = Progetto.trova(cartella);
  const relCartella = stessaCartella(cartella, p.radice) ? '' : p.relativo(cartella) + '/';
  const voci = [];
  const modifiche = [];
  for (const dati of jsonDati(p.cartellaLetture)) {
    const rel = path.relative(p.cartellaLetture, dati).split(path.sep).join('/').replace(/\.json$/, '');
    if (relCartella && !rel.toLowerCase().startsWith(relCartella.toLowerCase())) continue;
    const sorgente = path.join(p.radice, ...rel.split('/'));
    const reg = caricaRegistro(dati, rel);
    const prima = reg.righe.size;
    // Sparito solo se il file non c'è davvero: un file che non riesco a vedere
    // (permessi) non deve perdere i suoi dati.
    let sparito = false;
    try { sparito = !fs.statSync(sorgente).isFile(); } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw new Errore("Non riesco a controllare '" + sorgente + "': " + e.message + '. Non ho toccato nulla.');
      sparito = true;
    }
    if (sparito) {
      voci.push({ rel, tolte: prima, restano: 0, sparito: true });
      modifiche.push(() => fs.rmSync(dati));
      continue;
    }
    let testi;
    try { testi = leggiRighe(sorgente); } catch (e) {
      if (e instanceof Errore) throw e;
      throw new Errore("Non riesco a leggere '" + sorgente + "': " + e.message + '. Non ho toccato nulla.');
    }
    const attuali = new Set(calcola(testi).filter((x) => x !== null));
    const tolte = reg.tieniSolo(attuali);
    voci.push({ rel, tolte, restano: reg.righe.size, sparito: false });
    // Al momento di scrivere rileggo il JSON: se intanto il lettore ha salvato, non perdo nulla.
    if (tolte > 0) modifiche.push(() => { const ora = caricaRegistro(dati, rel); ora.tieniSolo(attuali); salvaRegistro(ora, dati); });
  }
  // Si scrive solo dopo aver controllato tutto: un errore a metà non lascia una pulizia parziale.
  if (!prova) for (const m of modifiche) m();
  voci.sort((x, y) => confrontaRelativi(x.rel, y.rel));

  con.WL();
  con.WL('  SGUARDO · pulizia dei dati', 'White');
  con.WL('  progetto  ' + p.radice, 'DarkGray');
  if (relCartella) con.WL('  cartella  ' + cartella, 'DarkGray');
  if (prova) con.WL('  --prova: mostro cosa toglierei, senza toccare nulla', 'DarkYellow');
  con.WL();
  if (voci.length === 0) {
    con.WL('  Nessun dato di lettura qui: niente da pulire.', 'DarkGray');
    return 0;
  }
  const larghezza = Math.min(40, Math.max(16, ...voci.map((v) => v.rel.length + 2)));
  let totale = 0, file = 0;
  for (const v of voci) {
    con.W('  ' + taglia(v.rel, larghezza - 2).padEnd(larghezza), 'White');
    if (v.sparito) con.WL('il file sorgente non c\'è più: ' + (prova ? 'toglierei' : 'tolti') + ' i suoi dati (' + Plurale(v.tolte, 'impronta', 'impronte') + ')', 'DarkYellow');
    else if (v.tolte === 0) con.WL('niente da togliere · ' + Plurale(v.restano, 'impronta', 'impronte'), 'DarkGray');
    else con.WL(Plurale(v.tolte, 'impronta vecchia', 'impronte vecchie') + ' ' + (prova ? 'da togliere' : (v.tolte === 1 ? 'tolta' : 'tolte')) + ' · ' + v.restano + ' restano', 'Gray');
    if (v.tolte > 0) { totale += v.tolte; file++; }
  }
  con.WL();
  if (totale === 0) con.WL('  Tutto pulito: ogni impronta salvata corrisponde a una riga attuale.', 'Green');
  else if (prova) con.WL('  Senza --prova toglierei ' + Plurale(totale, 'impronta', 'impronte') + ' da ' + Plurale(file, 'file', 'file') + '.', 'White');
  else con.WL('  ' + (totale === 1 ? 'Tolta ' : 'Tolte ') + Plurale(totale, 'impronta', 'impronte') + ' da ' + Plurale(file, 'file', 'file') + '.', 'White');
  if (totale > 0) con.WL('  Le righe che tornassero com\'erano non ritroveranno più la loro attenzione passata.', 'DarkGray');
  return 0;
}

// --- aiuto ------------------------------------------------------------------------
function aiuto(con) {
  con.WL();
  con.WL('  SGUARDO · chi ha letto davvero questo codice?', 'White');
  con.WL('  Registra quali righe sono state lette da un essere umano, e per quanto.', 'DarkGray');
  con.WL();
  con.WL('  sguardo init [cartella]                  attiva Sguardo in un progetto (crea .sguardo/)');
  con.WL("  sguardo leggi <file>                     apre il lettore e registra l'attenzione");
  con.WL('  sguardo rapporto [cartella]              righe lette, righe mai lette, rapporto HTML');
  con.WL('  sguardo verifica [cartella]              per la CI: esce con 1 se una riga critica non è stata letta');
  con.WL('  sguardo mostra <file> [da-a]             il file in console con lo stato di ogni riga');
  con.WL('  sguardo simula <file> <da-a> <secondi>   registra attenzione simulata (demo e test)');
  con.WL('  sguardo righe <file>                     dati grezzi riga per riga (TSV, per script)');
  con.WL('  sguardo pulisci [cartella]               toglie dai JSON le impronte delle versioni vecchie');
  con.WL();
  con.WL('  Opzioni', 'White');
  con.WL("    --solo-letture       ignora l'attenzione simulata (rapporto, verifica, mostra, righe)");
  con.WL('    --html <file>        dove scrivere il rapporto HTML (predefinito: sguardo-rapporto.html nella radice)');
  con.WL('    --autotest <s>       (leggi) la pagina scorre da sola per <s> secondi, poi si chiude');
  con.WL("    --schermata <png>    (leggi --autotest) salva un'immagine della pagina (serve Google Chrome)");
  con.WL('    --formato github     (verifica) aggiunge le annotazioni per GitHub Actions');
  con.WL('    --prova              (pulisci) mostra cosa toglierebbe, senza toccare nulla');
  con.WL();
  con.WL('  Codici di uscita: 0 tutto bene · 1 verifica non passata · 2 errore', 'DarkGray');
}
