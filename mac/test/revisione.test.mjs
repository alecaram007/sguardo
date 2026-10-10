// Regressioni trovate dalla revisione indipendente del nucleo e della riga di comando:
// ogni caso confronta il port con quello che farebbe il codice originale (src/*.cs).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cartellaProva, sguardo, sguardoAsincrono, scrivi } from '../lib/node/aiuti-prove.mjs';

const prove = cartellaProva('sguardo-revisione-');

describe('ordine dei file come la versione Windows', () => {
  it("OrdinalIgnoreCase sui percorsi con «\\»: utils.js prima di util/x.js, lib2.js prima di lib/a.js", () => {
    const p = path.join(prove, 'ordine');
    scrivi(path.join(p, 'util', 'x.js'), ['const password = 1;']);
    scrivi(path.join(p, 'utils.js'), ['const token = 2;']);
    scrivi(path.join(p, 'lib2.js'), ['const sql = 3;']);
    scrivi(path.join(p, 'lib', 'a.js'), ['const auth = 4;']);
    sguardo(['init', p]);
    const o = sguardo(['verifica', p], { cwd: p });
    assert.equal(o.codice, 1, o.err);
    const ordine = [...o.out.matchAll(/^ {4}(\S+):1 /gm)].map((m) => m[1]);
    assert.deepEqual(ordine, ['lib2.js', 'lib/a.js', 'utils.js', 'util/x.js']);
    assert.match(o.out, /sguardo leggi lib2\.js/);
  });
});

describe('pulisci non toglie mai i dati di un file che esiste ancora', () => {
  it('cartella non leggibile (permessi): errore 2, nessun dato tolto, nemmeno degli altri file', () => {
    const p = path.join(prove, 'pulisci-permessi');
    const x = path.join(p, 'sub', 'x.js');
    const y = path.join(p, 'y.js');
    scrivi(x, ['const a = 1;', 'const b = 2;']);
    scrivi(y, ['const vecchia = 1;']);
    sguardo(['init', p]);
    sguardo(['simula', x, '1-2', '10']);
    sguardo(['simula', y, '1', '1']);
    scrivi(y, ['const nuova = 1;']);
    const datiX = path.join(p, '.sguardo', 'letture', 'sub', 'x.js.json');
    const datiY = path.join(p, '.sguardo', 'letture', 'y.js.json');
    const primaX = fs.readFileSync(datiX, 'utf8'), primaY = fs.readFileSync(datiY, 'utf8');
    fs.chmodSync(path.join(p, 'sub'), 0o000);
    let o;
    try { o = sguardo(['pulisci', p]); } finally { fs.chmodSync(path.join(p, 'sub'), 0o755); }
    if (process.getuid && process.getuid() === 0) return; // root vede tutto: il caso non si presenta
    assert.equal(o.codice, 2, o.out);
    assert.match(o.err, /Non riesco a controllare .*Non ho toccato nulla/);
    assert.doesNotMatch(o.err, /Errore inatteso/);
    assert.equal(fs.readFileSync(datiX, 'utf8'), primaX, 'i dati di sub/x.js restano');
    assert.equal(fs.readFileSync(datiY, 'utf8'), primaY, 'nessuna pulizia parziale');
    // Con i permessi di nuovo a posto la pulizia procede normalmente.
    const dopo = sguardo(['pulisci', p]);
    assert.equal(dopo.codice, 0, dopo.err);
    assert.ok(fs.existsSync(datiX));
    assert.equal(Object.keys(JSON.parse(fs.readFileSync(datiX, 'utf8')).righe).length, 2);
  });
});

