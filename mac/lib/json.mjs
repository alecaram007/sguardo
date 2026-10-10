// SGUARDO - JSON: lettura con JSON.parse, scrittura leggibile fatta a mano,
// carattere per carattere come Json.Scrivi della versione Windows.
// Modulo condiviso (Node e browser).
import { compatto } from './cultura.mjs';

export function leggi(testo) {
  if (testo.charCodeAt(0) === 0xfeff) testo = testo.slice(1);
  // Come JavaScriptSerializer.DeserializeObject: un testo vuoto (o di soli spazi) vale null,
  // quindi un regole.json o un file di dati vuoto dà i valori predefiniti, non un errore.
  if (/^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/.test(testo)) return null;
  return JSON.parse(testo);
}

// Gli oggetti più profondi di "espansi" livelli vanno su una riga sola.
export function scrivi(valore, espansi) {
  const parti = [];
  scriviValore(parti, valore, 0, espansi);
  parti.push('\n');
  return parti.join('');
}

function scriviValore(sb, v, livello, espansi) {
  if (v === null || v === undefined) { sb.push('null'); return; }
  if (typeof v === 'string') { stringa(sb, v); return; }
  if (typeof v === 'boolean') { sb.push(v ? 'true' : 'false'); return; }
  if (typeof v === 'number') {
    sb.push(Number.isInteger(v) && Math.abs(v) < 1e15 ? String(v) : compatto(v, 3, '.'));
    return;
  }
  const espandi = livello < espansi;
  const rientro = ' '.repeat((livello + 1) * 2);
  const chiusura = ' '.repeat(livello * 2);
  if (Array.isArray(v)) {
    sb.push('[');
    v.forEach((o, i) => {
      if (i > 0) sb.push(', ');
      scriviValore(sb, o, livello + 1, espansi);
    });
    sb.push(']');
    return;
  }
  const chiavi = Object.keys(v);
  if (chiavi.length === 0) { sb.push('{}'); return; }
  sb.push(espandi ? '{\n' : '{');
  chiavi.forEach((k, i) => {
    if (i > 0) sb.push(espandi ? ',\n' : ', ');
    if (espandi) sb.push(rientro);
    stringa(sb, k);
    sb.push(': ');
    scriviValore(sb, v[k], livello + 1, espansi);
  });
  sb.push(espandi ? '\n' + chiusura + '}' : '}');
}

function stringa(sb, s) {
  let r = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    switch (c) {
      case '"': r += '\\"'; break;
      case '\\': r += '\\\\'; break;
      case '\n': r += '\\n'; break;
      case '\r': r += '\\r'; break;
      case '\t': r += '\\t'; break;
      default: {
        const code = s.charCodeAt(i);
        if (code < 0x20) r += '\\u' + code.toString(16).padStart(4, '0');
        else r += c;
      }
    }
  }
  sb.push(r + '"');
}

function haChiave(o, chiave) {
  return o !== null && typeof o === 'object' && !Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, chiave);
}

// Come Convert.ToDouble: numeri, testi numerici e booleani; altrimenti il predefinito.
export function numero(o, chiave, predefinito) {
  if (!haChiave(o, chiave)) return predefinito;
  const v = o[chiave];
  if (v === null || v === undefined) return predefinito;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const t = v.trim();
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) ? Number(t) : predefinito;
  }
  return predefinito;
}

export function testo(o, chiave, predefinito) {
  if (!haChiave(o, chiave)) return predefinito;
  const v = o[chiave];
  if (v === null || v === undefined) return predefinito;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return compatto(v, 15, '.');
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return predefinito;
}

export function elenco(o, chiave, predefinito) {
  if (!haChiave(o, chiave)) return predefinito;
  const v = o[chiave];
  if (!Array.isArray(v)) return predefinito;
  return v.map((x) => (x === null || x === undefined ? '' : typeof x === 'string' ? x : String(x)));
}
