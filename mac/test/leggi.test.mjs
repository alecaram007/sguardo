// "sguardo leggi": il server temporaneo, la fine della sessione, i messaggi in console,
// gli errori. E l'autotest vero in Chrome headless con la schermata (port della
// sezione "lettore (finestra vera, autotest)" di test.ps1): si salta se Chrome non c'è.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cartellaProva, sguardo, sguardoAsincrono, righe, scrivi, sommaSecondi, leggiPng } from '../lib/node/aiuti-prove.mjs';
import { trovaChrome } from '../lib/node/chrome.mjs';

const prove = cartellaProva('sguardo-leggi-');
const progetto = path.join(prove, 'progetto');
fs.mkdirSync(progetto, { recursive: true });
sguardo(['init', progetto]);
const app = path.join(progetto, 'app.js');
scrivi(app, ['function prova(a) {', '  const segreto = a * 2;', '  if (segreto > 10) {', '    return segreto;', '  }', '  return 0;', '}']);

function attendiUscita(figlio) {
  return new Promise((r) => figlio.on('exit', (c) => r(c)));
}

describe('sguardo leggi (senza aprire il browser)', () => {
  it('apre il server, riceve la lettura dalla pagina e chiude con il riepilogo', async () => {
    const figlio = sguardoAsincrono(['leggi', app], { cwd: progetto, env: { SGUARDO_NON_APRIRE: '1' } });
    let out = '';
    figlio.stdout.on('data', (c) => { out += c; });
    const fine = attendiUscita(figlio);
    const indirizzo = await new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new Error('nessun indirizzo: ' + out)), 10000);
      const guarda = () => { const m = /(http:\/\/127\.0\.0\.1:\d+)\/lettore\.html\?f=app\.js/.exec(out); if (m) { clearTimeout(t); ok(m[1]); } };
      figlio.stdout.on('data', guarda);
      guarda();
    });
    assert.match(out, /Apro app\.js nel lettore di Sguardo\./);
    const info = await (await fetch(indirizzo + '/api/info')).json();
    assert.equal(info.modalita, 'leggi');
    const radice = await fetch(indirizzo + '/', { redirect: 'manual' });
    assert.equal(radice.status, 302);
    assert.equal(radice.headers.get('location'), '/lettore.html?f=app.js');
    const d = await (await fetch(indirizzo + '/api/file?f=app.js')).json();
    const voci = {};
    for (const r of d.righe) if (r.impronta) voci[r.impronta] = r.soglia * 1.2;
    const risposta = await fetch(indirizzo + '/api/salva', {
      method: 'POST', body: JSON.stringify({ f: 'app.js', righe: voci, nuove: Object.keys(voci), fine: true })
    });
    assert.equal(risposta.status, 200);
    await risposta.json();
    assert.equal(await fine, 0, out);
    assert.match(out, /Sessione: \d+,\d s di attenzione su 7 righe · origine «lettura»/);
    assert.match(out, /Righe lette: 0% → 100% · nessuna riga critica da leggere/);
    assert.match(out, /Dati: .*\.sguardo\/letture\/app\.js\.json/);
    const r = righe(app);
    assert.ok(r.filter((x) => x.impronta).every((x) => x.stato === 'letta' && x.origine === 'lettura' && x.sessioni === 1));
  });
  it('errori con codice 2: file mancante, opzioni sbagliate', () => {
    let o = sguardo(['leggi'], { cwd: progetto });
    assert.equal(o.codice, 2);
    assert.match(o.err, /Quale file\? Uso: {2}sguardo leggi <file> \[--autotest <secondi> --schermata <png>\]/);
    o = sguardo(['leggi', app, '--schermata', 'x.png'], { cwd: progetto });
    assert.equal(o.codice, 2);
    assert.match(o.err, /--schermata si usa insieme a --autotest\./);
    for (const s of ['0', '601', 'abc']) {
      o = sguardo(['leggi', app, '--autotest', s], { cwd: progetto });
      assert.equal(o.codice, 2, s);
    }
    o = sguardo(['leggi', path.join(progetto, 'non-esiste.js')], { cwd: progetto });
    assert.equal(o.codice, 2);
    assert.match(o.err, /non esiste/);
    o = sguardo(['leggi', app, '--boh'], { cwd: progetto });
    assert.match(o.err, /Opzione sconosciuta per 'leggi': --boh/);
  });
});

const chrome = trovaChrome();
describe('lettore vero (Chrome headless, autotest)', { skip: chrome ? false : 'Google Chrome o Chromium non installato' }, () => {
  it('leggi --autotest 3 --schermata: si chiude da solo, PNG disegnato, attenzione simulata nel JSON', () => {
    const png = path.join(prove, 'lettore.png');
    const json = path.join(progetto, '.sguardo', 'letture', 'app.js.json');
    const prima = sommaSecondi(json);
    const o = sguardo(['leggi', app, '--autotest', '3', '--schermata', png], { cwd: progetto });
    assert.equal(o.codice, 0, o.out + o.err);
    assert.match(o.out, /Autotest del lettore: apro app\.js per 3,0 s, scorro da solo e mi chiudo\./);
    assert.match(o.out, /origine «simulazione»/);
    assert.match(o.out, /Schermata della finestra: /);
    assert.ok(fs.existsSync(png), 'schermata PNG salvata');
    const img = leggiPng(png);
    const colori = new Set();
    for (let x = 0; x < img.larghezza; x += 7) for (let y = 0; y < img.altezza; y += 7) colori.add(img.pixel(x, y));
    assert.ok(img.larghezza >= 400 && img.altezza >= 300, img.larghezza + '×' + img.altezza);
    assert.ok(colori.size >= 20, "la schermata contiene un'interfaccia disegnata: " + colori.size + ' colori campionati');
    const dopo = sommaSecondi(json);
    assert.ok(dopo > prima + 1, "l'autotest registra attenzione nel JSON: prima " + prima + ', dopo ' + dopo);
    const voci = Object.values(JSON.parse(fs.readFileSync(json, 'utf8')).righe);
    assert.ok(voci.every((v) => v.simulati > 0), 'ogni riga ha ricevuto attenzione simulata');
  });
  it("l'attenzione dell'autotest è marcata come simulazione (su un file mai letto)", () => {
    const nuovo = path.join(progetto, 'nuovo.js');
    scrivi(nuovo, ['const a = 1;', 'const b = 2;', 'module.exports = { a, b };']);
    // Senza --schermata l'autotest si aprirebbe nel browser predefinito: qui uso Chrome headless.
    const p = sguardo(['leggi', nuovo, '--autotest', '2', '--schermata', path.join(prove, 'n.png')], { cwd: progetto });
    assert.equal(p.codice, 0, p.err);
    const r = righe(nuovo);
    assert.ok(r.every((x) => x.origine === 'simulazione'), r.map((x) => x.origine).join(','));
  });
});