describe('JSON vuoti come JavaScriptSerializer (null, non errore)', () => {
  it('regole.json vuoto: valori predefiniti; file di dati di soli spazi: nessuna attenzione', () => {
    const p = path.join(prove, 'json-vuoti');
    const a = path.join(p, 'a.js');
    scrivi(a, ['const password = 1;']);
    sguardo(['init', p]);
    fs.writeFileSync(path.join(p, '.sguardo', 'regole.json'), '');
    fs.writeFileSync(path.join(p, '.sguardo', 'letture', 'a.js.json'), '  \r\n');
    const o = sguardo(['verifica', p]);
    assert.equal(o.codice, 1, o.err);
    assert.match(o.out, /a\.js:1 +mai letta/);
    const s = sguardo(['simula', a, '1', '5']);
    assert.equal(s.codice, 0, s.err);
    assert.equal(sguardo(['verifica', p]).codice, 0);
  });
});

describe('sguardo leggi: l\'ultimo salvataggio non riesce', () => {
  it('la sessione finisce lo stesso con «salvataggio non riuscito» e codice 2 (come Chiudi() su Windows)', async () => {
    if (process.getuid && process.getuid() === 0) return;
    const p = path.join(prove, 'leggi-salva');
    const app = path.join(p, 'app.js');
    scrivi(app, ['const a = 1;']);
    sguardo(['init', p]);
    const letture = path.join(p, '.sguardo', 'letture');
    const figlio = sguardoAsincrono(['leggi', app], { cwd: p, env: { SGUARDO_NON_APRIRE: '1' } });
    let out = '', err = '';
    figlio.stdout.on('data', (c) => { out += c; });
    figlio.stderr.on('data', (c) => { err += c; });
    const fine = new Promise((r) => figlio.on('exit', (c) => r(c)));
    try {
      const indirizzo = await new Promise((ok, ko) => {
        const t = setTimeout(() => ko(new Error('nessun indirizzo: ' + out)), 10000);
        const guarda = () => { const m = /(http:\/\/127\.0\.0\.1:\d+)\/lettore\.html/.exec(out); if (m) { clearTimeout(t); ok(m[1]); } };
        figlio.stdout.on('data', guarda);
        guarda();
      });
      const d = await (await fetch(indirizzo + '/api/file?f=app.js')).json();
      const impronta = d.righe[0].impronta;
      fs.chmodSync(letture, 0o555);
      const r = await fetch(indirizzo + '/api/salva', {
        method: 'POST', body: JSON.stringify({ f: 'app.js', righe: { [impronta]: 1 }, nuove: [impronta], fine: true })
      });
      assert.equal(r.status, 500);
      const codice = await Promise.race([fine, new Promise((r2) => setTimeout(() => r2('appeso'), 8000))]);
      assert.equal(codice, 2, out + err);
      assert.match(err, /Errore: salvataggio non riuscito: /);
    } finally {
      fs.chmodSync(letture, 0o755);
      if (figlio.exitCode === null) figlio.kill();
    }
  });
});

describe('uscita verso una pipe lenta (es. «| less»)', () => {
  it('righe su un file grande: nessuna riga persa anche se chi legge aspetta più di 3 s', async () => {
    const p = path.join(prove, 'pipe-lenta');
    const grande = path.join(p, 'grande.js');
    fs.mkdirSync(p, { recursive: true });
    sguardo(['init', p]);
    const linee = [];
    for (let i = 0; i < 20000; i++) linee.push('const variabile_' + i + ' = ' + i + ' * 2; // un commento abbastanza lungo');
    scrivi(grande, linee);
    const figlio = sguardoAsincrono(['righe', grande], { cwd: p });
    let testo = '';
    figlio.stdout.setEncoding('utf8');
    figlio.stdout.on('data', (c) => { testo += c; });
    figlio.stdout.pause();
    const chiuso = new Promise((r) => figlio.on('close', (c) => r(c)));
    await new Promise((r) => setTimeout(r, 4500));
    figlio.stdout.resume();
    const codice = await Promise.race([chiuso, new Promise((r) => setTimeout(() => r('appeso'), 20000))]);
    if (codice === 'appeso') figlio.kill();
    assert.equal(codice, 0);
    assert.equal(testo.split('\n').filter((l) => /^\d+\t/.test(l)).length, 20000);
  });
});
