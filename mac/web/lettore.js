// SGUARDO - il lettore: mostra il codice e registra quali righe hai davvero
// davanti agli occhi, e per quanto. Stessa logica della finestra WinForms:
// ogni 250 ms, se la pagina ha il focus ed è stata usata negli ultimi 20 s,
// 0,25 s si distribuiscono tra le righe visibili non vuote (vedi lib/attenzione.mjs).
import { secondi as Secondi, plurale } from '/lib/cultura.mjs';
import { espandiTab } from '/lib/impronte.mjs';
import { Evidenziatore, TipoToken } from '/lib/evidenziatore.mjs';
import {
  TICK_SECONDI, SALVA_OGNI, CONTROLLA_FILE_OGNI, DT_MASSIMO, Registrazione,
  fuocoESigma, distribuisci, statoRegistrazione, descriviRegistrazione,
  coloreAttenzione, rgb, passoAutotest, cerca, spezzaToken
} from '/lib/attenzione.mjs';

const $ = (id) => document.getElementById(id);
const codice = $('codice');
const contenitoreRighe = $('righe');
const mappa = $('mappa');
const finto = $('puntatore-finto');

const parametri = new URLSearchParams(location.search);
const rel = parametri.get('f') || '';
const autotest = Math.max(0, Math.min(600, Number(String(parametri.get('autotest') || '0').replace(',', '.')) || 0));
const rigaIniziale = Math.trunc(Number(parametri.get('riga')) || 0);
const sessione = Math.random().toString(36).slice(2) + Date.now().toString(36);

const stile = getComputedStyle(document.body);
const H = parseFloat(stile.getPropertyValue('--h')) || 22;
const PAD = parseFloat(stile.getPropertyValue('--pad')) || 8;

// --- stato -------------------------------------------------------------------
let dati = null;
let righe = [];
let soglie = [];
let testi = [];
let modalita = 'progetto';
const contate = new Set();
let stato = Registrazione.AVVIO;
let statoAnnunciato = null;
let attenzioneSessione = 0;
let attivaSessione = 0;
const inizio = performance.now() / 1000;
const adesso = () => performance.now() / 1000 - inizio;
let ultimaAttivita = -Infinity;
let ultimoTick = 0, ultimoSalvataggio = 0, ultimoControllo = 0;
const puntatore = { dentro: false, clientX: 0, clientY: 0, riga: null };
let chiuso = false, finito = false;
let avviso = null, avvisoFino = 0;
let catena = Promise.resolve();
let timer = null;
let larghezzaCarattere = 7.8;
let rigaFuoco = -1;
let ricerca = { aperta: false, occorrenze: [], attiva: -1, perRiga: new Map() };

function attivita() {
  if (autotest > 0) return;
  ultimaAttivita = adesso();
}

function avvisa(testo, durata) {
  avviso = testo;
  avvisoFino = adesso() + durata;
}

// --- caricamento ----------------------------------------------------------------
// Senza server fetch dice «Failed to fetch» (o «Load failed» in Safari): i messaggi restano in italiano.
const nonRisponde = () => { throw new Error('il server di Sguardo non risponde'); };
const leggiJson = (r) => r.json().catch(() => { throw new Error('risposta non valida (errore ' + r.status + ')'); });

async function caricaDati() {
  const r = await fetch('/api/file?f=' + encodeURIComponent(rel), { cache: 'no-store' }).catch(nonRisponde);
  const d = await leggiJson(r);
  if (!r.ok) throw new Error(d.errore || 'errore ' + r.status);
  return d;
}

function prepara(d) {
  dati = d;
  const ev = new Evidenziatore(d.estensione);
  righe = d.righe.map((r, i) => {
    const espanso = espandiTab(r.testo);
    return { ...r, i, espanso, token: ev.riga(espanso), delta: 0, el: null, m: null, p: null, codice: null, ultimo: '' };
  });
  soglie = righe.map((r) => (r.impronta ? r.soglia : null));
  testi = righe.map((r) => r.espanso);
  document.title = 'Sguardo · ' + d.relativo;
  $('nome-file').textContent = d.relativo;
  $('nome-file').title = d.relativo;
  $('badge-ia').hidden = !d.ia;
  if (d.ia) $('badge-ia').title = "Dichiarato scritto dall'IA alla riga " + d.rigaIA;
  disegnaRighe();
}

