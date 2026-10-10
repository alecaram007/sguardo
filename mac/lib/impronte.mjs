// SGUARDO - impronte: hash della riga normalizzata + indice di occorrenza.
// impronta = SHA-256(riga normalizzata)[primi 6 byte] in esadecimale + "#" + occorrenza
// Modulo condiviso (Node e browser).
import { sha256Esadecimale } from './sha256.mjs';

// Gli stessi spazi di char.IsWhiteSpace e di \s in .NET (Unicode Z, tab, a capo, \x85).
const CLASSE = '\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const SPAZI = new RegExp('[' + CLASSE + ']+', 'g');
const BORDI = new RegExp('^[' + CLASSE + ']+|[' + CLASSE + ']+$', 'g');
const SPAZIO = new RegExp('^[' + CLASSE + ']$');

// Senza spazi iniziali e finali, con gli spazi interni compressi.
export function normalizza(riga) {
  return riga.replace(BORDI, '').replace(SPAZI, ' ');
}

// Caratteri non spazio (unità UTF-16, come i char di C#).
export function caratteri(riga) {
  let n = 0;
  for (let i = 0; i < riga.length; i++) if (!SPAZIO.test(riga[i])) n++;
  return n;
}

export function improntaBase(rigaNormalizzata) {
  return sha256Esadecimale(rigaNormalizzata, 6);
}

// null per le righe vuote. Due righe identiche (es. due "}") ricevono #0, #1, ...
export function calcola(righe) {
  const r = new Array(righe.length).fill(null);
  const visti = new Map();
  for (let i = 0; i < righe.length; i++) {
    const n = normalizza(righe[i]);
    if (n.length === 0) continue;
    const hash = improntaBase(n);
    const occ = visti.get(hash) || 0;
    visti.set(hash, occ + 1);
    r[i] = hash + '#' + occ;
  }
  return r;
}

// Divide il testo come File.ReadAllText + Split("\r\n", "\n", "\r"): l'ultima riga vuota si toglie.
export function dividiRighe(testo) {
  if (testo.charCodeAt(0) === 0xfeff) testo = testo.slice(1);
  const righe = testo.split(/\r\n|\n|\r/);
  if (righe.length > 0 && righe[righe.length - 1].length === 0) righe.pop();
  return righe;
}

export function espandiTab(riga) {
  if (riga.indexOf('\t') < 0) return riga;
  let s = '';
  for (const c of riga) {
    if (c === '\t') { do s += ' '; while (s.length % 4 !== 0); }
    else s += c;
  }
  return s;
}

export const FORMATO_IMPRONTA = /^[0-9a-f]{12}#\d{1,7}$/;
