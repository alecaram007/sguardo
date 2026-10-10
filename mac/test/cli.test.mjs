// Port di src/test.ps1: gli stessi controlli, nello stesso ordine, sulla riga di comando vera.
// (La parte "lettore (finestra vera, autotest)" è in lettore-autotest.test.mjs.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cartellaProva, sguardo, righe, riga, scrivi } from '../lib/node/aiuti-prove.mjs';

const prove = cartellaProva();
const progetto = path.join(prove, 'progetto');
fs.mkdirSync(progetto, { recursive: true });

describe('init', () => {
  it('init crea .sguardo/regole.json e .sguardo/letture/', () => {
    const o = sguardo(['init', progetto]);
    assert.equal(o.codice, 0, o.err);
    assert.ok(fs.existsSync(path.join(progetto, '.sguardo', 'regole.json')));
    assert.ok(fs.statSync(path.join(progetto, '.sguardo', 'letture')).isDirectory());
  });
  it('init su un progetto già attivo non tocca nulla', () => {
    const o = sguardo(['init', progetto]);
    assert.equal(o.codice, 0);
    assert.match(o.out, /già attivo/);
  });
});

describe('soglia di lettura', () => {
  const soglia = path.join(progetto, 'soglia.js');
  it('soglie: minima 0,4 s, 40 caratteri = 2 s, gli spazi non contano', () => {
    scrivi(soglia, ['}', 'abcdefghij'.repeat(4), 'uno due tre quattro cinque']);
    const r = righe(soglia);
    assert.equal(riga(r, 1).soglia, 0.4, 'riga di 1 carattere: soglia minima 0,4 s');
    assert.equal(riga(r, 2).soglia, 2.0, 'riga di 40 caratteri: soglia 40 × 0,05 = 2 s');
    assert.equal(riga(r, 3).soglia, 1.1, 'gli spazi non contano: 22 caratteri → 1,1 s');
    assert.equal(r.filter((x) => x.stato !== 'mai').length, 0, 'prima di ogni lettura le righe sono «mai lette»');
  });
  it('0,39 s su una soglia di 0,4 s: «sfiorata», non letta', () => {
    sguardo(['simula', soglia, '1', '0.39']);
    assert.equal(riga(righe(soglia), 1).stato, 'sfiorata');
  });
  it("altri 0,02 s (scritti all'italiana): ora è letta", () => {
    sguardo(['simula', soglia, '1', '0,02']);
    assert.equal(riga(righe(soglia), 1).stato, 'letta');
  });
  it('1,9 s su 2 s: non ancora letta', () => {
    sguardo(['simula', soglia, '2', '1.9']);
    assert.equal(riga(righe(soglia), 2).stato, 'sfiorata');
  });
  it("l'attenzione si accumula tra sessioni: 1,9 + 0,1 = soglia → letta, due sessioni", () => {
    sguardo(['simula', soglia, '2', '0.1']);
    const r = righe(soglia);
    assert.equal(riga(r, 2).stato, 'letta');
    assert.equal(riga(r, 2).sessioni, 2, 'due sessioni contate sulla stessa riga');
    assert.equal(riga(r, 3).stato, 'mai', 'la riga non toccata resta «mai letta»');
  });
});

