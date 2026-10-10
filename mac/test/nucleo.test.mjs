// Il nucleo condiviso: impronte, formati, JSON, regole, evidenziatore, intervalli.
// I dati della demo Windows (../demo/negozio) fanno da riferimento: si leggono soltanto.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sha256Esadecimale } from '../lib/sha256.mjs';
import { normalizza, caratteri, calcola, dividiRighe, espandiTab } from '../lib/impronte.mjs';
import { secondi, percento, data, leggiNumero, numero, compatto, fisso, arrotonda, plurale, Errore } from '../lib/cultura.mjs';
import { Registro } from '../lib/registro.mjs';
import { Regole } from '../lib/regole.mjs';
import { Evidenziatore } from '../lib/evidenziatore.mjs';
import { intervalli } from '../lib/analisi.mjs';
import * as Json from '../lib/json.mjs';
import { DEMO_ORIGINALE } from '../lib/node/aiuti-prove.mjs';

const NEGOZIO = path.join(DEMO_ORIGINALE, 'negozio');

describe('SHA-256 in JavaScript puro', () => {
  it('coincide con node:crypto su testi ASCII, accentati, emoji e lunghi', () => {
    const casi = ['', 'a', '}', 'const IVA = 0.22;', 'Quantità non valida — è', '😀 emoji', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)];
    for (let i = 0; i < 50; i++) casi.push(crypto.randomBytes(i * 7).toString('base64'));
    for (const t of casi) {
      assert.equal(sha256Esadecimale(t), crypto.createHash('sha256').update(t, 'utf8').digest('hex'), JSON.stringify(t));
    }
  });
});