function contenutoRiga(r) {
  const frammento = document.createDocumentFragment();
  const occ = ricerca.perRiga.get(r.i);
  const pezzi = occ ? spezzaToken(r.token, occ) : r.token;
  for (const t of pezzi) {
    const classe = t.tipo === TipoToken.CHIAVE ? 'k' : t.tipo === TipoToken.STRINGA ? 's' : t.tipo === TipoToken.COMMENTO ? 'c' : t.tipo === TipoToken.NUMERO ? 'd' : null;
    let nodo = document.createTextNode(t.testo);
    if (classe) { const s = document.createElement('span'); s.className = classe; s.append(nodo); nodo = s; }
    if (t.trovato) { const m = document.createElement('mark'); if (t.trovato === 2) m.className = 'attiva'; m.append(nodo); nodo = m; }
    frammento.append(nodo);
  }
  return frammento;
}

function disegnaRighe() {
  const f = document.createDocumentFragment();
  for (const r of righe) {
    const div = document.createElement('div');
    div.className = 'r';
    div.id = 'r' + (r.i + 1);
    const g = document.createElement('span');
    g.className = 'g';
    const m = document.createElement('i'); m.className = 'm';
    const p = document.createElement('i'); p.className = 'p';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(r.i + 1);
    g.append(m, p, n);
    const c = document.createElement('code');
    c.append(contenutoRiga(r));
    div.append(g, c);
    r.el = div; r.m = m; r.p = p; r.codice = c;
    aggiornaRiga(r);
    f.append(div);
  }
  contenitoreRighe.replaceChildren(f);
  if (righe.length === 0) {
    const v = document.createElement('p');
    v.className = 'vuoto-file';
    v.textContent = 'Il file è vuoto.';
    contenitoreRighe.append(v);
  }
  rigaFuoco = -1;
}

function statoRiga(r) {
  if (!r.impronta) return 'vuota';
  const s = r.secondi + r.delta;
  if (s >= r.soglia - 1e-6) return 'letta';
  if (s > 1e-6) return 'sfiorata';
  return 'mai';
}

function aggiornaRiga(r) {
  const st = statoRiga(r);
  const colore = r.impronta ? rgb(coloreAttenzione(r.secondi + r.delta, r.soglia)) : 'transparent';
  const critNl = r.critica && st !== 'letta';
  const chiave = colore + st + critNl;
  if (chiave === r.ultimo) return;
  r.ultimo = chiave;
  r.m.style.background = colore;
  r.el.classList.toggle('letta', st === 'letta');
  r.el.classList.toggle('crit-nl', critNl);
  r.p.className = 'p' + (r.critica ? ' crit' + (critNl ? ' nl' : '') : '');
}

// --- misure -----------------------------------------------------------------------
function righeVisibili() {
  return Math.max(1, Math.floor((codice.clientHeight - PAD) / H));
}
// Quando l'ultima riga è tutta visibile, le ultime righeVisibili() righe sono tutte visibili:
// senza questo, con certe altezze l'arrotondamento sceglieva la riga in alto mezza nascosta
// e lasciava fuori l'ultima riga del file, che non riceveva mai attenzione.
function primaRiga() {
  if ((codice.scrollTop + codice.clientHeight - PAD) / H >= righe.length) return Math.max(0, righe.length - righeVisibili());
  return Math.max(0, Math.round((codice.scrollTop - PAD) / H));
}
function misuraCarattere() {
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit';
  s.textContent = '0'.repeat(100);
  codice.append(s);
  larghezzaCarattere = s.getBoundingClientRect().width / 100 || 7.8;
  s.remove();
}
function rigaDelPuntatore() {
  if (autotest > 0) return puntatore.riga;
  const rect = codice.getBoundingClientRect();
  return (puntatore.clientY - rect.top + codice.scrollTop - PAD) / H;
}

// --- attenzione ---------------------------------------------------------------------
function distribuisciOra(dt) {
  const da = primaRiga();
  const vis = righeVisibili();
  const a = Math.min(righe.length, da + vis);
  if (a <= da) return;
  const { fuoco, sigma } = fuocoESigma({ puntatoreDentro: puntatore.dentro, rigaPuntatore: rigaDelPuntatore(), primaRiga: da, righeVisibili: vis });
  const quote = distribuisci({ soglie, inizio: da, fine: a, fuoco, sigma, dt });
  quote.forEach((q, k) => {
    if (q <= 0) return;
    righe[da + k].delta += q;
    attenzioneSessione += q;
  });
  attivaSessione += dt;
}

