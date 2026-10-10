// SGUARDO - registro: un JSON per file, impronta -> attenzione accumulata.
// Niente nomi, niente orari: solo secondi, numero di sessioni, giorno.
// Formato "sguardo/1", identico a quello della versione Windows.
// Modulo condiviso (Node e browser).
import { arrotonda } from './cultura.mjs';
import * as Json from './json.mjs';

export const FORMATO = 'sguardo/1';

export function origine(secondi, simulati) {
  if (simulati <= 0.0005) return 'lettura';
  if (simulati >= secondi - 0.0005) return 'simulazione';
  return 'mista';
}

export class Voce {
  constructor() {
    this.secondi = 0;
    this.simulati = 0;
    this.sessioni = 0;
    this.ultima = null;
  }

  get origine() {
    return origine(this.secondi, this.simulati);
  }
}

export class Registro {
  constructor(relativo) {
    this.relativo = relativo;
    this.righe = new Map();
  }

  // Dal JSON già letto. Le voci senza "simulati" ereditano l'origine dichiarata.
  static daOggetto(radice, relativo) {
    const r = new Registro(relativo);
    if (radice === null || typeof radice !== 'object' || Array.isArray(radice)) return r;
    const righe = radice.righe;
    if (righe === null || typeof righe !== 'object' || Array.isArray(righe)) return r;
    for (const chiave of Object.keys(righe)) {
      const o = righe[chiave];
      if (o === null || typeof o !== 'object' || Array.isArray(o)) continue;
      const v = new Voce();
      v.secondi = Json.numero(o, 'secondi', 0);
      v.simulati = Json.numero(o, 'simulati', Json.testo(o, 'origine', '') === 'simulazione' ? v.secondi : 0);
      v.sessioni = Math.trunc(Json.numero(o, 'sessioni', 0));
      v.ultima = Json.testo(o, 'ultima', null);
      r.righe.set(chiave, v);
    }
    return r;
  }

  aggiungi(impronta, secondi, simulato, nuovaSessione, giorno) {
    if (impronta === null || impronta === undefined || !(secondi > 0)) return;
    let v = this.righe.get(impronta);
    if (!v) { v = new Voce(); this.righe.set(impronta, v); }
    v.secondi += secondi;
    if (simulato) v.simulati += secondi;
    if (nuovaSessione) v.sessioni++;
    v.ultima = giorno;
  }

  // Toglie le impronte che non compaiono in "tenere" (Set). Restituisce quante ne ha tolte.
  tieniSolo(tenere) {
    let tolte = 0;
    for (const k of [...this.righe.keys()]) {
      if (!tenere.has(k)) { this.righe.delete(k); tolte++; }
    }
    return tolte;
  }

  oggetto() {
    const righe = {};
    const chiavi = [...this.righe.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const k of chiavi) {
      const v = this.righe.get(k);
      righe[k] = {
        secondi: arrotonda(v.secondi, 3),
        simulati: arrotonda(v.simulati, 3),
        sessioni: v.sessioni,
        ultima: v.ultima,
        origine: v.origine
      };
    }
    return { formato: FORMATO, file: String(this.relativo).replace(/\\/g, '/'), righe };
  }

  testoJson() {
    return Json.scrivi(this.oggetto(), 2);
  }
}
