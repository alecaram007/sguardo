// Il servizio HTTP (usato da server.mjs e da "sguardo leggi"): pagine, API, sicurezza,
// e una sessione di lettura simulata che usa la stessa logica della pagina del lettore.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { cartellaProva, copiaDemo, scrivi, MAC, ambiente, DEMO_ORIGINALE } from '../lib/node/aiuti-prove.mjs';
import { Progetto } from '../lib/node/progetto.mjs';
import { creaGestore } from '../lib/node/servizio.mjs';
import { distribuisci, fuocoESigma } from '../lib/attenzione.mjs';

const base = cartellaProva('sguardo-server-');
const negozio = copiaDemo(base);
scrivi(path.join(negozio, 'nuovo.js'), ['function nuovo(a) {', '  return a + 1;', '}', '', 'const token = segreto();']);
let server, url;

before(async () => {
  server = http.createServer(creaGestore({ progetto: Progetto.trova(negozio), modalita: 'progetto' }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = 'http://127.0.0.1:' + server.address().port;
});
after(() => new Promise((r) => { server.closeAllConnections(); server.close(r); }));

const get = (via, opzioni) => fetch(url + via, opzioni);
const salva = (corpo, intestazioni = {}) => fetch(url + '/api/salva', {
  method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...intestazioni }
});

// Richiesta HTTP grezza (fetch non lascia cambiare l'intestazione Host).
function grezza(via, host) {
  return new Promise((ok, ko) => {
    const r = http.request({ host: '127.0.0.1', port: server.address().port, path: via, headers: { Host: host } }, (res) => { res.resume(); ok(res.statusCode); });
    r.on('error', ko);
    r.end();
  });
}

describe('pagine e moduli', () => {
  it('pagine HTML, CSS, JS, icona; moduli condivisi sì, moduli Node no', async () => {
    for (const [via, tipo] of [['/', 'text/html'], ['/index.html', 'text/html'], ['/lettore.html', 'text/html'], ['/stile.css', 'text/css'],
      ['/lettore.css', 'text/css'], ['/app.js', 'text/javascript'], ['/lettore.js', 'text/javascript'], ['/icona.svg', 'image/svg+xml'],
      ['/lib/attenzione.mjs', 'text/javascript'], ['/lib/cultura.mjs', 'text/javascript'], ['/lib/evidenziatore.mjs', 'text/javascript']]) {
      const r = await get(via);
      assert.equal(r.status, 200, via);
      assert.ok(r.headers.get('content-type').startsWith(tipo), via + ': ' + r.headers.get('content-type'));
      await r.arrayBuffer();
    }
    for (const via of ['/lib/node/servizio.mjs', '/lib/node/progetto.mjs', '/../server.mjs', '/package.json', '/niente.html']) {
      const r = await get(via);
      assert.equal(r.status, 404, via);
      await r.arrayBuffer();
    }
  });
  it('le pagine non caricano nulla da fuori (offline) e hanno una CSP', async () => {
    for (const p of ['index.html', 'lettore.html', 'app.js', 'lettore.js', 'stile.css', 'lettore.css']) {
      const t = fs.readFileSync(path.join(MAC, 'web', p), 'utf8');
      assert.doesNotMatch(t, /https?:\/\/(?!127\.0\.0\.1)/, p);
    }
    const r = await get('/');
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    await r.text();
  });
  it('i moduli condivisi non importano nulla di Node', () => {
    for (const f of fs.readdirSync(path.join(MAC, 'lib')).filter((x) => x.endsWith('.mjs'))) {
      assert.doesNotMatch(fs.readFileSync(path.join(MAC, 'lib', f), 'utf8'), /from ['"]node:/, f);
    }
  });
});

describe('API', () => {
  it('/api/progetto: verifica, totali e file con la striscia dell\'attenzione', async () => {
    const d = await (await get('/api/progetto')).json();
    assert.equal(d.nome, 'negozio');
    assert.equal(d.verifica.passa, false);
    assert.equal(d.file.length, 4);
    const r = d.file.find((f) => f.relativo === 'rimborsi.js');
    assert.equal(r.ia, true);
    assert.equal(r.percento, '94%');
    assert.equal(r.nonLette, '3, 25');
    assert.equal(r.criticheNonLette, 1);
    assert.equal(r.striscia.length, 34);
    assert.ok(r.striscia.includes('var(--rosso)'));
    assert.ok(d.elencoCritiche.some((c) => c.file === 'rimborsi.js' && c.numero === 25 && /^sfiorata/.test(c.stato)));
    const solo = await (await get('/api/progetto?solo=1')).json();
    assert.equal(solo.soloLetture, true);
    assert.equal(solo.totali.lette, 0, 'con --solo-letture la demo (tutta simulata) non ha righe lette');
  });
  it('/api/file: righe con impronta, soglia, stato; firma per accorgersi dei cambiamenti', async () => {
    const d = await (await get('/api/file?f=rimborsi.js')).json();
    assert.equal(d.relativo, 'rimborsi.js');
    assert.equal(d.righe.length, 42);
    assert.equal(d.inattivita, 20);
    assert.match(d.righe[0].impronta, /^[0-9a-f]{12}#0$/);
    assert.equal(d.righe[3].impronta, null);
    assert.equal(d.righe[24].critica, true);
    const s = await (await get('/api/file/stato?f=rimborsi.js')).json();
    assert.equal(s.firma, d.firma);
  });
  it('niente file fuori dal progetto o dentro .sguardo', async () => {
    for (const f of ['../../../etc/passwd', '.sguardo/regole.json', '.sguardo/letture/rimborsi.js.json', '', 'nonesiste.js', '/etc/passwd']) {
      const r = await get('/api/file?f=' + encodeURIComponent(f));
      assert.equal(r.status, 404, f);
      await r.text();
    }
  });
  it('/rapporto.html: il rapporto autonomo, senza script', async () => {
    const r = await get('/rapporto.html');
    const t = await r.text();
    assert.equal(r.status, 200);
    assert.match(t, /^<!doctype html>/);
    assert.match(t, /Chi ha letto questo codice\?/);
    assert.doesNotMatch(t, /<script/);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  });
});

describe('sicurezza', () => {
  it('Host diverso da 127.0.0.1 / localhost: 403 (niente DNS rebinding)', async () => {
    assert.equal(await grezza('/api/info', 'evil.example:80'), 403);
    assert.equal(await grezza('/api/info', 'localhost:' + server.address().port), 200);
  });
  it('POST da un\'altra origine: 403; dati non validi: 400', async () => {
    let r = await salva({ f: 'nuovo.js', righe: {} }, { Origin: 'http://evil.example' });
    assert.equal(r.status, 403);
    r = await salva({ f: 'nuovo.js', righe: { 'non-valida': 1 } });
    assert.equal(r.status, 400);
    r = await salva({ f: 'nuovo.js', righe: { 'aaaaaaaaaaaa#0': -1 } });
    assert.equal(r.status, 400);
    r = await salva({ f: '../fuori.js', righe: {} });
    assert.equal(r.status, 400);
    r = await fetch(url + '/api/salva', { method: 'POST', body: '{non è json' });
    assert.equal(r.status, 400);
  });
});

describe('richieste strane', () => {
  it('corpo troppo grande: 413 con un messaggio (con o senza Content-Length), il server resta vivo', async () => {
    let r = await fetch(url + '/api/salva', { method: 'POST', body: 'a'.repeat(3e6) });
    assert.equal(r.status, 413);
    assert.equal((await r.json()).errore, 'Richiesta troppo grande.');
    const pezzi = new ReadableStream({ start(c) { for (let i = 0; i < 30; i++) c.enqueue(new Uint8Array(100000).fill(97)); c.close(); } });
    r = await fetch(url + '/api/salva', { method: 'POST', body: pezzi, duplex: 'half' });
    assert.equal(r.status, 413);
    assert.equal((await r.json()).errore, 'Richiesta troppo grande.');
    r = await get('/api/info');
    assert.equal(r.status, 200);
    await r.text();
  });
  it('indirizzo malformato: 400, non 500', async () => {
    const codice = await new Promise((ok, ko) => {
      const r = http.request({ host: '127.0.0.1', port: server.address().port, path: 'http://[x', headers: { Host: '127.0.0.1:' + server.address().port } }, (res) => { res.resume(); ok(res.statusCode); });
      r.on('error', ko);
      r.end();
    });
    assert.equal(codice, 400);
  });
});

describe('messaggi d\'errore per la pagina', () => {
  it('in italiano, senza percorsi assoluti del Mac né messaggi di sistema', async () => {
    const controlla = async (r, atteso) => {
      const t = await r.text();
      assert.ok(!t.includes(negozio) && !t.includes(base), 'percorso assoluto nella risposta: ' + t);
      assert.doesNotMatch(t, /EACCES|ENOENT|permission denied|at .*\.mjs/);
      assert.match(JSON.parse(t).errore, atteso);
    };
    await controlla(await get('/api/file?f=' + encodeURIComponent('../../../etc/passwd')), /^Il file '\.\.\/\.\.\/\.\.\/etc\/passwd' non è dentro il progetto\.$/);
    await controlla(await salva({ f: '../fuori.js', righe: {} }), /non è dentro il progetto\.$/);
    const dati = path.join(negozio, '.sguardo', 'letture', 'carrello.js.json');
    const originale = fs.readFileSync(dati);
    fs.writeFileSync(dati, '{rotto');
    try { await controlla(await get('/api/file?f=carrello.js'), /^Dati illeggibili in '\.sguardo\/letture\/carrello\.js\.json'/); }
    finally { fs.writeFileSync(dati, originale); }
    const imp = (await (await get('/api/file?f=carrello.js')).json()).righe[0].impronta;
    const letture = path.join(negozio, '.sguardo', 'letture');
    fs.chmodSync(letture, 0o555);
    try {
      const r = await salva({ f: 'carrello.js', righe: { [imp]: 1 } });
      assert.equal(r.status, 500);
      await controlla(r, /^Permesso negato/);
    } finally { fs.chmodSync(letture, 0o755); }
  });
});

describe('una sessione di lettura come la fa la pagina', () => {
  it('40 tick da 0,25 s con il puntatore sulla riga 2: 10 s registrati come «lettura», una sessione', async () => {
    const d = await (await get('/api/file?f=nuovo.js')).json();
    const soglie = d.righe.map((r) => (r.impronta ? r.soglia : null));
    const delta = new Array(soglie.length).fill(0);
    for (let k = 0; k < 40; k++) {
      const { fuoco, sigma } = fuocoESigma({ puntatoreDentro: true, rigaPuntatore: 1.5, primaRiga: 0, righeVisibili: 30 });
      distribuisci({ soglie, inizio: 0, fine: soglie.length, fuoco, sigma, dt: 0.25 }).forEach((q, i) => { delta[i] += q; });
    }
    const righe = {};
    d.righe.forEach((r, i) => { if (r.impronta && delta[i] > 0) righe[r.impronta] = delta[i]; });
    const r = await salva({ f: 'nuovo.js', sessione: 'prova', simulata: false, righe, nuove: Object.keys(righe), fine: false }, { Origin: url });
    assert.equal(r.status, 200);
    const risposta = await r.json();
    assert.equal(Object.keys(risposta.righe).length, 4);
    const json = JSON.parse(fs.readFileSync(path.join(negozio, '.sguardo', 'letture', 'nuovo.js.json'), 'utf8'));
    const voci = Object.values(json.righe);
    assert.ok(Math.abs(voci.reduce((s, v) => s + v.secondi, 0) - 10) < 0.01);
    assert.ok(voci.every((v) => v.origine === 'lettura' && v.sessioni === 1 && v.simulati === 0));
    // Secondo salvataggio della stessa sessione: le sessioni non aumentano, i secondi sì.
    await (await salva({ f: 'nuovo.js', sessione: 'prova', righe, nuove: [] })).json();
    const dopo = JSON.parse(fs.readFileSync(path.join(negozio, '.sguardo', 'letture', 'nuovo.js.json'), 'utf8'));
    assert.ok(Object.values(dopo.righe).every((v) => v.sessioni === 1));
    assert.ok(Math.abs(Object.values(dopo.righe).reduce((s, v) => s + v.secondi, 0) - 20) < 0.01);
    const stato = await (await get('/api/progetto')).json();
    assert.equal(stato.file.find((f) => f.relativo === 'nuovo.js').percento, '100%');
  });
  it('autotest: l\'attenzione arriva come «simulazione»', async () => {
    const d = await (await get('/api/file?f=nuovo.js')).json();
    const imp = d.righe[0].impronta;
    await (await salva({ f: 'nuovo.js', simulata: true, righe: { [imp]: 5 }, nuove: [imp] })).json();
    const json = JSON.parse(fs.readFileSync(path.join(negozio, '.sguardo', 'letture', 'nuovo.js.json'), 'utf8'));
    assert.equal(json.righe[imp].origine, 'mista');
    assert.equal(json.righe[imp].simulati, 5);
  });
});

describe('server.mjs', () => {
  async function portaLibera() {
    const s = net.createServer();
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    const p = s.address().port;
    await new Promise((r) => s.close(r));
    return p;
  }
  it('stampa l\'indirizzo, risponde, si chiude con SIGTERM', async () => {
    const porta = await portaLibera();
    const figlio = spawn(process.execPath, [path.join(MAC, 'server.mjs'), negozio], { env: ambiente({ PORT: String(porta) }) });
    let out = '';
    await new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new Error('il server non parte: ' + out)), 10000);
      figlio.stdout.on('data', (c) => { out += c; if (out.includes('indirizzo')) { clearTimeout(t); ok(); } });
    });
    assert.match(out, new RegExp('indirizzo http://127\\.0\\.0\\.1:' + porta + '/'));
    const r = await fetch('http://127.0.0.1:' + porta + '/api/info');
    assert.equal((await r.json()).modalita, 'progetto');
    const fine = new Promise((r2) => figlio.on('exit', (c) => r2(c)));
    figlio.kill('SIGTERM');
    assert.equal(await fine, 0);
  });
  it('senza argomenti usa la demo per Mac: la crea copiando la demo Windows, che resta intatta', async () => {
    const demoWindows = path.join(DEMO_ORIGINALE, 'negozio');
    const impronta = () => fs.readdirSync(demoWindows, { recursive: true }).sort()
      .map((f) => { const st = fs.statSync(path.join(demoWindows, f)); return f + ':' + st.size + ':' + st.mtimeMs; }).join('|');
    const prima = impronta();
    const demoMac = path.join(cartellaProva('sguardo-demo-mac-'), 'demo');
    const porta = await portaLibera();
    const figlio = spawn(process.execPath, [path.join(MAC, 'server.mjs')], { env: ambiente({ PORT: String(porta), SGUARDO_DEMO_CARTELLA: demoMac, SGUARDO_PROGETTO: '' }) });
    let out = '';
    try {
      await new Promise((ok, ko) => {
        const t = setTimeout(() => ko(new Error('il server non parte: ' + out)), 10000);
        figlio.stdout.on('data', (c) => { out += c; if (out.includes('indirizzo')) { clearTimeout(t); ok(); } });
      });
      const info = await (await fetch('http://127.0.0.1:' + porta + '/api/info')).json();
      assert.equal(info.radice, path.join(demoMac, 'negozio'));
      assert.ok(fs.existsSync(path.join(demoMac, '.demo-sguardo')), 'demo.command potrà ricrearla');
      const d = await (await fetch('http://127.0.0.1:' + porta + '/api/file?f=carrello.js')).json();
      const imp = d.righe[0].impronta;
      const r = await fetch('http://127.0.0.1:' + porta + '/api/salva', { method: 'POST', body: JSON.stringify({ f: 'carrello.js', righe: { [imp]: 2 }, nuove: [imp] }) });
      assert.equal(r.status, 200);
      await r.text();
    } finally {
      const fine = new Promise((r2) => figlio.on('exit', r2));
      figlio.kill('SIGTERM');
      await fine;
    }
    assert.equal(impronta(), prima, 'la demo Windows non cambia');
    assert.ok(fs.readFileSync(path.join(demoMac, 'negozio', '.sguardo', 'letture', 'carrello.js.json'), 'utf8').includes('"origine": "mista"'));
  });
  it('PORT non valida: esce con 2 e lo spiega in italiano, senza pile di Node', async () => {
    for (const p of ['99999', 'abc', '-5']) {
      const figlio = spawn(process.execPath, [path.join(MAC, 'server.mjs'), negozio], { env: ambiente({ PORT: p }) });
      let err = '';
      figlio.stderr.on('data', (c) => { err += c; });
      assert.equal(await new Promise((r) => figlio.on('exit', r)), 2, p);
      assert.equal(err.trim(), "Errore: PORT='" + p + "' non è una porta valida: serve un numero da 1 a 65535.");
    }
  });
  it('senza progetto Sguardo esce con 2 e lo spiega', async () => {
    const vuota = cartellaProva('sguardo-vuota-');
    const figlio = spawn(process.execPath, [path.join(MAC, 'server.mjs'), vuota], { env: ambiente({ PORT: '1' }) });
    let err = '';
    figlio.stderr.on('data', (c) => { err += c; });
    const codice = await new Promise((r) => figlio.on('exit', r));
    assert.equal(codice, 2);
    assert.match(err, /Nessun progetto Sguardo trovato/);
  });
});
