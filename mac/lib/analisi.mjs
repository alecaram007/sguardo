// SGUARDO - un file sorgente con lo stato di attenzione di ogni riga, e l'analisi
// di una cartella. Modulo condiviso (Node e browser): riceve testo, registro e regole
// già caricati; la lettura dal disco è in node/progetto.mjs.
import { calcola, caratteri } from './impronte.mjs';
import { origine as origineVoce } from './registro.mjs';
import { Errore } from './cultura.mjs';

export const Stato = Object.freeze({ VUOTA: 'vuota', MAI: 'mai', SFIORATA: 'sfiorata', LETTA: 'letta' });

export class RigaCodice {
  constructor(numero, testo) {
    this.numero = numero;
    this.testo = testo;
    this.impronta = null;
    this.caratteri = 0;
    this.soglia = 0;
    this.critica = false;
    this.secondi = 0;
    this.simulati = 0;
    this.sessioni = 0;
    this.ultima = null;
  }

  get vuota() {
    return this.impronta === null;
  }

  stato(extra = 0) {
    if (this.impronta === null) return Stato.VUOTA;
    const s = this.secondi + extra;
    if (s >= this.soglia - 1e-6) return Stato.LETTA;
    if (s > 1e-6) return Stato.SFIORATA;
    return Stato.MAI;
  }

  get origine() {
    if (this.secondi <= 0) return '—';
    return origineVoce(this.secondi, this.simulati);
  }
}

export class FileAnalizzato {
  // testi: le righe del file; registro: Registro; regole: Regole.
  constructor({ percorso = null, relativo, percorsoDati = null, estensione = '', testi, registro, regole, soloLetture = false, modificato = 0, dimensione = 0 }) {
    this.percorso = percorso;
    this.relativo = relativo;
    this.percorsoDati = percorsoDati;
    this.estensione = estensione;
    this.modificato = modificato;
    this.dimensione = dimensione;
    this.righe = [];
    this.ia = false;
    this.rigaIA = 0;
    const impronte = calcola(testi);
    for (let i = 0; i < testi.length; i++) {
      const r = new RigaCodice(i + 1, testi[i]);
      r.impronta = impronte[i];
      if (r.impronta !== null) {
        r.caratteri = caratteri(r.testo);
        r.soglia = regole.soglia(r.caratteri);
        r.critica = regole.critica(r.testo);
        const v = registro ? registro.righe.get(r.impronta) : undefined;
        if (v) {
          r.simulati = soloLetture ? 0 : v.simulati;
          r.secondi = soloLetture ? Math.max(0, v.secondi - v.simulati) : v.secondi;
          r.sessioni = v.sessioni;
          r.ultima = v.ultima;
        }
        if (!this.ia && i < 40 && regole.dichiaraIA(r.testo)) { this.ia = true; this.rigaIA = r.numero; }
      }
      this.righe.push(r);
    }
  }

  get significative() { return this.righe.filter((r) => !r.vuota); }
  get numSignificative() { return this.righe.reduce((n, r) => n + (r.vuota ? 0 : 1), 0); }
  get numLette() { return this.righe.reduce((n, r) => n + (r.stato() === Stato.LETTA ? 1 : 0), 0); }
  get numSfiorate() { return this.righe.reduce((n, r) => n + (r.stato() === Stato.SFIORATA ? 1 : 0), 0); }
  get numMai() { return this.righe.reduce((n, r) => n + (r.stato() === Stato.MAI ? 1 : 0), 0); }
  get numCritiche() { return this.righe.reduce((n, r) => n + (r.critica ? 1 : 0), 0); }
  get criticheNonLette() { return this.righe.filter((r) => r.critica && r.stato() !== Stato.LETTA); }
  get secondiTotali() { return this.righe.reduce((s, r) => s + r.secondi, 0); }
  get secondiSimulati() { return this.righe.reduce((s, r) => s + r.simulati, 0); }

  get frazione() {
    const n = this.numSignificative;
    return n === 0 ? 1 : this.numLette / n;
  }

  // Intervalli di righe non lette ("18-31, 35"); le righe vuote non spezzano un intervallo.
  intervalliNonLette() {
    const r = [];
    let corrente = null;
    for (const riga of this.righe) {
      if (riga.vuota) continue;
      if (riga.stato() !== Stato.LETTA) {
        if (corrente === null) { corrente = [riga.numero, riga.numero]; r.push(corrente); }
        else corrente[1] = riga.numero;
      } else corrente = null;
    }
    return r;
  }

  static descrivi(intervalli) {
    return intervalli.map((x) => (x[0] === x[1] ? String(x[0]) : x[0] + '-' + x[1])).join(', ');
  }
}

// L'analisi di una cartella: somma dei file analizzati.
export class Analisi {
  constructor({ progetto, cartella, soloLetture, file }) {
    this.progetto = progetto;
    this.cartella = cartella;
    this.soloLetture = soloLetture;
    this.file = file;
  }

  somma(f) { return this.file.reduce((s, x) => s + f(x), 0); }
  get significative() { return this.somma((f) => f.numSignificative); }
  get lette() { return this.somma((f) => f.numLette); }
  get mai() { return this.somma((f) => f.numMai); }
  get sfiorate() { return this.somma((f) => f.numSfiorate); }
  get critiche() { return this.somma((f) => f.numCritiche); }
  get criticheNonLette() { return this.somma((f) => f.criticheNonLette.length); }
  get secondi() { return this.somma((f) => f.secondiTotali); }
  get simulati() { return this.somma((f) => f.secondiSimulati); }
  get frazione() {
    const n = this.significative;
    return n === 0 ? 1 : this.lette / n;
  }

  // Coppie [file, riga] di tutte le righe critiche non lette.
  elencoCriticheNonLette() {
    const r = [];
    for (const f of this.file) for (const riga of f.criticheNonLette) r.push([f, riga]);
    return r;
  }
}

// Intervalli "18-31", "12", "1-10,15-20" (anche con ";").
export function intervalli(testo) {
  const r = [];
  for (const parte of String(testo ?? '').split(/[,;]/)) {
    if (parte.length === 0) continue;
    const ab = parte.trim().split('-');
    const intero = (s) => (/^\s*[+-]?\d+\s*$/.test(s) && Math.abs(Number(s)) <= 2147483647 ? Number(s) : null);
    let da, a;
    if (ab.length === 1 && intero(ab[0]) !== null) { da = intero(ab[0]); a = da; }
    else if (ab.length === 2 && intero(ab[0]) !== null && intero(ab[1]) !== null) { da = intero(ab[0]); a = intero(ab[1]); }
    else throw new Errore("Intervallo non valido: '" + parte + "'. Esempi: 12  oppure  18-31  oppure  1-10,15-20");
    if (da < 1 || a < da) throw new Errore("Intervallo non valido: '" + parte + "'.");
    r.push([da, a]);
  }
  if (r.length === 0) throw new Errore("Manca l'intervallo di righe (es. 18-31).");
  return r;
}