function tick() {
  if (chiuso || !dati) return;
  const ora = adesso();
  const dt = Math.min(DT_MASSIMO, ora - ultimoTick);
  ultimoTick = ora;
  if (autotest > 0) passoAuto(ora);
  const focus = document.hasFocus() && document.visibilityState === 'visible';
  stato = statoRegistrazione({ focus, secondiDallUltimaAttivita: ora - ultimaAttivita, inattivita: dati.inattivita, autotest: autotest > 0 });
  if (stato === Registrazione.REGISTRO && dt > 0) distribuisciOra(dt);
  if (ora - ultimoSalvataggio >= SALVA_OGNI) { salva(); ultimoSalvataggio = ora; }
  if (autotest === 0 && ora - ultimoControllo >= CONTROLLA_FILE_OGNI) { controllaFile(); ultimoControllo = ora; }
  aggiornaVista();
  if (autotest > 0 && ora >= autotest && !finito) fineAutotest();
}

// --- salvataggio: il server rilegge il JSON dal disco, somma e scrive ------------------
function pacchetto(fine) {
  const voci = {};
  const nuove = [];
  const inviati = [];
  for (const r of righe) {
    if (!r.impronta || !(r.delta > 0)) continue;
    voci[r.impronta] = (voci[r.impronta] || 0) + r.delta;
    inviati.push([r, r.delta]);
    if (!contate.has(r.impronta)) nuove.push(r.impronta);
  }
  return { corpo: { f: rel, sessione, simulata: autotest > 0, righe: voci, nuove, fine }, inviati };
}

function salva({ fine = false } = {}) {
  catena = catena.then(async () => {
    const { corpo, inviati } = pacchetto(fine);
    if (inviati.length === 0 && !fine) return;
    // Tolgo subito quello che parte: se intanto arriva la chiusura della scheda
    // (visibilitychange e poi pagehide), sendBeacon non deve rimandarlo una seconda volta.
    for (const [riga, q] of inviati) riga.delta = Math.max(0, riga.delta - q);
    const nuoveQui = corpo.nuove.filter((imp) => !contate.has(imp));
    for (const imp of nuoveQui) contate.add(imp);
    try {
      const r = await fetch('/api/salva', {
        method: 'POST', body: JSON.stringify(corpo), keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
      }).catch(nonRisponde);
      const d = await leggiJson(r);
      if (!r.ok) throw new Error(d.errore || 'errore ' + r.status);
      for (const riga of righe) {
        const v = riga.impronta ? d.righe[riga.impronta] : null;
        if (v) { riga.secondi = v.secondi; riga.simulati = v.simulati; riga.sessioni = v.sessioni; riga.ultima = v.ultima; }
      }
    } catch (e) {
      // Non salvato: l'attenzione torna da inviare al prossimo giro.
      for (const [riga, q] of inviati) riga.delta += q;
      for (const imp of nuoveQui) contate.delete(imp);
      avvisa('Salvataggio non riuscito: ' + e.message, 10);
    }
  });
  return catena;
}

// Alla chiusura della scheda: sendBeacon arriva anche mentre la pagina se ne va.
function salvaAllaChiusura() {
  if (chiuso || !dati) return;
  const { corpo, inviati } = pacchetto(true);
  const ok = navigator.sendBeacon('/api/salva', new Blob([JSON.stringify(corpo)], { type: 'text/plain;charset=UTF-8' }));
  if (ok) {
    for (const [riga, q] of inviati) riga.delta = Math.max(0, riga.delta - q);
    for (const imp of corpo.nuove) contate.add(imp);
  }
}