describe('impronte: righe spostate, modificate, identiche', () => {
  const app = path.join(progetto, 'app.js');
  let prima;
  it('simula: tutte le 7 righe lette, origine «simulazione»', () => {
    scrivi(app, [
      'function prova(a) {',
      '  const segreto = a * 2;',
      '  if (segreto > 10) {',
      '    return segreto;',
      '  }',
      '  return 0;',
      '}'
    ]);
    const o = sguardo(['simula', app, '1-7', '60']);
    assert.equal(o.codice, 0, o.err);
    prima = righe(app);
    assert.equal(prima.filter((x) => x.stato === 'letta' && x.origine === 'simulazione').length, 7, o.out);
  });
  it('impronte stabili, rientro, righe modificate e nuove', () => {
    scrivi(app, [
      '// intestazione aggiunta dopo la lettura',
      '',
      'const x = 1;',
      'function prova(a) {',
      '  const segreto = a * 2;',
      '  if (segreto > 10) {',
      '          return segreto;',
      '  }',
      '  return -1;',
      '}'
    ]);
    const dopo = righe(app);
    for (const [nuova, vecchia] of [[4, 1], [5, 2], [6, 3], [8, 5], [10, 7]]) {
      assert.equal(riga(dopo, nuova).stato, 'letta', 'impronte stabili: la riga ' + nuova + ' resta letta');
      assert.equal(riga(dopo, nuova).impronta, riga(prima, vecchia).impronta);
    }
    assert.equal(riga(dopo, 7).stato, 'letta', 'rientro diverso (spazi) = stessa riga: resta letta');
    assert.equal(riga(dopo, 7).impronta, riga(prima, 4).impronta);
    assert.equal(riga(dopo, 9).stato, 'mai', 'riga modificata ("return 0" → "return -1") torna «mai letta»');
    assert.equal(riga(dopo, 1).stato, 'mai', 'righe nuove: «mai lette»');
    assert.equal(riga(dopo, 3).stato, 'mai', 'righe nuove: «mai lette»');
  });
  it('due "}" identiche hanno impronte distinte (#0 e #1); ognuna conserva la propria lettura', () => {
    const graffe = path.join(progetto, 'graffe.js');
    scrivi(graffe, ['if (a) {', '  x();', '}', 'if (b) {', '  y();', '}']);
    sguardo(['simula', graffe, '1-3', '10']);
    let g = righe(graffe);
    const h3 = riga(g, 3).impronta, h6 = riga(g, 6).impronta;
    assert.notEqual(h3, h6);
    assert.ok(h3.endsWith('#0') && h6.endsWith('#1'), h3 + ' / ' + h6);
    assert.equal(h3.split('#')[0], h6.split('#')[0]);
    assert.equal(riga(g, 3).stato, 'letta', 'letta la prima "}"');
    assert.equal(riga(g, 6).stato, 'mai', 'non la seconda');
    scrivi(graffe, ['// commento nuovo', 'if (a) {', '  x();', '}', 'if (b) {', '  y();', '}']);
    g = righe(graffe);
    assert.equal(riga(g, 4).stato, 'letta', 'dopo uno spostamento ogni "}" conserva la propria lettura');
    assert.equal(riga(g, 7).stato, 'mai');
  });
});

describe('verifica (CI)', () => {
  const critico = path.join(progetto, 'critico.js');
  it('riga critica non letta: codice di uscita 1, elenca critico.js:1, non app.js:5', () => {
    scrivi(critico, ['const password = leggiDalVault();', "console.log('pronto');"]);
    const o = sguardo(['verifica', progetto]);
    assert.equal(o.codice, 1, o.out);
    assert.match(o.out, /critico\.js:1/);
    assert.doesNotMatch(o.out, /app\.js:5/, 'le righe critiche già lette non vengono elencate');
  });
  it('dopo la lettura: codice 0; con --solo-letture la simulazione non basta (codice 1)', () => {
    sguardo(['simula', critico, '1', '5']);
    assert.equal(sguardo(['verifica', progetto]).codice, 0);
    assert.equal(sguardo(['verifica', progetto, '--solo-letture']).codice, 1);
  });
  it('regole.json configurabile', () => {
    const regole = path.join(progetto, '.sguardo', 'regole.json');
    const originali = fs.readFileSync(regole, 'utf8');
    const j = JSON.parse(originali);
    j.critiche = 'parolachenoncenessuncodice';
    fs.writeFileSync(regole, JSON.stringify(j, null, 4), 'utf8');
    assert.equal(sguardo(['verifica', progetto, '--solo-letture']).codice, 0, 'nessuna riga critica → codice 0');
    j.critiche = 'console';
    fs.writeFileSync(regole, JSON.stringify(j, null, 4), 'utf8');
    const o = sguardo(['verifica', progetto]);
    assert.equal(o.codice, 1, '"console" diventa critica');
    assert.match(o.out, /critico\.js:2/);
    fs.writeFileSync(regole, originali, 'utf8');
  });
});

