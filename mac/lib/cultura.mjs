// SGUARDO - formati italiani e numeri (porta di Cultura in Nucleo.cs).
// Modulo condiviso: funziona sia in Node sia nel browser (nessun import di node:*).
//
// I numeri si formattano come .NET Framework: prima si riduce il valore a 15 cifre
// significative, poi si arrotonda «lontano dallo zero» sulle cifre decimali. Così
// "1,9 s", "0.343" e simili escono identici a quelli della versione Windows.

// Errore "previsto": viene mostrato all'utente senza stack trace.
export class Errore extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.name = 'Errore';
  }
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
  'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Cifre di v con "decimali" cifre dopo la virgola: { negativo, intera, frazione }.
function cifre(v, decimali) {
  const negativo = v < 0;
  const testo = Math.abs(v).toPrecision(15);
  let [mantissa, esp] = testo.split('e');
  const e = esp ? parseInt(esp, 10) : 0;
  const [int, fr = ''] = mantissa.split('.');
  let tutte = int + fr;
  let punto = int.length + e;
  if (punto <= 0) { tutte = '0'.repeat(1 - punto) + tutte; punto = 1; }
  else if (punto > tutte.length) tutte += '0'.repeat(punto - tutte.length);
  let intera = tutte.slice(0, punto);
  let frazione = tutte.slice(punto);
  if (frazione.length > decimali) {
    const su = frazione.charCodeAt(decimali) >= 53; // '5'
    frazione = frazione.slice(0, decimali);
    if (su) {
      const a = (intera + frazione).split('');
      let i = a.length - 1;
      for (; i >= 0; i--) {
        if (a[i] === '9') a[i] = '0';
        else { a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1); break; }
      }
      if (i < 0) a.unshift('1');
      const unite = a.join('');
      intera = unite.slice(0, unite.length - decimali);
      frazione = unite.slice(unite.length - decimali);
    }
  } else {
    frazione = frazione.padEnd(decimali, '0');
  }
  intera = intera.replace(/^0+(?=\d)/, '');
  return { negativo, intera, frazione };
}

function zero(c) {
  return /^0*$/.test(c.intera) && /^0*$/.test(c.frazione);
}

// Come ToString("0.0"), ToString("0.00")... : decimali fissi.
export function fisso(v, decimali, separatore = ',') {
  if (!Number.isFinite(v)) return String(v);
  const c = cifre(v, decimali);
  const segno = c.negativo && !zero(c) ? '-' : '';
  return segno + c.intera + (decimali > 0 ? separatore + c.frazione : '');
}

// Come ToString("0.###"): fino a "massimo" decimali, senza zeri finali.
export function compatto(v, massimo = 3, separatore = '.') {
  if (!Number.isFinite(v)) return String(v);
  const c = cifre(v, massimo);
  const fr = c.frazione.replace(/0+$/, '');
  const segno = c.negativo && !(/^0*$/.test(c.intera) && fr === '') ? '-' : '';
  return segno + c.intera + (fr ? separatore + fr : '');
}

// Math.Round di .NET: metà verso il pari.
export function arrotondaPari(v) {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// Math.Round(v, cifre) di .NET Framework.
export function arrotonda(v, cifreDecimali) {
  if (Math.abs(v) >= 1e16) return v;
  const p = Math.pow(10, cifreDecimali);
  return arrotondaPari(v * p) / p;
}

export function secondi(s) {
  if (s < 0.05) return '0 s';
  if (s < 10) return fisso(s, 1) + ' s';
  if (s < 60) return fisso(s, 0) + ' s';
  const tot = arrotondaPari(s);
  if (tot < 3600) return Math.trunc(tot / 60) + ' min ' + (tot % 60) + ' s';
  return Math.trunc(tot / 3600) + ' h ' + Math.trunc((tot % 3600) / 60) + ' min';
}

// Numero(v, "0.###") con la virgola italiana.
export function numero(v) {
  return compatto(v, 3, ',');
}

export function percento(frazione) {
  return Math.floor(frazione * 100 + 1e-9) + '%';
}

// Accetta sia "2,5" sia "2.5".
export function leggiNumero(testo) {
  const t = String(testo ?? '').trim().replace(/,/g, '.');
  const v = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) ? Number(t) : NaN;
  if (!Number.isFinite(v) || v < 0) throw new Errore("'" + testo + "' non è un numero di secondi valido.");
  return v;
}

function due(n) {
  return String(n).padStart(2, '0');
}

// "2026-10-01" -> "1 ott 2026"
export function data(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '—';
  const a = +m[1], me = +m[2], g = +m[3];
  const d = new Date(Date.UTC(a, me - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== me - 1 || d.getUTCDate() !== g) return '—';
  return g + ' ' + MESI_BREVI[me - 1] + ' ' + a;
}

// "1 ottobre 2026, 02:39"
export function dataOraLunga(d, separatore = ', ') {
  return d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear() + separatore + due(d.getHours()) + ':' + due(d.getMinutes());
}

export function isoGiorno(d) {
  return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
}

// Il giorno di oggi (solo il giorno, mai l'ora: è una scelta di privacy).
export function oggi() {
  const forzato = typeof process !== 'undefined' && process.env ? process.env.SGUARDO_OGGI : undefined;
  if (forzato && /^\d{4}-\d{2}-\d{2}$/.test(forzato)) return forzato;
  return isoGiorno(new Date());
}

export function plurale(n, singolare, pluraleTesto) {
  return n + ' ' + (n === 1 ? singolare : pluraleTesto);
}