async function controllaFile() {
  try {
    const r = await fetch('/api/file/stato?f=' + encodeURIComponent(rel), { cache: 'no-store' });
    if (!r.ok) return;
    const { firma } = await r.json();
    if (!dati || firma === dati.firma || chiuso) return;
    await salva();
    const sopra = codice.scrollTop, lato = codice.scrollLeft;
    // Come nella versione Windows, «contate» resta: una riga rimasta uguale è già
    // stata contata in questa sessione e non deve ricevere una seconda sessione.
    prepara(await caricaDati());
    codice.scrollTop = sopra;
    codice.scrollLeft = lato;
    if (ricerca.aperta) eseguiRicerca(false);
    avvisa('Il file è cambiato su disco: ricaricato. Le righe modificate tornano «mai lette».', 8);
  } catch { /* riprovo al prossimo giro */ }
}

// --- vista -----------------------------------------------------------------------------
function aggiornaVista() {
  const reg = $('registrazione');
  const attiva = stato === Registrazione.REGISTRO;
  reg.classList.toggle('attiva', attiva && autotest === 0);
  reg.classList.toggle('autotest', attiva && autotest > 0);
  const testo = descriviRegistrazione(stato, { autotest: autotest > 0, inattivita: dati.inattivita });
  $('reg-testo').textContent = testo;
  $('reg-tempo').textContent = Secondi(attivaSessione) + ' in questa sessione';
  if (testo !== statoAnnunciato) { statoAnnunciato = testo; $('reg-annuncio').textContent = testo; }

  const da = primaRiga();
  const a = Math.min(righe.length, da + righeVisibili() + 1);
  for (let i = da; i < a; i++) aggiornaRiga(righe[i]);

  const nuovaFuoco = puntatore.dentro ? Math.floor(rigaDelPuntatore()) : -1;
  if (nuovaFuoco !== rigaFuoco) {
    if (righe[rigaFuoco]) righe[rigaFuoco].el.classList.remove('fuoco');
    if (righe[nuovaFuoco]) righe[nuovaFuoco].el.classList.add('fuoco');
    rigaFuoco = nuovaFuoco;
  }
  aggiornaStato(da);
  disegnaMappa();
}

function span(classe, testo) {
  const s = document.createElement(classe === 'strong' ? 'strong' : 'span');
  if (classe !== 'strong') s.className = classe;
  s.textContent = testo;
  return s;
}

function aggiornaStato(da) {
  let significative = 0, lette = 0, critiche = 0, simulate = 0;
  for (const r of righe) {
    if (!r.impronta) continue;
    significative++;
    const letta = statoRiga(r) === 'letta';
    if (letta) lette++;
    if (r.critica && !letta) critiche++;
    if (r.simulati > 0 || (autotest > 0 && r.delta > 0)) simulate++;
  }
  const perc = significative === 0 ? 100 : Math.floor((100 * lette) / significative + 1e-9);
  const sx = $('stato-sx');
  if (avviso && adesso() < avvisoFino) {
    sx.replaceChildren(span('avviso', avviso));
  } else {
    const parti = [document.createTextNode('Lette da un umano: '), span('strong', perc + '% delle righe'), document.createTextNode('  ·  ')];
    if (critiche > 0) parti.push(span('rosso', critiche === 1 ? '1 riga critica non letta' : critiche + ' righe critiche non lette'));
    else parti.push(span('verde', 'nessuna riga critica da leggere'));
    if (simulate > 0) parti.push(document.createTextNode('  ·  '), span('ambra', plurale(simulate, 'riga', 'righe') + ' con attenzione simulata'));
    const chiave = perc + '|' + critiche + '|' + simulate;
    if (sx.dataset.chiave !== chiave) { sx.replaceChildren(...parti); sx.dataset.chiave = chiave; }
    if (avviso) { avviso = null; sx.dataset.chiave = ''; }
  }
  const n = righe.length;
  $('stato-dx').textContent = n === 0 ? '' : 'righe ' + (da + 1) + '–' + Math.min(n, da + righeVisibili()) + ' di ' + n + '   ·   Esc chiude';
}

