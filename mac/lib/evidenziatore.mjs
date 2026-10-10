// SGUARDO - evidenziazione della sintassi, volutamente semplice e condivisa
// tra il lettore (pagina web) e il rapporto HTML. Modulo condiviso (Node e browser).

export const TipoToken = Object.freeze({ TESTO: 'testo', CHIAVE: 'chiave', STRINGA: 'stringa', COMMENTO: 'commento', NUMERO: 'numero' });

const CHIAVI = new Set([
  'abstract', 'and', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'class',
  'const', 'continue', 'def', 'default', 'del', 'delete', 'do', 'double', 'elif', 'else', 'enum', 'except',
  'export', 'extends', 'false', 'False', 'final', 'finally', 'float', 'fn', 'for', 'foreach', 'from', 'func',
  'function', 'go', 'if', 'implements', 'import', 'in', 'int', 'interface', 'is', 'lambda', 'let', 'long',
  'match', 'module', 'namespace', 'new', 'nil', 'None', 'not', 'null', 'of', 'or', 'override', 'package',
  'param', 'pass', 'private', 'protected', 'pub', 'public', 'raise', 'readonly', 'require', 'return', 'self',
  'static', 'string', 'struct', 'super', 'switch', 'this', 'throw', 'true', 'True', 'try', 'type', 'typeof',
  'undefined', 'using', 'var', 'virtual', 'void', 'while', 'with', 'yield', 'SELECT', 'FROM', 'WHERE',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'DROP', 'TABLE', 'AND', 'OR', 'NOT', 'NULL'
]);

const LETTERA = /^\p{L}$/u;
const CIFRA = /^\p{Nd}$/u;
const LETTERA_O_CIFRA = /^[\p{L}\p{Nd}]$/u;

const inizioNome = (c) => LETTERA.test(c) || c === '_' || c === '$';
const parteNome = (c) => LETTERA_O_CIFRA.test(c) || c === '_' || c === '$';

export class Evidenziatore {
  constructor(estensione) {
    switch (estensione) {
      case '.py': case '.rb': case '.sh': case '.ps1':
        this.commentoRiga = '#'; this.commentiBlocco = false; break;
      case '.sql': case '.lua':
        this.commentoRiga = '--'; this.commentiBlocco = estensione === '.sql'; break;
      case '.vb':
        this.commentoRiga = "'"; this.commentiBlocco = false; break;
      default:
        this.commentoRiga = '//'; this.commentiBlocco = true; break;
    }
    this.inBlocco = false;
  }

  // "testo" deve avere già i tab espansi. Va chiamato riga dopo riga, in ordine:
  // ricorda se un commento /* ... */ continua sulla riga successiva.
  riga(testo) {
    const r = [];
    let semplice = '';
    const svuota = () => {
      if (semplice.length === 0) return;
      r.push({ tipo: TipoToken.TESTO, testo: semplice });
      semplice = '';
    };
    let i = 0;
    const n = testo.length;
    while (i < n) {
      if (this.inBlocco) {
        const fine = testo.indexOf('*/', i);
        const stop = fine < 0 ? n : fine + 2;
        svuota();
        r.push({ tipo: TipoToken.COMMENTO, testo: testo.substring(i, stop) });
        if (fine >= 0) this.inBlocco = false;
        i = stop;
        continue;
      }
      const c = testo[i];
      if (this.commentiBlocco && c === '/' && i + 1 < n && testo[i + 1] === '*') {
        svuota();
        const fine = testo.indexOf('*/', i + 2);
        const stop = fine < 0 ? n : fine + 2;
        r.push({ tipo: TipoToken.COMMENTO, testo: testo.substring(i, stop) });
        if (fine < 0) this.inBlocco = true;
        i = stop;
        continue;
      }
      if (testo.startsWith(this.commentoRiga, i)) {
        svuota();
        r.push({ tipo: TipoToken.COMMENTO, testo: testo.substring(i) });
        break;
      }
      if (c === '"' || c === '`' || (c === "'" && this.commentoRiga !== "'")) {
        svuota();
        let j = i + 1;
        while (j < n && testo[j] !== c) { if (testo[j] === '\\') j++; j++; }
        const stop = Math.min(n, j + 1);
        r.push({ tipo: TipoToken.STRINGA, testo: testo.substring(i, stop) });
        i = stop;
        continue;
      }
      if (CIFRA.test(c) && (i === 0 || !parteNome(testo[i - 1]))) {
        svuota();
        let j = i;
        while (j < n && (LETTERA_O_CIFRA.test(testo[j]) || testo[j] === '.' || testo[j] === '_')) j++;
        r.push({ tipo: TipoToken.NUMERO, testo: testo.substring(i, j) });
        i = j;
        continue;
      }
      if (inizioNome(c)) {
        let j = i;
        while (j < n && parteNome(testo[j])) j++;
        const nome = testo.substring(i, j);
        if (CHIAVI.has(nome)) { svuota(); r.push({ tipo: TipoToken.CHIAVE, testo: nome }); }
        else semplice += nome;
        i = j;
        continue;
      }
      semplice += c;
      i++;
    }
    svuota();
    return r;
  }
}