describe('impronte', () => {
  it('normalizza: niente spazi ai bordi, spazi interni compressi (anche tab e spazi Unicode)', () => {
    assert.equal(normalizza('   return   segreto;\t '), 'return segreto;');
    assert.equal(normalizza('\ta  b　c'), 'a b c');
    assert.equal(normalizza('   '), '');
  });
  it('caratteri non spazio', () => {
    assert.equal(caratteri('uno due tre quattro cinque'), 22);
    assert.equal(caratteri('}'), 1);
  });
  it('formato: 12 cifre esadecimali (primi 6 byte) + "#" + occorrenza; null per le righe vuote', () => {
    const r = calcola(['}', '', '  }  ', 'x']);
    assert.match(r[0], /^[0-9a-f]{12}#0$/);
    assert.equal(r[1], null);
    assert.equal(r[2], r[0].replace('#0', '#1'));
    assert.equal(r[0].slice(0, 12), crypto.createHash('sha256').update('}').digest('hex').slice(0, 12));
  });
  it('le impronte della demo Windows si ritrovano tutte nei file della demo', () => {
    for (const nome of ['carrello.js', 'pagamenti.js', 'rimborsi.js']) {
      const testo = fs.readFileSync(path.join(NEGOZIO, nome), 'utf8');
      const impronte = new Set(calcola(dividiRighe(testo)).filter(Boolean));
      const dati = JSON.parse(fs.readFileSync(path.join(NEGOZIO, '.sguardo', 'letture', nome + '.json'), 'utf8'));
      const salvate = Object.keys(dati.righe);
      const ritrovate = salvate.filter((k) => impronte.has(k));
      // In rimborsi.js la riga 24 vecchia (prima della correzione) non c'è più: è l'unica impronta orfana.
      assert.ok(salvate.length - ritrovate.length <= 1, nome + ': ' + (salvate.length - ritrovate.length) + ' impronte non ritrovate');
      assert.ok(ritrovate.length >= 25, nome);
    }
  });
  it('dividiRighe: CRLF, LF e CR; l\'ultima riga vuota si toglie; BOM ignorato', () => {
    assert.deepEqual(dividiRighe('a\r\nb\nc\rd\r\n'), ['a', 'b', 'c', 'd']);
    assert.deepEqual(dividiRighe('﻿a\n\n'), ['a', '']);
    assert.deepEqual(dividiRighe(''), []);
  });
  it('espandiTab: tabulazioni ogni 4 colonne', () => {
    assert.equal(espandiTab('\tx'), '    x');
    assert.equal(espandiTab('ab\tc'), 'ab  c');
  });
});

describe('formati italiani', () => {
  it('secondi, come Cultura.Secondi', () => {
    assert.equal(secondi(0.01), '0 s');
    assert.equal(secondi(0.4), '0,4 s');
    assert.equal(secondi(2.25), '2,3 s');
    assert.equal(secondi(9.96), '10,0 s');
    assert.equal(secondi(45), '45 s');
    assert.equal(secondi(189.4), '3 min 9 s');
    assert.equal(secondi(3725), '1 h 2 min');
  });
  it('percento arrotonda per difetto, numeri "0.###"', () => {
    assert.equal(percento(84 / 86), '97%');
    assert.equal(percento(1), '100%');
    assert.equal(percento(0.999), '99%');
    assert.equal(numero(0.05), '0,05');
    assert.equal(compatto(2.0000001), '2');
    assert.equal(compatto(0.3425), '0.343');
    assert.equal(fisso(0.25, 1), '0,3');
    assert.equal(arrotonda(2.2665, 3), 2.266);
  });
  it('date abbreviate in italiano', () => {
    assert.equal(data('2026-10-01'), '1 ott 2026');
    assert.equal(data(null), '—');
    assert.equal(data('2026-02-30'), '—');
  });
  it('secondi con virgola o punto; errori chiari', () => {
    assert.equal(leggiNumero('2,5'), 2.5);
    assert.equal(leggiNumero(' 2.5 '), 2.5);
    assert.throws(() => leggiNumero('-1'), Errore);
    assert.throws(() => leggiNumero('abc'), /non è un numero di secondi valido/);
    assert.equal(plurale(1, 'riga', 'righe'), '1 riga');
    assert.equal(plurale(2, 'riga', 'righe'), '2 righe');
  });
});

describe('JSON compatibile con la versione Windows', () => {
  it('rileggere e riscrivere i JSON della demo dà gli stessi byte', () => {
    for (const nome of ['carrello.js', 'pagamenti.js', 'rimborsi.js']) {
      const testo = fs.readFileSync(path.join(NEGOZIO, '.sguardo', 'letture', nome + '.json'), 'utf8');
      const r = Registro.daOggetto(Json.leggi(testo), nome);
      assert.equal(r.testoJson(), testo, nome);
    }
  });
  it('le regole predefinite scrivono lo stesso regole.json della demo', () => {
    const testo = fs.readFileSync(path.join(NEGOZIO, '.sguardo', 'regole.json'), 'utf8');
    assert.equal(new Regole().testoJson(), testo);
    assert.equal(Regole.daOggetto(JSON.parse(testo)).testoJson(), testo);
  });
  it('voci senza "simulati" ereditano l\'origine; numeri come testo accettati', () => {
    const r = Registro.daOggetto({ righe: { 'aaaaaaaaaaaa#0': { secondi: '2.5', origine: 'simulazione', sessioni: 3.9 } } }, 'x.js');
    const v = r.righe.get('aaaaaaaaaaaa#0');
    assert.equal(v.secondi, 2.5);
    assert.equal(v.simulati, 2.5);
    assert.equal(v.sessioni, 3);
  });
  it('regole: estensioni senza punto o in maiuscolo; soglia minima non positiva → 0,4', () => {
    const r = Regole.daOggetto({ estensioni: ['JS', '.Py'], sogliaMinimaSecondi: 0 });
    assert.deepEqual(r.estensioni, ['.js', '.py']);
    assert.equal(r.sogliaMinima, 0.4);
    assert.equal(r.descriviSoglia(), 'max(0,4 s; 0,05 s × carattere)');
    assert.throws(() => Regole.daOggetto({ critiche: '(' }).critica('x'), /non è un'espressione regolare valida/);
  });
  it('righe critiche e marcatori IA (maiuscole indifferenti)', () => {
    const r = new Regole();
    assert.ok(r.critica('const PASSWORD = 1'));
    assert.ok(r.critica('importoRimborsabile(ordine)'));
    assert.ok(!r.critica('const x = 1;'));
    assert.ok(r.dichiaraIA("// Scritto dall'IA (assistente di codice)"));
    assert.ok(r.dichiaraIA('// generated by Claude'));
    assert.ok(!r.dichiaraIA('// scritto a mano'));
  });
});

describe('evidenziatore', () => {
  it('parole chiave, stringhe, numeri, commenti di riga e di blocco su più righe', () => {
    const ev = new Evidenziatore('.js');
    const t = ev.riga("  if (importo <= 0) { throw new Error('no'); } // fine");
    assert.deepEqual(t.map((x) => x.tipo), ['testo', 'chiave', 'testo', 'numero', 'testo', 'chiave', 'testo', 'chiave', 'testo', 'stringa', 'testo', 'commento']);
    assert.equal(t.map((x) => x.testo).join(''), "  if (importo <= 0) { throw new Error('no'); } // fine");
    ev.riga('/* inizio');
    assert.deepEqual(ev.riga('ancora */ x').map((x) => x.tipo), ['commento', 'testo']);
    assert.equal(new Evidenziatore('.py').riga('# commento')[0].tipo, 'commento');
  });
});

describe('intervalli', () => {
  it('"18-31", "12", "1-10,15-20" e il punto e virgola', () => {
    assert.deepEqual(intervalli('18-31'), [[18, 31]]);
    assert.deepEqual(intervalli('12'), [[12, 12]]);
    assert.deepEqual(intervalli('1-10,15-20'), [[1, 10], [15, 20]]);
    assert.deepEqual(intervalli('1;3'), [[1, 1], [3, 3]]);
  });
  it('errori: al contrario, zero, testo, vuoto', () => {
    assert.throws(() => intervalli('9-3'), /Intervallo non valido: '9-3'\./);
    assert.throws(() => intervalli('0'), /Intervallo non valido/);
    assert.throws(() => intervalli('a-b'), /Esempi: 12/);
    assert.throws(() => intervalli(''), /Manca l'intervallo/);
  });
});