// --- mappa del file (fa anche da barra di scorrimento) ---------------------------------
function disegnaMappa() {
  const dpr = window.devicePixelRatio || 1;
  const w = mappa.clientWidth, h = mappa.clientHeight;
  if (w === 0 || h === 0) return;
  if (mappa.width !== Math.round(w * dpr) || mappa.height !== Math.round(h * dpr)) {
    mappa.width = Math.round(w * dpr);
    mappa.height = Math.round(h * dpr);
  }
  const g = mappa.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const n = righe.length;
  if (n === 0) return;
  const top = 4, alt = h - 8, per = alt / n;
  const hh = Math.max(1.5, per);
  for (let i = 0; i < n; i++) {
    const r = righe[i];
    if (!r.impronta) continue;
    g.fillStyle = rgb(coloreAttenzione(r.secondi + r.delta, r.soglia));
    g.fillRect(4, top + i * per, w - 8, hh - (per > 3 ? 1 : 0));
  }
  const rosso = getComputedStyle(document.body).getPropertyValue('--rosso').trim() || '#f06268';
  g.fillStyle = rosso;
  for (let i = 0; i < n; i++) {
    const r = righe[i];
    if (r.critica && statoRiga(r) !== 'letta') g.fillRect(1, top + i * per, w - 2, Math.max(hh, 2));
  }
  if (n > righeVisibili()) {
    const vero = righeVisibili() * per;
    const th = Math.max(24, vero);
    let ty = top + primaRiga() * per - (th - vero) / 2;
    ty = Math.max(top, Math.min(ty, top + alt - th));
    const scuro = matchMedia('(prefers-color-scheme: dark)').matches;
    g.fillStyle = scuro ? 'rgba(255,255,255,.17)' : 'rgba(20,25,30,.13)';
    g.strokeStyle = scuro ? 'rgba(255,255,255,.4)' : 'rgba(20,25,30,.35)';
    g.beginPath();
    if (g.roundRect) g.roundRect(1.5, ty, w - 3, th, 3); else g.rect(1.5, ty, w - 3, th);
    g.fill();
    g.stroke();
  }
  const critiche = righe.filter((r) => r.critica && statoRiga(r) !== 'letta').length;
  mappa.setAttribute('aria-label', 'Mappa del file: ' + n + ' righe' + (critiche ? ', ' + plurale(critiche, 'riga critica non letta', 'righe critiche non lette') + ' segnate in rosso' : ''));
}

let trascinaMappa = false;
function scorriDaMappa(clientY) {
  const rect = mappa.getBoundingClientRect();
  const per = (rect.height - 8) / Math.max(1, righe.length);
  const riga = (clientY - rect.top - 4) / per - righeVisibili() / 2;
  codice.scrollTop = Math.max(0, Math.round(riga)) * H;
  aggiornaVista();
}
mappa.addEventListener('pointerdown', (e) => {
  if (autotest > 0) return;
  attivita();
  trascinaMappa = true;
  mappa.setPointerCapture(e.pointerId);
  scorriDaMappa(e.clientY);
});
mappa.addEventListener('pointermove', (e) => { if (trascinaMappa) { attivita(); scorriDaMappa(e.clientY); } });
mappa.addEventListener('pointerup', () => { trascinaMappa = false; });
mappa.addEventListener('pointercancel', () => { trascinaMappa = false; });

// --- autotest: attività simulata, senza toccare il mouse vero ---------------------------
function passoAuto(t) {
  ultimaAttivita = t;
  const p = passoAutotest(t, autotest, righe.length, righeVisibili());
  codice.scrollTop = p.primaRiga * H;
  puntatore.dentro = righe.length > 0;
  puntatore.riga = p.fuoco + 0.5;
  finto.hidden = !puntatore.dentro;
  const margine = parseFloat(getComputedStyle(document.body).getPropertyValue('--margine')) || 92;
  finto.style.left = Math.round(margine + 14 + larghezzaCarattere * p.colonna) + 'px';
  finto.style.top = Math.round(PAD + (p.fuoco + 0.5) * H) + 'px';
}

async function fineAutotest() {
  finito = true;
  clearInterval(timer);
  await salva({ fine: true });
  chiuso = true;
  document.documentElement.dataset.finito = '1';
  // In un browser vero (senza schermata) lascio un messaggio; la schermata è già stata fatta.
  setTimeout(() => {
    $('chiuso-titolo').textContent = 'Autotest finito';
    $('chiuso').hidden = false;
    try { window.close(); } catch { /* niente */ }
  }, 4000);
}

// --- chiusura -----------------------------------------------------------------------
async function termina() {
  if (chiuso) return;
  chiuso = true;
  clearInterval(timer);
  await salva({ fine: true });
  if (modalita === 'leggi') {
    $('chiuso').hidden = false;
    try { window.close(); } catch { /* le schede aperte dall'utente non si chiudono da script */ }
  } else {
    location.href = '/';
  }
}

