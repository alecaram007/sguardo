// I lanciatori .command: avvia.command (server + browser, che qui è un finto «open»)
// e sguardo.command, provati da una cartella con spazi e accenti nel percorso.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { cartellaProva, copiaDemo, MAC, ambiente } from '../lib/node/aiuti-prove.mjs';

async function portaLibera() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}

// Una cartella con spazi e accenti, la demo dentro e un finto «open» nel PATH che annota gli indirizzi.
function preparaCartella() {
  const base = path.join(cartellaProva('sguardo-lanciatori-'), 'Prove con àccenti');
  fs.mkdirSync(base, { recursive: true });
  copiaDemo(base);
  const finti = path.join(base, 'finti');
  fs.mkdirSync(finti);
  const registro = path.join(base, 'open.log');
  fs.writeFileSync(path.join(finti, 'open'), '#!/bin/bash\necho "$*" >> "' + registro + '"\n', { mode: 0o755 });
  return { base, registro, env: (porta) => ambiente({ PORT: String(porta), PATH: finti + path.delimiter + process.env.PATH }) };
}

function aspettaUscita(figlio, ms = 10000) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => { figlio.kill('SIGKILL'); ko(new Error('il lanciatore non è uscito')); }, ms);
    figlio.on('exit', (c) => { clearTimeout(t); ok(c); });
  });
}

describe('avvia.command', () => {
  it('apre il browser sul proprio server, con il percorso relativo alla cartella da cui lo lanci, e lo spegne alla chiusura', async () => {
    const { base, registro, env } = preparaCartella();
    const porta = await portaLibera();
    const figlio = spawn(path.join(MAC, 'avvia.command'), ['negozio'], { cwd: base, env: env(porta), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    figlio.stdout.on('data', (c) => { out += c; });
    figlio.stderr.on('data', (c) => { out += c; });
    try {
      await new Promise((ok, ko) => {
        const t = setTimeout(() => ko(new Error('non parte: ' + out)), 10000);
        figlio.stdout.on('data', () => { if (out.includes('Chiudi questa finestra')) { clearTimeout(t); ok(); } });
      });
      assert.equal(fs.readFileSync(registro, 'utf8').trim(), 'http://localhost:' + porta + '/');
      const info = await (await fetch('http://127.0.0.1:' + porta + '/api/info')).json();
      assert.equal(info.radice, fs.realpathSync(path.join(base, 'negozio')));
    } finally {
      figlio.kill('SIGTERM');
    }
    await aspettaUscita(figlio);
    await assert.rejects(fetch('http://127.0.0.1:' + porta + '/api/info'), 'il server si è spento con il lanciatore');
  });

  it('se la porta è già occupata da un altro programma non apre il browser su quello', async () => {
    const { base, registro, env } = preparaCartella();
    const altro = http.createServer((req, res) => res.end('un altro programma'));
    await new Promise((r) => altro.listen(0, '127.0.0.1', r));
    const porta = altro.address().port;
    try {
      const figlio = spawn(path.join(MAC, 'avvia.command'), ['negozio'], { cwd: base, env: env(porta), stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      figlio.stderr.on('data', (c) => { err += c; });
      figlio.stdout.resume();
      assert.equal(await aspettaUscita(figlio), 2);
      assert.match(err, new RegExp('la porta ' + porta + ' è già in uso'));
      assert.equal(fs.existsSync(registro), false, 'nessun browser aperto');
    } finally {
      altro.closeAllConnections();
      await new Promise((r) => altro.close(r));
    }
  });
});

describe('sguardo.command', () => {
  it('lavora nella cartella da cui lo lanci, anche con spazi e accenti nel percorso', () => {
    const { base } = preparaCartella();
    const o = spawnSync(path.join(MAC, 'sguardo.command'), ['verifica', 'negozio'], { cwd: base, env: ambiente(), encoding: 'utf8' });
    assert.equal(o.status, 1, o.stdout + o.stderr);
    assert.match(o.stdout, /rimborsi\.js:25/);
  });
});
