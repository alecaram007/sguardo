// SGUARDO - progetto (la cartella che contiene .sguardo/), lettura e scrittura su disco.
// Solo Node: usa node:fs e node:path.
import fs from 'node:fs';
import path from 'node:path';
import { Errore } from '../cultura.mjs';
import { Regole } from '../regole.mjs';
import { Registro } from '../registro.mjs';
import { FileAnalizzato, Analisi } from '../analisi.mjs';
import { dividiRighe } from '../impronte.mjs';
import * as Json from '../json.mjs';

export const NOME_META = '.sguardo';

function esisteCartella(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function esisteFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Come Path.GetExtension: dal punto finale del nome, minuscole a parte.
export function estensione(p) {
  const nome = path.basename(p);
  const i = nome.lastIndexOf('.');
  if (i < 0 || i === nome.length - 1) return '';
  return nome.slice(i);
}

// Confronto OrdinalIgnoreCase: maiuscola semplice carattere per carattere (ß resta ß).
function maiuscoleOrdinali(s) {
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const m = s[i].toUpperCase();
    r += m.length === 1 ? m : s[i];
  }
  return r;
}
function confrontaSenzaMaiuscole(a, b) {
  const x = maiuscoleOrdinali(a), y = maiuscoleOrdinali(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
// La versione Windows ordina i percorsi relativi scritti con "\" (0x5C), che viene
// dopo cifre e lettere maiuscole: "utils.js" prima di "util\x.js". Qui si scrivono
// con "/", quindi per l'ordine si rimette "\".
export function confrontaRelativi(a, b) {
  return confrontaSenzaMaiuscole(a.replaceAll('/', '\\'), b.replaceAll('/', '\\'));
}

export function scriviFileAtomico(percorso, testo) {
  fs.mkdirSync(path.dirname(percorso), { recursive: true });
  const tmp = percorso + '.tmp';
  fs.writeFileSync(tmp, testo, 'utf8');
  fs.renameSync(tmp, percorso);
}

// Legge un file di testo come File.ReadAllText: UTF-8 (con o senza BOM), o UTF-16 con BOM.
export function leggiTesto(percorso) {
  const b = fs.readFileSync(percorso);
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  let t = b.toString('utf8');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t;
}

export function leggiRighe(percorso) {
  if (!esisteFile(percorso)) throw new Errore("Il file '" + percorso + "' non esiste.");
  return dividiRighe(leggiTesto(percorso));
}

export function caricaRegole(percorso) {
  if (!esisteFile(percorso)) return new Regole();
  let o;
  try { o = Json.leggi(leggiTesto(percorso)); }
  catch (e) { throw new Errore('Non riesco a leggere ' + percorso + ': ' + e.message); }
  return Regole.daOggetto(o);
}

export function caricaRegistro(percorso, relativo) {
  if (!esisteFile(percorso)) return new Registro(relativo);
  let radice;
  try { radice = Json.leggi(leggiTesto(percorso)); }
  catch (e) { throw new Errore("Dati illeggibili in '" + percorso + "': " + e.message); }
  return Registro.daOggetto(radice, relativo);
}

export function salvaRegistro(registro, percorso) {
  scriviFileAtomico(percorso, registro.testoJson());
}

export class Progetto {
  constructor(radice) {
    let r = path.resolve(radice);
    if (r.length > 1) r = r.replace(/[\\/]+$/, '');
    this.radice = r;
    this.meta = path.join(r, NOME_META);
    this.regole = null;
  }

  get percorsoRegole() { return path.join(this.meta, 'regole.json'); }

  // Rilegge .sguardo/regole.json (il server resta acceso mentre qualcuno le modifica).
  aggiornaRegole() {
    this.regole = caricaRegole(this.percorsoRegole);
    return this;
  }
  get cartellaLetture() { return path.join(this.meta, 'letture'); }

  static trova(da) {
    let inizio = path.resolve(da === null || da === undefined || da === '' ? '.' : da);
    if (esisteFile(inizio)) inizio = path.dirname(inizio);
    if (!esisteCartella(inizio)) throw new Errore("La cartella '" + inizio + "' non esiste.");
    let d = inizio;
    for (;;) {
      if (esisteCartella(path.join(d, NOME_META))) {
        const p = new Progetto(d);
        p.regole = caricaRegole(p.percorsoRegole);
        return p;
      }
      const su = path.dirname(d);
      if (su === d) break;
      d = su;
    }
    throw new Errore("Nessun progetto Sguardo trovato risalendo da '" + inizio + "'. Crealo con:  sguardo init <cartella>");
  }

  // Restituisce { progetto, esisteva }.
  static inizializza(cartella) {
    const c = path.resolve(cartella === null || cartella === undefined || cartella === '' ? '.' : cartella);
    if (!esisteCartella(c)) throw new Errore("La cartella '" + c + "' non esiste.");
    const p = new Progetto(c);
    const esisteva = esisteCartella(p.meta);
    fs.mkdirSync(p.cartellaLetture, { recursive: true });
    if (esisteFile(p.percorsoRegole)) p.regole = caricaRegole(p.percorsoRegole);
    else { p.regole = new Regole(); scriviFileAtomico(p.percorsoRegole, p.regole.testoJson()); }
    return { progetto: p, esisteva };
  }

  // Percorso relativo alla radice, con "/".
  relativo(percorso) {
    const pieno = path.resolve(percorso);
    const base = this.radice.endsWith(path.sep) ? this.radice : this.radice + path.sep;
    if (!pieno.toLowerCase().startsWith(base.toLowerCase())) {
      throw new Errore("Il file '" + pieno + "' non è dentro il progetto '" + this.radice + "'.");
    }
    return pieno.substring(base.length).split(path.sep).join('/');
  }

  percorsoDati(percorso) {
    return path.join(this.cartellaLetture, ...(this.relativo(percorso) + '.json').split('/'));
  }

  // Dal percorso relativo ("sotto/dentro.js") al percorso pieno, senza uscire dal progetto.
  daRelativo(rel) {
    if (typeof rel !== 'string' || rel === '' || rel.includes('\0')) throw new Errore('Percorso non valido.');
    const pieno = path.resolve(this.radice, ...rel.split('/'));
    this.relativo(pieno); // controlla che sia dentro
    const parti = this.relativo(pieno).split('/');
    if (parti[0] === NOME_META) throw new Errore('Percorso non valido.');
    return pieno;
  }

  fileSorgente(cartella) {
    const risultato = [];
    const visitate = new Set();
    this._raccogli(path.resolve(cartella), risultato, visitate);
    return risultato
      .map((f) => [f, this.relativo(f)])
      .sort((a, b) => confrontaRelativi(a[1], b[1]))
      .map((x) => x[0]);
  }

  _raccogli(cartella, risultato, visitate) {
    let vera;
    try { vera = fs.realpathSync(cartella); } catch { return; }
    if (visitate.has(vera)) return;
    visitate.add(vera);
    let voci;
    try { voci = fs.readdirSync(cartella, { withFileTypes: true }); } catch { return; }
    const file = [], cartelle = [];
    for (const v of voci) {
      const pieno = path.join(cartella, v.name);
      let st = v;
      if (v.isSymbolicLink()) { try { st = fs.statSync(pieno); } catch { continue; } }
      if (st.isFile()) file.push(pieno);
      else if (st.isDirectory()) cartelle.push([pieno, v.name]);
    }
    for (const f of file) {
      if (this.regole.estensioni.includes(estensione(f).toLowerCase())) risultato.push(f);
    }
    for (const [d, nome] of cartelle) {
      if (nome.startsWith('.')) continue;
      if (this.regole.escludi.some((x) => x.toLowerCase() === nome.toLowerCase())) continue;
      this._raccogli(d, risultato, visitate);
    }
  }
}

export function analizzaFile(p, percorso, soloLetture) {
  const pieno = path.resolve(percorso);
  const relativo = p.relativo(pieno);
  const percorsoDati = p.percorsoDati(pieno);
  const testi = leggiRighe(pieno);
  const st = fs.statSync(pieno);
  const registro = caricaRegistro(percorsoDati, relativo);
  return new FileAnalizzato({
    percorso: pieno, relativo, percorsoDati, estensione: estensione(pieno).toLowerCase(),
    testi, registro, regole: p.regole, soloLetture, modificato: st.mtimeMs, dimensione: st.size
  });
}

export function eseguiAnalisi(cartella, soloLetture) {
  const c = path.resolve(cartella === null || cartella === undefined || cartella === '' ? '.' : cartella);
  if (!esisteCartella(c)) throw new Errore("La cartella '" + c + "' non esiste.");
  const progetto = Progetto.trova(c);
  const file = progetto.fileSorgente(c).map((f) => analizzaFile(progetto, f, soloLetture));
  return new Analisi({ progetto, cartella: c, soloLetture, file });
}

// Il file sorgente esiste? Restituisce il progetto che lo contiene (come ProgettoDelFile).
export function progettoDelFile(file) {
  if (file === null || file === undefined) throw new Errore('Manca il file.');
  const pieno = path.resolve(file);
  if (!esisteFile(pieno)) throw new Errore("Il file '" + pieno + "' non esiste.");
  return Progetto.trova(path.dirname(pieno));
}

export { esisteFile, esisteCartella };
