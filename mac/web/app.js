// SGUARDO - pagina del progetto: esito della verifica, statistiche, file con
// l'impronta dell'attenzione, righe critiche non lette. Tutto in italiano, nessuna dipendenza.
import { plurale } from '/lib/cultura.mjs';

const $ = (id) => document.getElementById(id);
const PREF = 'sguardo.soloLetture';

function el(tag, attributi = {}, ...figli) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'testo') e.textContent = v;
    else if (k === 'style') e.setAttribute('style', v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of figli) if (f !== null && f !== undefined) e.append(f);
  return e;
}

function leggiPreferenza() {
  try { return localStorage.getItem(PREF) === '1'; } catch { return false; }
}
function salvaPreferenza(v) {
  try { localStorage.setItem(PREF, v ? '1' : '0'); } catch { /* niente */ }
}

const soloLetture = $('solo-letture');
soloLetture.checked = leggiPreferenza();
let ultimo = null;

function urlLettore(f, riga) {
  return '/lettore.html?f=' + encodeURIComponent(f) + (riga ? '&riga=' + riga : '');
}

function esito(d) {
  const box = $('esito');
  box.replaceChildren();
  const v = d.verifica;
  let classe, forte, resto = '';
  if (v.critiche === 0) {
    classe = 'si'; forte = 'Nessuna riga critica in questi file.'; resto = ' La verifica non ha nulla da controllare.';
  } else if (v.criticheNonLette > 0) {
    classe = 'no';
    forte = 'La verifica non passa: ' + (v.criticheNonLette === 1 ? '1 riga critica non è stata letta' : v.criticheNonLette + ' righe critiche non sono state lette') + ' da un umano.';
    resto = " Qualcuno le ha scritte (forse un'IA), ma nessuno le ha ancora guardate con attenzione. Aprile qui sotto per leggerle.";
  } else {
    classe = 'si'; forte = 'La verifica passa: ' + (v.critiche === 1 ? "l'unica riga critica è stata letta" : 'tutte le ' + v.critiche + ' righe critiche sono state lette') + ' da un umano.';
  }
  box.append(el('div', { class: 'esito ' + classe, role: 'status' }, el('span', { class: 'punto', 'aria-hidden': 'true' }),
    el('div', {}, el('strong', { testo: forte }), resto)));
  if (d.totali.simulati > 0.001 && !d.soloLetture) {
    box.append(el('p', { class: 'nota', testo: 'Nota: il ' + d.totali.quotaSimulata + " dell'attenzione registrata è simulata (sguardo simula o autotest), non letta da una persona. In CI usa --solo-letture." }));
  }
}

function schede(d) {
  const t = d.totali;
  const s = $('schede');
  s.replaceChildren(
    el('div', { class: 'scheda' }, el('b', { testo: t.percento }), el('span', { testo: 'delle righe lette da un umano' }),
      el('div', { class: 'metro', role: 'presentation' }, el('i', { style: 'width:' + (Math.floor(t.frazione * 1000) / 10) + '%' })),
      el('span', { testo: t.lette + ' su ' + t.significative + ' righe non vuote' })),
    el('div', { class: 'scheda' }, el('b', { testo: String(t.mai) }), el('span', { testo: t.mai === 1 ? 'riga mai letta' : 'righe mai lette' }), el('br'),
      el('span', { testo: plurale(t.sfiorate, 'altra solo sfiorata', 'altre solo sfiorate') })),
    el('div', { class: 'scheda ' + (d.verifica.criticheNonLette > 0 ? 'rossa' : 'verde') }, el('b', { testo: String(d.verifica.criticheNonLette) }),
      el('span', { testo: d.verifica.criticheNonLette === 1 ? 'riga critica non letta' : 'righe critiche non lette' }), el('br'),
      el('span', { testo: 'su ' + plurale(d.verifica.critiche, 'riga critica', 'righe critiche') })),
    el('div', { class: 'scheda' }, el('b', { testo: String(t.file) }), el('span', { testo: 'file sorgente' }), el('br'),
      el('span', { testo: t.ia === 0 ? "nessuno dichiarato scritto dall'IA" : t.ia === 1 ? "1 dichiarato scritto dall'IA" : t.ia + " dichiarati scritti dall'IA" })),
    el('div', { class: 'scheda' }, el('b', { testo: t.attenzione }), el('span', { testo: 'di attenzione registrata' }), el('br'),
      el('span', { testo: t.simulati > 0.001 ? 'di cui simulata: ' + t.quotaSimulata : 'tutta da letture vere' }))
  );
}