// --- ricerca (novità rispetto alla versione Windows) ----------------------------------
const campo = $('cerca-testo');

function apriCerca() {
  ricerca.aperta = true;
  $('cerca').hidden = false;
  $('apri-cerca').setAttribute('aria-expanded', 'true');
  campo.focus();
  campo.select();
  if (campo.value) eseguiRicerca(false);
}

function chiudiCerca() {
  ricerca.aperta = false;
  $('cerca').hidden = true;
  $('apri-cerca').setAttribute('aria-expanded', 'false');
  const toccate = [...ricerca.perRiga.keys()];
  ricerca = { aperta: false, occorrenze: [], attiva: -1, perRiga: new Map() };
  for (const i of toccate) if (righe[i]) righe[i].codice.replaceChildren(contenutoRiga(righe[i]));
  codice.focus({ preventScroll: true });
}

function ridisegnaOccorrenze(prima) {
  const perRiga = new Map();
  ricerca.occorrenze.forEach((o, k) => {
    if (!perRiga.has(o.riga)) perRiga.set(o.riga, []);
    perRiga.get(o.riga).push({ inizio: o.inizio, fine: o.fine, attiva: k === ricerca.attiva });
  });
  ricerca.perRiga = perRiga;
  const daRifare = new Set([...prima, ...perRiga.keys()]);
  for (const i of daRifare) if (righe[i]) righe[i].codice.replaceChildren(contenutoRiga(righe[i]));
}

function aggiornaConto() {
  const n = ricerca.occorrenze.length;
  $('cerca-conto').textContent = !campo.value ? '' : n === 0 ? 'nessun risultato' : (ricerca.attiva + 1) + ' di ' + n;
}

function eseguiRicerca(scorri = true) {
  const prima = [...ricerca.perRiga.keys()];
  ricerca.occorrenze = cerca(testi, campo.value, { maiuscole: $('cerca-maiuscole').checked });
  const da = primaRiga();
  const k = ricerca.occorrenze.findIndex((o) => o.riga >= da);
  ricerca.attiva = ricerca.occorrenze.length === 0 ? -1 : k < 0 ? 0 : k;
  ridisegnaOccorrenze(prima);
  aggiornaConto();
  if (scorri && ricerca.attiva >= 0) mostraOccorrenza();
}

function mostraOccorrenza() {
  const o = ricerca.occorrenze[ricerca.attiva];
  if (!o) return;
  const vis = righeVisibili();
  const da = primaRiga();
  if (o.riga < da || o.riga >= da + vis) codice.scrollTop = Math.max(0, Math.round(o.riga - vis * 0.4)) * H;
  const mark = righe[o.riga].codice.querySelector('mark.attiva');
  if (mark) {
    const margine = parseFloat(getComputedStyle(document.body).getPropertyValue('--margine')) || 92;
    const x = mark.offsetLeft;
    const visibile = codice.clientWidth - margine;
    if (x < codice.scrollLeft + margine || x + mark.offsetWidth > codice.scrollLeft + codice.clientWidth) {
      codice.scrollLeft = Math.max(0, x - margine - visibile / 3);
    }
  }
  aggiornaVista();
}

function vai(passo) {
  const n = ricerca.occorrenze.length;
  if (n === 0) return;
  const prima = [...ricerca.perRiga.keys()];
  ricerca.attiva = (ricerca.attiva + passo + n) % n;
  ridisegnaOccorrenze(prima);
  aggiornaConto();
  mostraOccorrenza();
}

campo.addEventListener('input', () => eseguiRicerca(true));
$('cerca-maiuscole').addEventListener('change', () => eseguiRicerca(true));
campo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); vai(e.shiftKey ? -1 : 1); }
});
$('cerca-succ').addEventListener('click', () => vai(1));
$('cerca-prec').addEventListener('click', () => vai(-1));
$('cerca-chiudi').addEventListener('click', chiudiCerca);
$('apri-cerca').addEventListener('click', () => (ricerca.aperta ? chiudiCerca() : apriCerca()));

