// SGUARDO - regole (.sguardo/regole.json): righe critiche, soglia, estensioni, inattività.
// Modulo condiviso (Node e browser): qui solo la logica, la lettura del file è in node/progetto.mjs.
import { Errore, numero as numeroIt } from './cultura.mjs';
import * as Json from './json.mjs';

export const CRITICHE_PREDEFINITE =
  'password|token|segreto|secret|pagament|payment|crypt|auth|sql|admin|delete|drop|rimbors|iban';
export const IA_PREDEFINITA =
  "scritt[oa] dall['’] ?IA|generat[oa] (dall['’] ?|da ?(un['’] ?)?)IA|AI[- ]generated|generated (by|with) (an? )?(AI|Copilot|ChatGPT|Claude|LLM)|@generated";

export const ESTENSIONI_PREDEFINITE = [
  '.cs', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.java', '.kt', '.go', '.rs', '.rb', '.php',
  '.c', '.h', '.cpp', '.hpp', '.swift', '.sql', '.ps1', '.sh', '.vb', '.fs', '.scala', '.dart', '.lua'
];
export const ESCLUDI_PREDEFINITE = ['bin', 'obj', 'node_modules', 'vendor', 'dist', 'build', 'target'];

export class Regole {
  constructor() {
    this.critiche = CRITICHE_PREDEFINITE;
    this.marcatoriIA = IA_PREDEFINITA;
    this.sogliaMinima = 0.4;
    this.secondiPerCarattere = 0.05;
    this.inattivita = 20;
    this.estensioni = ESTENSIONI_PREDEFINITE.slice();
    this.escludi = ESCLUDI_PREDEFINITE.slice();
    this._rCritiche = undefined;
    this._rIA = undefined;
  }

  soglia(caratteri) {
    return Math.max(this.sogliaMinima, this.secondiPerCarattere * caratteri);
  }

  critica(riga) {
    if (this._rCritiche === undefined) this._rCritiche = compila(this.critiche, 'critiche');
    return this._rCritiche !== null && this._rCritiche.test(riga);
  }

  dichiaraIA(riga) {
    if (this._rIA === undefined) this._rIA = compila(this.marcatoriIA, 'marcatoriIA');
    return this._rIA !== null && this._rIA.test(riga);
  }

  descriviSoglia() {
    return 'max(' + numeroIt(this.sogliaMinima) + ' s; ' + numeroIt(this.secondiPerCarattere) + ' s × carattere)';
  }

  // Dal JSON già letto (oggetto), con gli stessi valori predefiniti dell'originale.
  static daOggetto(o) {
    const r = new Regole();
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return r;
    r.critiche = Json.testo(o, 'critiche', r.critiche);
    r.marcatoriIA = Json.testo(o, 'marcatoriIA', r.marcatoriIA);
    r.sogliaMinima = Json.numero(o, 'sogliaMinimaSecondi', r.sogliaMinima);
    r.secondiPerCarattere = Json.numero(o, 'secondiPerCarattere', r.secondiPerCarattere);
    r.inattivita = Json.numero(o, 'inattivitaSecondi', r.inattivita);
    r.estensioni = Json.elenco(o, 'estensioni', r.estensioni)
      .map((x) => (x.startsWith('.') ? x.toLowerCase() : '.' + x.toLowerCase()));
    r.escludi = Json.elenco(o, 'escludi', r.escludi);
    if (r.sogliaMinima <= 0) r.sogliaMinima = 0.4;
    return r;
  }

  // Il testo di regole.json, identico a quello scritto dalla versione Windows.
  testoJson() {
    const o = {};
    o._nota = "Regole di Sguardo. 'critiche' e 'marcatoriIA' sono espressioni regolari (maiuscole e minuscole indifferenti). " +
      "Una riga è letta quando l'attenzione accumulata raggiunge max(sogliaMinimaSecondi; secondiPerCarattere × caratteri non spazio).";
    o.critiche = this.critiche;
    o.marcatoriIA = this.marcatoriIA;
    o.sogliaMinimaSecondi = this.sogliaMinima;
    o.secondiPerCarattere = this.secondiPerCarattere;
    o.inattivitaSecondi = this.inattivita;
    o.estensioni = this.estensioni;
    o.escludi = this.escludi;
    return Json.scrivi(o, 1);
  }
}

function compila(schema, nome) {
  if (schema === null || schema === undefined || String(schema).trim() === '') return null;
  try {
    return new RegExp(schema, 'i');
  } catch (e) {
    throw new Errore("In regole.json, '" + nome + "' non è un'espressione regolare valida: " + e.message);
  }
}
