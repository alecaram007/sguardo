// SGUARDO - schermata del lettore senza dipendenze: apre Google Chrome (o Chromium,
// Edge, Brave) in modalità headless con una cartella di profilo temporanea e cattura
// la pagina con il protocollo DevTools, usando il WebSocket integrato in Node.
// Solo Node. Se nessun browser Chromium è installato, la schermata non si può fare.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CANDIDATI = [
  'Google Chrome.app/Contents/MacOS/Google Chrome',
  'Chromium.app/Contents/MacOS/Chromium',
  'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'Brave Browser.app/Contents/MacOS/Brave Browser'
];

export function trovaChrome() {
  const env = process.env.SGUARDO_CHROME;
  if (env) return fs.existsSync(env) ? env : null;
  const cartelle = ['/Applications', path.join(os.homedir(), 'Applications')];
  for (const c of cartelle) {
    for (const k of CANDIDATI) {
      const p = path.join(c, k);
      if (fs.existsSync(p)) return p;
    }
  }
  for (const nome of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    for (const d of String(process.env.PATH || '').split(path.delimiter)) {
      const p = path.join(d, nome);
      if (d && fs.existsSync(p)) return p;
    }
  }
  return null;
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// Avvia il browser headless sulla pagina. Restituisce { cattura(), chiudi() }.
export async function avviaHeadless(url, { larghezza = 1000, altezza = 660, eseguibile = trovaChrome() } = {}) {
  if (!eseguibile) throw new Error('serve Google Chrome (o Chromium) per catturare la pagina senza dipendenze');
  const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'sguardo-chrome-'));
  const figlio = spawn(eseguibile, [
    '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profilo,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-device-scale-factor=1', '--window-size=' + larghezza + ',' + altezza, url
  ], { stdio: 'ignore' });
  let uscito = false;
  figlio.on('exit', () => { uscito = true; });
  figlio.on('error', () => { uscito = true; });

  // Chiude il browser e cancella il profilo temporaneo (aspetta che il processo sia uscito).
  const finito = new Promise((r) => { figlio.once('exit', r); figlio.once('error', r); });
  const chiudi = async () => {
    try { if (!uscito) figlio.kill('SIGTERM'); } catch { /* già chiuso */ }
    const t = setTimeout(() => { try { if (!uscito) figlio.kill('SIGKILL'); } catch { /* già chiuso */ } }, 1500);
    await Promise.race([finito, attendi(3000)]);
    clearTimeout(t);
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(profilo, { recursive: true, force: true }); break; } catch { await attendi(100); }
    }
  };

  // La porta del DevTools: Chrome la scrive in DevToolsActivePort nel profilo.
  let porta = null;
  for (let i = 0; i < 150 && porta === null && !uscito; i++) {
    try {
      const t = fs.readFileSync(path.join(profilo, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      if (/^\d+$/.test(t)) porta = Number(t);
    } catch { /* non ancora */ }
    if (porta === null) await attendi(100);
  }
  if (porta === null) { await chiudi(); throw new Error('il browser headless non si è avviato'); }

  async function socketPagina() {
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch('http://127.0.0.1:' + porta + '/json/list');
        const elenco = await r.json();
        const pagina = elenco.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
        if (pagina) return pagina.webSocketDebuggerUrl;
      } catch { /* non ancora */ }
      await attendi(100);
    }
    throw new Error('nessuna pagina nel browser headless');
  }

  // Un solo collegamento DevTools per tutta la sessione.
  let ws;
  let prossimo = 1;
  const inAttesa = new Map();
  try {
    ws = new WebSocket(await socketPagina());
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = () => ko(new Error('connessione DevTools non riuscita')); });
  } catch (e) { await chiudi(); throw e; }
  ws.onmessage = (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
    const attesa = inAttesa.get(m.id);
    if (attesa) { inAttesa.delete(m.id); attesa(m); }
  };
  function comando(method, params = {}) {
    return new Promise((ok, ko) => {
      const id = prossimo++;
      const t = setTimeout(() => { inAttesa.delete(id); ko(new Error('il browser non ha risposto')); }, 15000);
      inAttesa.set(id, (m) => { clearTimeout(t); m.error ? ko(new Error(m.error.message)) : ok(m.result); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  // La finestra headless ha la barra del browser: fisso l'area della pagina a larghezza × altezza.
  try { await comando('Emulation.setDeviceMetricsOverride', { width: larghezza, height: altezza, deviceScaleFactor: 1, mobile: false }); }
  catch { /* resta la dimensione della finestra */ }

  async function cattura() {
    const r = await comando('Page.captureScreenshot', { format: 'png' });
    if (!r || !r.data) throw new Error('schermata vuota');
    return Buffer.from(r.data, 'base64');
  }

  // Valuta un'espressione nella pagina (per i test e per controllare l'impaginazione).
  async function valuta(espressione) {
    const r = await comando('Runtime.evaluate', { expression: espressione, returnByValue: true, awaitPromise: true });
    return r && r.result ? r.result.value : undefined;
  }

  const chiudiTutto = () => {
    try { ws.close(); } catch { /* niente */ }
    return chiudi();
  };

  return { cattura, valuta, chiudi: chiudiTutto, processo: figlio };
}