// --- input: attività, tastiera, puntatore -----------------------------------------------
function inCampo(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

document.addEventListener('keydown', (e) => {
  if (autotest > 0) { if (e.key === 'Escape') termina(); return; }
  attivita();
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); apriCerca(); return; }
  if (e.key === 'F3') { e.preventDefault(); if (!ricerca.aperta) apriCerca(); else vai(e.shiftKey ? -1 : 1); return; }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (ricerca.aperta) chiudiCerca(); else termina();
    return;
  }
  if (inCampo(e) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.key === '/') { e.preventDefault(); apriCerca(); return; }
  const vis = righeVisibili();
  const passi = {
    ArrowDown: 1, ArrowUp: -1, PageDown: Math.max(1, vis - 2), PageUp: -Math.max(1, vis - 2),
    ' ': e.shiftKey ? -Math.max(1, vis - 2) : Math.max(1, vis - 2)
  };
  if (e.key in passi) {
    e.preventDefault();
    codice.scrollTop = Math.max(0, primaRiga() + passi[e.key]) * H;
  } else if (e.key === 'Home') {
    e.preventDefault(); codice.scrollTop = 0;
  } else if (e.key === 'End') {
    e.preventDefault(); codice.scrollTop = codice.scrollHeight;
  } else return;
  aggiornaVista();
});

codice.addEventListener('pointermove', (e) => {
  if (autotest > 0) return;
  if (e.clientX !== puntatore.clientX || e.clientY !== puntatore.clientY) attivita();
  puntatore.clientX = e.clientX;
  puntatore.clientY = e.clientY;
  puntatore.dentro = true;
});
codice.addEventListener('pointerdown', (e) => {
  if (autotest > 0) return;
  attivita();
  puntatore.clientX = e.clientX;
  puntatore.clientY = e.clientY;
  puntatore.dentro = true;
});
codice.addEventListener('pointerleave', () => { if (autotest === 0) puntatore.dentro = false; });
// Con il dito, quando lo alzi il fuoco torna al 40% dell'area visibile.
codice.addEventListener('pointerup', (e) => { if (autotest === 0 && e.pointerType === 'touch') puntatore.dentro = false; });
codice.addEventListener('pointercancel', () => { if (autotest === 0) puntatore.dentro = false; });
for (const tipo of ['wheel', 'touchstart', 'touchmove']) {
  window.addEventListener(tipo, attivita, { passive: true });
}
codice.addEventListener('scroll', () => { if (dati && !chiuso) aggiornaVista(); }, { passive: true });
window.addEventListener('resize', () => { if (dati) aggiornaVista(); });

$('fine').addEventListener('click', termina);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salva(); });
window.addEventListener('pagehide', salvaAllaChiusura);

// --- avvio ----------------------------------------------------------------------------
async function avvia() {
  try {
    const info = await fetch('/api/info', { cache: 'no-store' }).then((r) => r.json());
    modalita = info.modalita;
  } catch { /* resta "progetto" */ }
  if (modalita === 'leggi') {
    $('marchio').removeAttribute('href');
    $('fine').title = 'Salva e chiudi la sessione (Esc)';
  } else {
    $('fine').title = "Salva e torna all'elenco dei file (Esc)";
  }
  if (!rel) { mostraErrore('Nessun file indicato.'); return; }
  try {
    prepara(await caricaDati());
  } catch (e) {
    mostraErrore('Non riesco ad aprire il file: ' + e.message);
    return;
  }
  misuraCarattere();
  if (rigaIniziale > 0 && rigaIniziale <= righe.length) {
    codice.scrollTop = Math.max(0, Math.round(rigaIniziale - 1 - righeVisibili() * 0.4)) * H;
    const r = righe[rigaIniziale - 1];
    r.el.classList.add('salto');
    setTimeout(() => r.el.classList.remove('salto'), 1800);
  }
  codice.focus({ preventScroll: true });
  if (autotest === 0 && document.hasFocus()) attivita();
  ultimoTick = adesso();
  aggiornaVista();
  timer = setInterval(tick, TICK_SECONDI * 1000);
}

function mostraErrore(testo) {
  const p = document.createElement('p');
  p.className = 'vuoto-file';
  p.setAttribute('role', 'alert');
  p.textContent = testo;
  contenitoreRighe.replaceChildren(p);
  $('stato-sx').textContent = '';
}

avvia();
