// Le novità rispetto alla versione Windows: "sguardo pulisci", "verifica --formato github".
// (La ricerca nel lettore è provata in lettore.test.mjs e, nella pagina vera, in pagina.test.mjs.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cartellaProva, sguardo, righe, riga, scrivi } from '../lib/node/aiuti-prove.mjs';

const prove = cartellaProva('sguardo-novita-');
const progetto = path.join(prove, 'progetto');
fs.mkdirSync(progetto, { recursive: true });
sguardo(['init', progetto]);
const app = path.join(progetto, 'app.js');
const dati = path.join(progetto, '.sguardo', 'letture', 'app.js.json');
const voci = () => Object.keys(JSON.parse(fs.readFileSync(dati, 'utf8')).righe);

describe('sguardo pulisci', () => {
  it('niente da pulire: lo dice e non tocca i dati', () => {
    scrivi(app, ['const a = 1;', 'const b = 2;', 'return a + b;']);
    sguardo(['simula', app, '1-3', '10']);
    const prima = fs.readFileSync(dati, 'utf8');
    const o = sguardo(['pulisci', progetto]);
    assert.equal(o.codice, 0, o.err);
    assert.match(o.out, /Tutto pulito/);
    assert.equal(fs.readFileSync(dati, 'utf8'), prima);
  });
  it('--prova mostra cosa toglierebbe senza toccare nulla', () => {
    scrivi(app, ['const a = 1;', 'const b = 3;', 'return a + b;']);
    sguardo(['simula', app, '2', '5']);
    const prima = fs.readFileSync(dati, 'utf8');
    const o = sguardo(['pulisci', progetto, '--prova']);
    assert.equal(o.codice, 0);
    assert.match(o.out, /--prova: mostro cosa toglierei, senza toccare nulla/);
    assert.match(o.out, /app\.js +1 impronta vecchia da togliere · 3 restano/);
    assert.match(o.out, /Senza --prova toglierei 1 impronta da 1 file\./);
    assert.equal(fs.readFileSync(dati, 'utf8'), prima);
  });
  it('toglie le impronte delle versioni vecchie e lascia intatte le attuali', () => {
    const attuali = righe(app).map((r) => [r.impronta, r.secondi]);
    assert.equal(voci().length, 4);
    const o = sguardo(['pulisci', progetto]);
    assert.equal(o.codice, 0);
    assert.match(o.out, /app\.js +1 impronta vecchia tolta · 3 restano/);
    assert.match(o.out, /Tolta 1 impronta da 1 file\./);
    assert.equal(voci().length, 3);
    assert.deepEqual(righe(app).map((r) => [r.impronta, r.secondi]), attuali, 'le righe attuali conservano la loro attenzione');
    const json = JSON.parse(fs.readFileSync(dati, 'utf8'));
    assert.equal(json.formato, 'sguardo/1');
  });
  it('dopo la pulizia una riga ripristinata non ritrova più la sua lettura (è il prezzo da pagare)', () => {
    scrivi(app, ['const a = 1;', 'const b = 2;', 'return a + b;']);
    assert.equal(riga(righe(app), 2).stato, 'mai');
  });
  it('i dati di un file sorgente sparito si tolgono; da una sottocartella pulisce solo lì', () => {
    const sotto = path.join(progetto, 'sotto', 'via.js');
    const altro = path.join(progetto, 'altro.js');
    scrivi(sotto, ['const via = true;']);
    scrivi(altro, ['const altro = true;']);
    sguardo(['simula', sotto, '1', '2']);
    sguardo(['simula', altro, '1', '2']);
    fs.rmSync(sotto);
    fs.rmSync(altro);
    const o = sguardo(['pulisci', path.join(progetto, 'sotto')]);
    assert.equal(o.codice, 0, o.err);
    assert.match(o.out, /sotto\/via\.js +il file sorgente non c'è più: tolti i suoi dati \(1 impronta\)/);
    assert.doesNotMatch(o.out, /altro\.js/);
    assert.ok(!fs.existsSync(path.join(progetto, '.sguardo', 'letture', 'sotto', 'via.js.json')));
    assert.ok(fs.existsSync(path.join(progetto, '.sguardo', 'letture', 'altro.js.json')));
  });
  it('opzioni sconosciute e cartelle senza progetto: codice 2', () => {
    assert.equal(sguardo(['pulisci', progetto, '--tutto']).codice, 2);
    const vuota = path.join(prove, 'vuota');
    fs.mkdirSync(vuota);
    assert.equal(sguardo(['pulisci', vuota]).codice, 2);
  });
});

describe('sguardo verifica --formato github', () => {
  const ci = path.join(prove, 'ci');
  fs.mkdirSync(ci);
  sguardo(['init', ci]);
  const critico = path.join(ci, 'src', 'critico.js');
  scrivi(critico, ['const password = leggiDalVault();', "console.log('pronto, 100%');", 'const token = a, b;']);
  it('una annotazione ::error per riga critica non letta, con file relativo e riga', () => {
    const o = sguardo(['verifica', '.', '--formato', 'github'], { cwd: ci });
    assert.equal(o.codice, 1);
    const errori = o.out.split('\n').filter((l) => l.startsWith('::error '));
    assert.equal(errori.length, 2);
    assert.match(errori[0], /^::error file=src\/critico\.js,line=1,title=Sguardo%3A riga critica non letta::Riga critica mai letta: /);
    assert.match(errori[1], /^::error file=src\/critico\.js,line=3,/);
    assert.match(errori[1], /const token = a, b;$/);
    assert.match(o.out, /NON PASSA {3}2 righe critiche non sono state lette da un umano:/, 'il testo normale resta');
  });
  it('se passa grazie alla simulazione: un ::warning che consiglia --solo-letture ("%" diventa "%25", come vuole GitHub)', () => {
    sguardo(['simula', critico, '1-3', '20']);
    const o = sguardo(['verifica', ci, '--formato', 'github']);
    assert.equal(o.codice, 0);
    assert.match(o.out, /^::warning title=Sguardo::il 100%25 dell'attenzione è simulata\. In una CI vera usa --solo-letture\.$/m);
    assert.doesNotMatch(o.out, /::error/);
  });
  it('senza --formato nessuna annotazione; formato sconosciuto: codice 2', () => {
    assert.doesNotMatch(sguardo(['verifica', ci, '--solo-letture']).out, /^::/m);
    const o = sguardo(['verifica', ci, '--formato', 'xml']);
    assert.equal(o.codice, 2);
    assert.match(o.err, /--formato vuole 'testo' oppure 'github'\./);
  });
});

describe('aiuto e comandi', () => {
  it('aiuto elenca tutti i comandi, anche pulisci; codice 0', () => {
    for (const a of [[], ['aiuto'], ['help'], ['--help'], ['-h']]) {
      const o = sguardo(a);
      assert.equal(o.codice, 0);
      for (const c of ['init', 'leggi', 'rapporto', 'verifica', 'mostra', 'simula', 'righe', 'pulisci']) assert.match(o.out, new RegExp('sguardo ' + c + ' '));
      assert.match(o.out, /Codici di uscita: 0 tutto bene · 1 verifica non passata · 2 errore/);
    }
  });
  it('comando sconosciuto e opzione senza valore: codice 2 con il messaggio dell\'originale', () => {
    let o = sguardo(['boh']);
    assert.equal(o.codice, 2);
    assert.equal(o.err, "  Errore: Comando sconosciuto: 'boh'. Scrivi:  sguardo aiuto\n");
    o = sguardo(['rapporto', progetto, '--html']);
    assert.equal(o.err, "  Errore: L'opzione --html vuole un valore.\n");
  });
});
