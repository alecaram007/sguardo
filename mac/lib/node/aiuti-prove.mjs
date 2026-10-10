// SGUARDO - piccoli aiuti per i test (node --test): cartelle temporanee, esecuzione
// della riga di comando, lettura del TSV di "sguardo righe", decodifica di un PNG.
// Non fa parte del programma: lo importano solo i file in test/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
export const MAC = path.resolve(QUI, '..', '..');
export const SGUARDO = path.join(MAC, 'bin', 'sguardo.mjs');
export const DEMO_ORIGINALE = path.resolve(MAC, '..', 'demo');

// Una cartella di prova nuova, cancellata alla fine del processo di test.
export function cartellaProva(nome = 'sguardo-prova-') {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), nome)));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* resta in tmp */ } });
  return d;
}

export function ambiente(extra = {}) {
  const env = { ...process.env, NO_COLOR: '1', ...extra };
  delete env.FORCE_COLOR;
  return env;
}

// Esegue la riga di comando; restituisce { codice, out, err }.
export function sguardo(args, { cwd = MAC, env = {} } = {}) {
  const r = spawnSync(process.execPath, [SGUARDO, ...args], { cwd, env: ambiente(env), encoding: 'utf8', timeout: 120000 });
  return { codice: r.status, out: r.stdout, err: r.stderr };
}

export function sguardoAsincrono(args, { cwd = MAC, env = {} } = {}) {
  return spawn(process.execPath, [SGUARDO, ...args], { cwd, env: ambiente(env) });
}

// Stato di ogni riga, dal comando "righe" (TSV).
export function righe(file, opzioni = []) {
  const { out } = sguardo(['righe', file, ...opzioni]);
  const r = [];
  for (const l of out.split('\n')) {
    if (!/^\d+\t/.test(l)) continue;
    const c = l.split('\t');
    r.push({
      n: Number(c[0]), stato: c[1], secondi: Number(c[2]), soglia: Number(c[3]),
      critica: c[4] === '1', origine: c[5], sessioni: Number(c[6]), impronta: c[7], testo: c[8]
    });
  }
  return r;
}

export const riga = (elenco, n) => elenco.find((x) => x.n === n);

// Come Scrivi di test.ps1: righe unite da CRLF, più un CRLF finale.
export function scrivi(file, linee) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, linee.join('\r\n') + '\r\n', 'utf8');
}

export function sommaSecondi(json) {
  const o = JSON.parse(fs.readFileSync(json, 'utf8'));
  return Object.values(o.righe).reduce((s, v) => s + Number(v.secondi), 0);
}

export function copiaDemo(destinazione) {
  fs.cpSync(path.join(DEMO_ORIGINALE, 'negozio'), path.join(destinazione, 'negozio'), { recursive: true });
  return path.join(destinazione, 'negozio');
}

// Decodifica un PNG a 8 bit (RGB o RGBA, non interlacciato): { larghezza, altezza, pixel(x, y) }.
export function leggiPng(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('non è un PNG');
  let o = 8, larghezza = 0, altezza = 0, profondita = 0, tipo = 0, interlacciato = 0;
  const idat = [];
  while (o < b.length) {
    const lung = b.readUInt32BE(o);
    const nome = b.toString('ascii', o + 4, o + 8);
    const dati = b.subarray(o + 8, o + 8 + lung);
    if (nome === 'IHDR') {
      larghezza = dati.readUInt32BE(0); altezza = dati.readUInt32BE(4);
      profondita = dati[8]; tipo = dati[9]; interlacciato = dati[12];
    } else if (nome === 'IDAT') idat.push(dati);
    else if (nome === 'IEND') break;
    o += 12 + lung;
  }
  if (profondita !== 8 || (tipo !== 2 && tipo !== 6) || interlacciato) throw new Error('formato PNG non gestito dai test');
  const bpp = tipo === 6 ? 4 : 3;
  const grezzo = zlib.inflateSync(Buffer.concat(idat));
  const riga = larghezza * bpp;
  const px = Buffer.alloc(riga * altezza);
  for (let y = 0; y < altezza; y++) {
    const f = grezzo[y * (riga + 1)];
    for (let x = 0; x < riga; x++) {
      const v = grezzo[y * (riga + 1) + 1 + x];
      const a = x >= bpp ? px[y * riga + x - bpp] : 0;
      const su = y > 0 ? px[(y - 1) * riga + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * riga + x - bpp] : 0;
      let r;
      switch (f) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + su; break;
        case 3: r = v + ((a + su) >> 1); break;
        case 4: {
          const p = a + su - c, pa = Math.abs(p - a), pb = Math.abs(p - su), pc = Math.abs(p - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? su : c);
          break;
        }
        default: throw new Error('filtro PNG sconosciuto');
      }
      px[y * riga + x] = r & 0xff;
    }
  }
  return {
    larghezza, altezza,
    pixel(x, y) { const i = y * riga + x * bpp; return (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]; }
  };
}
