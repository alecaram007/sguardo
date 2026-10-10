// Le pagine vere nel browser (Chrome headless, guidato con il protocollo DevTools):
// lettura registrata come «lettura», pausa per inattività, ricerca, ricarica quando il
// file cambia, elenco dei file, niente scorrimento orizzontale a 375 px.
// Si salta se Google Chrome (o Chromium) non è installato.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { cartellaProva, copiaDemo, scrivi, righe } from '../lib/node/aiuti-prove.mjs';
import { Progetto } from '../lib/node/progetto.mjs';
import { creaGestore } from '../lib/node/servizio.mjs';
import { trovaChrome, avviaHeadless } from '../lib/node/chrome.mjs';

const chrome = trovaChrome();
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

describe('pagine nel browser', { skip: chrome ? false : 'Google Chrome o Chromium non installato' }, () => {
  let server, url, negozio;
  before(async () => {
    negozio = copiaDemo(cartellaProva('sguardo-pagina-'));
    scrivi(path.join(negozio, 'letto.js'), ['function somma(a, b) {', '  return a + b;', '}', '', 'module.exports = { somma };']);
    server = http.createServer(creaGestore({ progetto: Progetto.trova(negozio), modalita: 'progetto' }));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    url = 'http://127.0.0.1:' + server.address().port;
  });
  after(() => new Promise((r) => { server.closeAllConnections(); server.close(r); }));

  async function apri(via, larghezza = 1000, altezza = 660) {
    const b = await avviaHeadless(url + via, { larghezza, altezza });
    for (let i = 0; i < 50; i++) {
      if (await b.valuta("document.readyState === 'complete' && !!document.querySelector('.r, .elenco-file a, .vuoto-file')")) break;
      await attendi(100);
    }
    return b;
  }

  it('il lettore registra «lettura» mentre lo usi, e salva quando premi Esc', async () => {
    const b = await apri('/lettore.html?f=letto.js');
    try {
      for (let i = 0; i < 12; i++) {
        await b.valuta(`(() => { const c = document.getElementById('codice'); const r = c.getBoundingClientRect();
          c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 200 + ${i}, clientY: r.top + 30 })); })()`);
        await attendi(250);
      }
      const stato = await b.valuta("document.getElementById('reg-testo').textContent");
      assert.equal(stato, "Registro l'attenzione");
      await b.valuta("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
      await attendi(800);
    } finally { await b.chiudi(); }
    const r = righe(path.join(negozio, 'letto.js')).filter((x) => x.impronta);
    assert.ok(r.every((x) => x.origine === 'lettura' && x.sessioni === 1), r.map((x) => x.origine + '/' + x.sessioni).join(' '));
    const totale = r.reduce((s, x) => s + x.secondi, 0);
    assert.ok(totale > 2 && totale < 4.5, 'circa 3 s di attenzione: ' + totale);
    assert.ok(r[0].secondi > r[3].secondi, 'la riga sotto il puntatore riceve di più');
  });

  it('senza attività va in pausa e lo dice', async () => {
    const regole = path.join(negozio, '.sguardo', 'regole.json');
    const originali = fs.readFileSync(regole, 'utf8');
    fs.writeFileSync(regole, originali.replace('"inattivitaSecondi": 20', '"inattivitaSecondi": 1'));
    const b = await apri('/lettore.html?f=carrello.js');
    try {
      await attendi(1800);
      assert.equal(await b.valuta("document.getElementById('reg-testo').textContent"), 'In pausa · nessuna attività da 1 s');
    } finally {
      await b.chiudi();
      fs.writeFileSync(regole, originali);
    }
  });

  it('ricerca: Ctrl+F, conteggio, occorrenza successiva, Esc chiude solo la ricerca', async () => {
    const b = await apri('/lettore.html?f=pagamenti.js');
    try {
      const r = JSON.parse(await b.valuta(`(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));
        const c = document.getElementById('cerca-testo'); c.value = 'ORDINE'; c.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 100));
        const primo = document.getElementById('cerca-conto').textContent;
        c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const secondo = document.getElementById('cerca-conto').textContent;
        const marks = document.querySelectorAll('mark').length;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise((r) => setTimeout(r, 100));
        return JSON.stringify({ primo, secondo, marks, chiusa: document.getElementById('cerca').hidden, dopo: document.querySelectorAll('mark').length, velo: document.getElementById('chiuso').hidden, url: location.pathname });
      })()`));
      assert.equal(r.primo, '1 di 11');
      assert.equal(r.secondo, '2 di 11');
      assert.equal(r.marks, 11);
      assert.equal(r.chiusa, true);
      assert.equal(r.dopo, 0);
      assert.equal(r.url, '/lettore.html', 'Esc con la ricerca aperta non chiude il lettore');
    } finally { await b.chiudi(); }
  });

  it('le righe lunghe scorrono in orizzontale, il margine resta fermo', async () => {
    scrivi(path.join(negozio, 'lunga.js'), ['const x = "' + 'a'.repeat(400) + '";']);
    const b = await apri('/lettore.html?f=lunga.js');
    try {
      const r = JSON.parse(await b.valuta(`(() => { const c = document.getElementById('codice'); c.scrollLeft = 800;
        return JSON.stringify({ largo: c.scrollWidth > c.clientWidth + 1000, sx: c.scrollLeft, margine: document.querySelector('.r .g').getBoundingClientRect().left }); })()`));
      assert.ok(r.largo);
      assert.equal(r.sx, 800);
      assert.equal(r.margine, 0);
    } finally { await b.chiudi(); }
  });

  it('lo sfondo di una riga critica non letta occupa tutta la riga, non solo il testo', async () => {
    const b = await apri('/lettore.html?f=rimborsi.js');
    try {
      const r = JSON.parse(await b.valuta(`JSON.stringify({ crit: document.getElementById('r25').classList.contains('crit-nl'),
        codice: document.querySelector('#r25 code').getBoundingClientRect().right, riga: document.getElementById('r25').getBoundingClientRect().right })`));
      assert.ok(r.crit);
      assert.equal(r.codice, r.riga);
    } finally { await b.chiudi(); }
  });

  it('in fondo a un file lungo anche l\'ultima riga riceve attenzione', async () => {
    const linee = [];
    for (let i = 1; i <= 120; i++) linee.push(i === 31 ? 'const lunga = "' + 'z'.repeat(300) + '";' : 'const v' + i + ' = ' + i + ';');
    scrivi(path.join(negozio, 'fondo.js'), linee);
    for (const [larghezza, altezza] of [[1000, 700], [375, 812]]) {
      const b = await apri('/lettore.html?f=fondo.js', larghezza, altezza);
      try {
        const dx = await b.valuta(`(async () => { const c = document.getElementById('codice'); c.scrollTop = c.scrollHeight;
          await new Promise((r) => setTimeout(r, 300)); return document.getElementById('stato-dx').textContent; })()`);
        assert.match(dx, /–120 di 120/, larghezza + '×' + altezza + ': ' + dx);
        for (let i = 0; i < 8; i++) {
          await b.valuta(`(() => { const c = document.getElementById('codice'); const r = document.getElementById('r120').getBoundingClientRect();
            c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 150 + ${i}, clientY: r.top + 11 })); })()`);
          await attendi(250);
        }
        await b.valuta("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
        await attendi(800);
      } finally { await b.chiudi(); }
    }
    const r = righe(path.join(negozio, 'fondo.js'));
    assert.ok(r[119].secondi > 0.5, 'riga 120: ' + r[119].secondi + ' s');
  });

  it('se il file cambia su disco il lettore lo ricarica e avvisa', async () => {
    const file = path.join(negozio, 'cambia.js');
    scrivi(file, ['const a = 1;']);
    const b = await apri('/lettore.html?f=cambia.js');
    try {
      await attendi(300);
      scrivi(file, ['const a = 1;', 'const b = 2;', 'const c = 3;']);
      let n = 0, avviso = '';
      for (let i = 0; i < 40 && n !== 3; i++) {
        await attendi(200);
        n = await b.valuta("document.querySelectorAll('.r').length");
        avviso = await b.valuta("document.getElementById('stato-sx').textContent");
      }
      assert.equal(n, 3);
      await attendi(500);
      avviso = await b.valuta("document.getElementById('stato-sx').textContent");
      assert.match(avviso, /Il file è cambiato su disco: ricaricato\. Le righe modificate tornano «mai lette»\./);
    } finally { await b.chiudi(); }
  });

  it('pagina del progetto: esito, file con link al lettore, link al rapporto', async () => {
    const b = await apri('/');
    try {
      const r = JSON.parse(await b.valuta(`JSON.stringify({
        esito: document.querySelector('.esito strong')?.textContent,
        link: [...document.querySelectorAll('.elenco-file a.file')].map((a) => a.getAttribute('href')),
        rapporto: document.getElementById('link-rapporto').getAttribute('href'),
        critiche: [...document.querySelectorAll('#critiche a')].map((a) => a.getAttribute('href'))
      })`));
      assert.match(r.esito, /^La verifica non passa: /);
      assert.ok(r.link.includes('/lettore.html?f=rimborsi.js'));
      assert.equal(r.rapporto, '/rapporto.html');
      assert.ok(r.critiche.includes('/lettore.html?f=rimborsi.js&riga=25'));
    } finally { await b.chiudi(); }
  });

  it('lettore tra 641 e 840 px: la testata non allarga la pagina, «Fine» resta visibile e lo stato non si taglia', async () => {
    for (const larghezza of [660, 760]) {
      const b = await apri('/lettore.html?f=rimborsi.js', larghezza, 500);
      try {
        const r = JSON.parse(await b.valuta(`JSON.stringify({ sw: document.documentElement.scrollWidth,
          fine: document.getElementById('fine').getBoundingClientRect().right, stato: document.getElementById('reg-testo').scrollWidth - document.getElementById('reg-testo').clientWidth })`));
        assert.ok(r.sw <= larghezza, larghezza + ': pagina larga ' + r.sw);
        assert.ok(r.fine <= larghezza, larghezza + ': «Fine» fuori dallo schermo (' + r.fine + ')');
        assert.ok(r.stato <= 1, larghezza + ': stato della registrazione tagliato');
      } finally { await b.chiudi(); }
    }
  });

  it('a server spento gli errori sono in italiano (niente «Failed to fetch»)', async () => {
    const proprio = http.createServer(creaGestore({ progetto: Progetto.trova(negozio), modalita: 'progetto' }));
    await new Promise((r) => proprio.listen(0, '127.0.0.1', r));
    const b = await avviaHeadless('http://127.0.0.1:' + proprio.address().port + '/');
    try {
      for (let i = 0; i < 50 && !(await b.valuta("!!document.querySelector('.elenco-file a')")); i++) await attendi(100);
      proprio.closeAllConnections();
      await new Promise((r) => proprio.close(r));
      const testo = await b.valuta(`(async () => { document.getElementById('aggiorna').click();
        for (let i = 0; i < 50 && document.getElementById('errore').hidden; i++) await new Promise((r) => setTimeout(r, 100));
        return document.getElementById('errore').textContent; })()`);
      assert.equal(testo, 'Non riesco a leggere il progetto: il server non risponde. Il server di Sguardo è ancora acceso?');
    } finally { await b.chiudi(); }
    // Il lettore usa le stesse conversioni per l'apertura del file e per il salvataggio.
    const lettore = fs.readFileSync(path.join(import.meta.dirname, '..', 'web', 'lettore.js'), 'utf8');
    assert.equal((lettore.match(/\.catch\(nonRisponde\)/g) || []).length, 2);
    assert.equal((lettore.match(/const d = await leggiJson\(r\);/g) || []).length, 2);
  });

  it('a 375 px di larghezza niente scorrimento orizzontale della pagina', async () => {
    for (const via of ['/', '/lettore.html?f=rimborsi.js', '/rapporto.html']) {
      const b = await apri(via, 375, 740);
      try {
        const r = JSON.parse(await b.valuta('JSON.stringify({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'));
        assert.ok(r.sw <= r.cw, via + ': ' + r.sw + ' > ' + r.cw);
      } finally { await b.chiudi(); }
    }
  });
});