describe('rapporto', () => {
  const html = path.join(progetto, 'sguardo-rapporto.html');
  it('rapporto in console: codice 0, elenca i file e gli intervalli non letti (app.js: 1-3, 9)', () => {
    const o = sguardo(['rapporto', progetto]);
    assert.equal(o.codice, 0, o.err);
    assert.match(o.out, /app\.js/);
    assert.match(o.out, /graffe\.js/);
    assert.match(o.out, /1-3, 9/);
  });
  it('sguardo-rapporto.html: completo, autonomo, tema scuro, UTF-8', () => {
    assert.ok(fs.existsSync(html), 'sguardo-rapporto.html generato');
    const t = fs.readFileSync(html, 'utf8');
    assert.match(t, /^<!doctype html>/);
    assert.match(t, /<\/html>\s*$/);
    assert.match(t, /class="r mai/);
    assert.match(t, /class="r letta/);
    assert.match(t, /app\.js/);
    assert.doesNotMatch(t, /https?:\/\//, 'nessuna risorsa esterna');
    assert.doesNotMatch(t, /<script/);
    assert.doesNotMatch(t, /<link/);
    assert.doesNotMatch(t, /\ssrc=/);
    assert.match(t, /prefers-color-scheme:\s*dark/);
    assert.match(t, /Chi ha letto questo codice\?/);
    assert.match(t, /è/);
    assert.doesNotMatch(t, /Ã/);
  });
  it('rapporto --html <file> scrive dove richiesto', () => {
    const altro = path.join(prove, 'altro.html');
    assert.equal(sguardo(['rapporto', progetto, '--html', altro]).codice, 0);
    assert.ok(fs.existsSync(altro));
  });
  it('da una sottocartella trova .sguardo risalendo; i dati annidati vanno in letture/sotto/interno/', () => {
    const interno = path.join(progetto, 'sotto', 'interno');
    const dentro = path.join(interno, 'dentro.js');
    scrivi(dentro, ['const annidato = true;']);
    const o = sguardo(['rapporto', path.join(progetto, 'sotto'), '--html', path.join(prove, 'sotto.html')]);
    assert.equal(o.codice, 0, o.err);
    assert.match(o.out, /dentro\.js/);
    assert.doesNotMatch(o.out, /app\.js/);
    sguardo(['simula', dentro, '1', '2']);
    assert.ok(fs.existsSync(path.join(progetto, '.sguardo', 'letture', 'sotto', 'interno', 'dentro.js.json')));
  });
  it('senza .sguardo: errore con codice 2 (non 0, non 1)', () => {
    const vuota = path.join(prove, 'senza-progetto');
    fs.mkdirSync(vuota, { recursive: true });
    assert.equal(sguardo(['verifica', vuota]).codice, 2);
  });
  it('intervallo sbagliato: errore con codice 2', () => {
    assert.equal(sguardo(['simula', path.join(progetto, 'app.js'), '9-3', '5']).codice, 2);
  });
});

describe('dati e privacy', () => {
  it('JSON per file: impronta → secondi, simulati, sessioni, giorno, origine', () => {
    const dati = JSON.parse(fs.readFileSync(path.join(progetto, '.sguardo', 'letture', 'app.js.json'), 'utf8'));
    assert.equal(dati.formato, 'sguardo/1');
    assert.equal(dati.file, 'app.js');
    const voci = Object.entries(dati.righe);
    assert.ok(voci.length >= 7);
    for (const [k, v] of voci) {
      assert.equal(Object.keys(v).join(','), 'secondi,simulati,sessioni,ultima,origine');
      assert.match(k, /^[0-9a-f]{12}#\d+$/);
      assert.match(v.ultima, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(['lettura', 'simulazione', 'mista'].includes(v.origine));
    }
  });
  it('privacy: nei dati nessun nome utente, nessun computer, nessun percorso assoluto', () => {
    const chi = [os.userInfo().username, os.hostname(), os.hostname().replace(/\.local$/, ''), process.env.USER, process.env.LOGNAME]
      .filter((x) => x && x.length >= 3 && !/^[0-9a-fA-F]+$/.test(x));
    const tutti = [];
    const giu = (d) => { for (const v of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, v.name); if (v.isDirectory()) giu(p); else if (v.name.endsWith('.json')) tutti.push(p); } };
    giu(path.join(progetto, '.sguardo', 'letture'));
    assert.ok(tutti.length >= 5);
    for (const f of tutti) {
      const d = fs.readFileSync(f, 'utf8');
      const o = JSON.parse(d);
      assert.equal(Object.keys(o).join(','), 'formato,file,righe', f);
      assert.ok(!o.file.includes(':') && !o.file.startsWith('/'), o.file);
      assert.equal(d.toLowerCase().indexOf(prove.toLowerCase()), -1, 'nessun percorso assoluto');
      assert.equal(d.toLowerCase().indexOf(os.homedir().toLowerCase()), -1, 'nessuna cartella utente');
      for (const nome of chi) assert.equal(d.toLowerCase().indexOf(nome.toLowerCase()), -1, 'il nome "' + nome + '" non deve comparire');
    }
  });
});
