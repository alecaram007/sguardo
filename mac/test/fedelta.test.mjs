// Fedeltà alla versione Windows: si rifanno i passi 1-8 della demo (demo.ps1) con il
// porting Node e si confrontano i rapporti HTML con quelli generati dalla versione
// Windows, che sono in ../demo. Cambiano solo data, ora e percorso della cartella.
// Poi si leggono i dati demo già presenti (su una copia: gli originali non si toccano).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cartellaProva, sguardo, copiaDemo, DEMO_ORIGINALE } from '../lib/node/aiuti-prove.mjs';
import { CARRELLO, PAGAMENTI, RIMBORSI, correggiRimborsi } from '../lib/node/negozio.mjs';

// Toglie ciò che dipende da quando e dove è stato generato il rapporto.
function normalizza(html) {
  return html
    .replace(/\d+ [a-z]+ \d{4}, \d{2}:\d{2}<br>[^<]*<\/p>/, 'DATA<br>CARTELLA</p>')
    .replace(/Generato da Sguardo il [^<]*\./, 'Generato da Sguardo il DATA.')
    .replace('.sguardo\\regole.json', '.sguardo/regole.json');
}

describe('la demo rifatta in Node produce gli stessi rapporti della versione Windows', () => {
  const demo = cartellaProva('sguardo-fedelta-');
  const negozio = path.join(demo, 'negozio');
  const env = { SGUARDO_OGGI: '2026-10-01' };
  const s = (...a) => sguardo(a, { cwd: demo, env });

  it('i file del negozio sono identici a quelli della demo Windows', () => {
    fs.mkdirSync(negozio, { recursive: true });
    fs.writeFileSync(path.join(negozio, 'carrello.js'), CARRELLO);
    fs.writeFileSync(path.join(negozio, 'pagamenti.js'), PAGAMENTI);
    fs.writeFileSync(path.join(negozio, 'rimborsi.js'), RIMBORSI);
    for (const f of ['carrello.js', 'pagamenti.js']) {
      assert.equal(fs.readFileSync(path.join(negozio, f), 'utf8'), fs.readFileSync(path.join(DEMO_ORIGINALE, 'negozio', f), 'utf8'), f);
    }
    // rimborsi.js nella demo Windows è già corretto (passo 7): lo confronto dopo la correzione.
    assert.equal(correggiRimborsi(RIMBORSI).testo, fs.readFileSync(path.join(DEMO_ORIGINALE, 'negozio', 'rimborsi.js'), 'utf8'));
  });

  it('passi 1-3: rapporto dopo la revisione parziale = revisione-parziale.html', () => {
    assert.equal(s('init', 'negozio').codice, 0);
    for (const a of [['negozio/carrello.js', '1-31', '45'], ['negozio/pagamenti.js', '1-32', '50'], ['negozio/rimborsi.js', '1-19', '30'],
      ['negozio/rimborsi.js', '20', '1'], ['negozio/rimborsi.js', '33-41', '25']]) {
      assert.equal(s('simula', ...a).codice, 0);
    }
    const o = s('rapporto', 'negozio', '--html', 'revisione-parziale.html');
    assert.equal(o.codice, 0, o.err);
    const nostro = normalizza(fs.readFileSync(path.join(demo, 'revisione-parziale.html'), 'utf8'));
    const originale = normalizza(fs.readFileSync(path.join(DEMO_ORIGINALE, 'revisione-parziale.html'), 'utf8'));
    assert.equal(nostro, originale);
  });

  it('passi 5-6: la verifica fallisce con 1, poi passa con 0', () => {
    const o = s('verifica', 'negozio');
    assert.equal(o.codice, 1);
    assert.match(o.out, /NON PASSA {3}\d+ righe critiche non sono state lette da un umano:/);
    assert.match(o.out, /Qualcuno deve leggerle prima del merge: {2}sguardo leggi negozio\/rimborsi\.js/);
    assert.equal(s('simula', 'negozio/rimborsi.js', '20-31', '40').codice, 0);
    const p = s('verifica', 'negozio');
    assert.equal(p.codice, 0);
    assert.match(p.out, /PASSA {3}tutte le 22 righe critiche sono state lette da un umano\./);
  });

  it('passi 7-8: dopo la correzione la verifica rifallisce e il rapporto = sguardo-rapporto.html', () => {
    const rimborsi = path.join(negozio, 'rimborsi.js');
    fs.writeFileSync(rimborsi, correggiRimborsi(fs.readFileSync(rimborsi, 'utf8')).testo);
    const v = s('verifica', 'negozio');
    assert.equal(v.codice, 1);
    assert.match(v.out, /rimborsi\.js:25 {2}mai letta/);
    assert.equal(s('rapporto', 'negozio').codice, 0);
    const nostro = normalizza(fs.readFileSync(path.join(negozio, 'sguardo-rapporto.html'), 'utf8'));
    const originale = normalizza(fs.readFileSync(path.join(DEMO_ORIGINALE, 'negozio', 'sguardo-rapporto.html'), 'utf8'));
    assert.equal(nostro, originale);
  });

  it('mostra: stesse righe e stessi simboli della demo', () => {
    const o = s('mostra', 'negozio/rimborsi.js', '1-5,21-32');
    assert.equal(o.codice, 0);
    assert.match(o.out, /rimborsi\.js · scritto dall'IA · 94% lette · 1 riga critica non letta/);
    assert.match(o.out, / {3}3 {2}░░ {3}\/\/ 1 ottobre 2026/);
    assert.match(o.out, / {2}25 {2}░░ ! {3}if \(importo <= 0 \|\| importo > importoRimborsabile\(ordine\)\) \{/);
    assert.doesNotMatch(o.out, / 6 {2}/, 'le righe fuori dagli intervalli non si mostrano');
  });
});

describe('i dati demo già presenti si leggono correttamente (su una copia)', () => {
  const copia = copiaDemo(cartellaProva('sguardo-demo-'));
  it('rapporto: 84 righe su 86 lette, 1 critica non letta (rimborsi.js:25)', () => {
    const o = sguardo(['rapporto', copia, '--html', path.join(copia, '..', 'r.html')]);
    assert.equal(o.codice, 0, o.err);
    assert.match(o.out, /Totale: 84 righe su 86 lette da un umano \(97%\) · 0 mai lette · 2 sfiorate/);
    assert.match(o.out, /Critiche: 1 riga critica non letta su 23/);
    assert.match(o.out, /rimborsi\.js {2}IA {5}34 {3}█████████░ {2}94% {4}3, 25/);
    assert.match(o.out, /rimborsi\.js:25 {2}sfiorata, 0,2 su 2,6 s {3}if \(importo/);
  });
  it('verifica: codice 1; con --solo-letture tutte le critiche risultano non lette', () => {
    assert.equal(sguardo(['verifica', copia]).codice, 1);
    const o = sguardo(['verifica', copia, '--solo-letture']);
    assert.equal(o.codice, 1);
    assert.match(o.out, /23 righe critiche non sono state lette/);
  });
  it('i dati originali non sono stati toccati', () => {
    const originale = path.join(DEMO_ORIGINALE, 'negozio', '.sguardo', 'letture', 'rimborsi.js.json');
    assert.equal(fs.readFileSync(originale, 'utf8'), fs.readFileSync(path.join(copia, '.sguardo', 'letture', 'rimborsi.js.json'), 'utf8'));
  });
});