function elencoFile(d) {
  const ul = $('file');
  ul.replaceChildren();
  if (d.file.length === 0) {
    ul.append(el('li', { class: 'vuoto', testo: 'Nessun file sorgente qui (estensioni in .sguardo/regole.json).' }));
    return;
  }
  ul.append(el('li', { class: 'intestazione', 'aria-hidden': 'true' },
    el('span', { testo: 'File' }), el('span', { class: 'num', testo: 'Righe' }), el('span', { class: 'num', testo: 'Lette' }),
    el('span', { testo: "Impronta dell'attenzione" }), el('span', { testo: 'Non lette' }), el('span', { class: 'num', testo: 'Critiche' })));
  for (const f of d.file) {
    const striscia = el('div', { class: 'impronta', 'aria-hidden': 'true' });
    // I colori sono quelli del rapporto HTML, dove --verde è la terna RGB: qui si chiama --verde-rgb.
    for (const c of f.striscia) striscia.append(el('span', { style: 'background:' + c.replaceAll('var(--verde)', 'var(--verde-rgb)') }));
    const descrizione = f.relativo + ': ' + f.percento + ' delle righe lette' +
      (f.criticheNonLette > 0 ? ', ' + plurale(f.criticheNonLette, 'riga critica non letta', 'righe critiche non lette') : '') +
      (f.ia ? ", dichiarato scritto dall'IA" : '');
    const a = el('a', { class: 'file' + (f.criticheNonLette > 0 ? ' critico' : ''), href: urlLettore(f.relativo), 'aria-label': descrizione },
      el('span', { class: 'nome' }, f.relativo, f.ia ? el('span', { class: 'badge ia', testo: 'IA' }) : null),
      el('span', { class: 'num righe' }, String(f.righe), el('span', { class: 'etichetta-mobile', testo: f.righe === 1 ? ' riga' : ' righe' })),
      el('span', { class: 'num lette' }, el('strong', { testo: f.percento }),
        el('span', { class: 'metro', role: 'presentation' }, el('i', { style: 'width:' + (Math.floor(f.frazione * 1000) / 10) + '%' }))),
      el('span', { class: 'imp' }, striscia),
      el('span', { class: 'nl' }, f.nonLette ? el('span', { class: 'etichetta-mobile', testo: 'non lette: ' }) : null, f.nonLette || (window.innerWidth > 860 ? '—' : '')),
      f.criticheNonLette > 0
        ? el('span', { class: 'num crit si' }, String(f.criticheNonLette),
          el('span', { class: 'etichetta-mobile', testo: f.criticheNonLette === 1 ? ' critica non letta' : ' critiche non lette' }))
        : el('span', { class: 'num crit no' }, el('span', { class: 'solo-largo', testo: '—' }),
          el('span', { class: 'etichetta-mobile', testo: 'nessuna critica da leggere' }))
    );
    ul.append(el('li', {}, a));
  }
}

function critiche(d) {
  const sez = $('sezione-critiche');
  const ol = $('critiche');
  ol.replaceChildren();
  sez.hidden = d.elencoCritiche.length === 0;
  for (const c of d.elencoCritiche) {
    ol.append(el('li', {}, el('a', { href: urlLettore(c.file, c.numero) },
      el('span', { class: 'dove', testo: c.file + ':' + c.numero }),
      el('span', { class: 'come' + (c.sfiorata ? ' sfiorata' : ''), testo: c.stato }),
      el('code', { testo: c.testo }))));
  }
}

async function carica() {
  const solo = soloLetture.checked;
  $('link-rapporto').href = '/rapporto.html' + (solo ? '?solo=1' : '');
  try {
    // Senza server fetch dice «Failed to fetch» (o «Load failed» in Safari): il messaggio resta in italiano.
    const r = await fetch('/api/progetto' + (solo ? '?solo=1' : ''), { cache: 'no-store' })
      .catch(() => { throw new Error('il server non risponde'); });
    const d = await r.json().catch(() => { throw new Error('risposta non valida (errore ' + r.status + ')'); });
    if (!r.ok) throw new Error(d.errore || 'Errore ' + r.status);
    $('errore').hidden = true;
    const firma = JSON.stringify(d);
    if (firma !== ultimo) {
      ultimo = firma;
      document.title = 'Sguardo · ' + d.nome;
      $('nome-progetto').textContent = d.nome;
      $('percorso').textContent = d.radice;
      $('piede-soglia').textContent = 'Una riga conta come letta quando l\'attenzione accumulata raggiunge ' + d.soglia +
        ' (caratteri non spazio). Righe critiche: ' + d.critiche + ' (da .sguardo/regole.json).';
      esito(d);
      schede(d);
      elencoFile(d);
      critiche(d);
    }
    const ora = new Date();
    $('aggiornato').textContent = 'aggiornato alle ' + String(ora.getHours()).padStart(2, '0') + ':' +
      String(ora.getMinutes()).padStart(2, '0') + ':' + String(ora.getSeconds()).padStart(2, '0');
  } catch (e) {
    const box = $('errore');
    box.hidden = false;
    box.textContent = 'Non riesco a leggere il progetto: ' + e.message + '. Il server di Sguardo è ancora acceso?';
  }
}

soloLetture.addEventListener('change', () => { salvaPreferenza(soloLetture.checked); ultimo = null; carica(); });
$('aggiorna').addEventListener('click', () => { ultimo = null; carica(); });
// Aggiorna da solo quando torni sulla pagina (per esempio dopo aver letto un file) e ogni 15 s.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carica(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) carica(); });
setInterval(() => { if (document.visibilityState === 'visible') carica(); }, 15000);
let larghezza = window.innerWidth;
window.addEventListener('resize', () => {
  if ((larghezza > 860) !== (window.innerWidth > 860) && ultimo) { ultimo = null; carica(); }
  larghezza = window.innerWidth;
});
carica();
