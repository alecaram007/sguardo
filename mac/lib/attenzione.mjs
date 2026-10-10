// SGUARDO - la logica del lettore, separata dalla pagina per poterla testare:
// come si distribuisce l'attenzione tra le righe visibili, quando si registra,
// i colori del margine, il passo dell'autotest e la ricerca nel testo.
// Modulo condiviso (Node e browser): lo usa web/lettore.js e lo provano i test.

export const TICK_SECONDI = 0.25;      // ogni 250 ms
export const SALVA_OGNI = 10;          // salvataggio ogni 10 s (e alla chiusura)
export const CONTROLLA_FILE_OGNI = 2;  // il file è cambiato su disco?
export const SIGMA = 3.5;              // larghezza della campana, in righe
export const PERIFERICA = 0.06;        // visione periferica
export const DT_MASSIMO = 1.0;         // un tick non vale mai più di 1 s

// 0,06 + e^(−d²/2σ²)
export function vicinanza(d, sigma = SIGMA) {
  return PERIFERICA + Math.exp(-(d * d) / (2 * sigma * sigma));
}

// peso = soglia della riga × (0,06 + e^(−d²/2σ²))
export function peso(soglia, d, sigma = SIGMA) {
  return soglia * vicinanza(d, sigma);
}

// Dove sta il fuoco (in righe, 0 = prima riga del file) e quanto è larga la campana.
// rigaPuntatore: la posizione verticale del puntatore espressa in righe dall'inizio
// del file (primaRiga + (y − bordo − margine) / altezzaRiga), oppure null.
// Se il puntatore è fuori dal testo il fuoco va al 40% dell'area visibile e la
// campana si allarga: σ = max(4; righe visibili / 2,5).
export function fuocoESigma({ puntatoreDentro, rigaPuntatore, primaRiga, righeVisibili }) {
  if (puntatoreDentro && Number.isFinite(rigaPuntatore)) {
    return { fuoco: rigaPuntatore - 0.5, sigma: SIGMA };
  }
  return { fuoco: primaRiga + righeVisibili * 0.4, sigma: Math.max(4.0, righeVisibili / 2.5) };
}

// Distribuisce dt secondi tra le righe visibili non vuote [inizio, fine).
// soglie[i] è la soglia della riga i, oppure null se la riga è vuota.
// Restituisce un array (lungo fine − inizio) con la quota di ogni riga; la somma è dt.
export function distribuisci({ soglie, inizio, fine, fuoco, sigma, dt }) {
  fine = Math.min(fine, soglie.length);
  inizio = Math.max(0, inizio);
  if (fine <= inizio || !(dt > 0)) return [];
  const pesi = new Array(fine - inizio).fill(0);
  let somma = 0;
  for (let i = inizio; i < fine; i++) {
    const s = soglie[i];
    if (s === null || s === undefined) continue;
    const p = peso(s, i - fuoco, sigma);
    pesi[i - inizio] = p;
    somma += p;
  }
  if (somma <= 0) return [];
  return pesi.map((p) => (dt * p) / somma);
}

export const Registrazione = Object.freeze({
  AVVIO: 'avvio', REGISTRO: 'registro', INATTIVO: 'inattivo', SENZA_FOCUS: 'senza-focus'
});

// Si registra solo se la pagina ha il focus e c'è stata attività negli ultimi N secondi.
export function statoRegistrazione({ focus, secondiDallUltimaAttivita, inattivita = 20, autotest = false }) {
  const conFocus = autotest || focus;
  if (!conFocus) return Registrazione.SENZA_FOCUS;
  if (!(secondiDallUltimaAttivita <= inattivita)) return Registrazione.INATTIVO;
  return Registrazione.REGISTRO;
}

export function descriviRegistrazione(stato, { autotest = false, inattivita = 20 } = {}) {
  switch (stato) {
    case Registrazione.REGISTRO:
      return autotest ? 'Autotest · attività simulata' : "Registro l'attenzione";
    case Registrazione.INATTIVO:
      return 'In pausa · nessuna attività da ' + Math.trunc(inattivita) + ' s';
    case Registrazione.SENZA_FOCUS:
      return 'In pausa · finestra non attiva';
    default:
      return 'In attesa';
  }
}

// --- colori del margine: grigio = mai letta, oliva = sfiorata, verde = letta -------
export const COLORE_MAI = [64, 69, 80];

function mescola(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((k) => Math.trunc(a[k] + (b[k] - a[k]) * t));
}

export function coloreAttenzione(secondi, soglia) {
  if (secondi <= 1e-6) return COLORE_MAI.slice();
  const r = secondi / soglia;
  if (r < 1) return mescola([84, 92, 86], [128, 150, 84], r);
  return mescola([46, 160, 67], [118, 228, 128], (r - 1) / 3);
}

export function rgb(c) {
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
}

// --- autotest: attività simulata, senza toccare il mouse vero ---------------------
// t: secondi dall'inizio; durata: secondi di autotest; n: righe del file.
export function passoAutotest(t, durata, n, righeVisibili) {
  if (n === 0) return { primaRiga: 0, fuoco: 0, colonna: 16 };
  const p = Math.min(1.0, t / (durata * 0.8));
  const fuoco = p * (n - 1);
  const massimo = Math.max(0, n - righeVisibili);
  const primaRiga = Math.max(0, Math.min(massimo, arrotondaPari(fuoco - righeVisibili * 0.55)));
  return { primaRiga, fuoco, colonna: 16 + 12 * Math.sin(t * 1.3) };
}

function arrotondaPari(v) {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// --- ricerca (novità rispetto alla versione Windows) -----------------------------
// Restituisce le occorrenze { riga (0-based), inizio, fine } in ordine di lettura.
export function cerca(testi, domanda, { maiuscole = false } = {}) {
  const r = [];
  if (!domanda) return r;
  const q = maiuscole ? domanda : domanda.toLowerCase();
  for (let i = 0; i < testi.length; i++) {
    const t = maiuscole ? testi[i] : testi[i].toLowerCase();
    if (t.length !== testi[i].length) continue; // minuscole che cambiano lunghezza: salto per sicurezza
    let da = 0;
    for (;;) {
      const k = t.indexOf(q, da);
      if (k < 0) break;
      r.push({ riga: i, inizio: k, fine: k + q.length });
      da = k + Math.max(1, q.length);
    }
  }
  return r;
}

// Divide i token di una riga sui confini delle occorrenze trovate, per evidenziarle.
// tokens: [{tipo, testo}]; occorrenze: [{inizio, fine, attiva}] sulla stessa riga.
export function spezzaToken(tokens, occorrenze) {
  if (!occorrenze || occorrenze.length === 0) return tokens.map((t) => ({ ...t, trovato: 0 }));
  const r = [];
  let pos = 0;
  for (const t of tokens) {
    const a = pos, b = pos + t.testo.length;
    const tagli = new Set([a, b]);
    for (const o of occorrenze) {
      if (o.inizio > a && o.inizio < b) tagli.add(o.inizio);
      if (o.fine > a && o.fine < b) tagli.add(o.fine);
    }
    const punti = [...tagli].sort((x, y) => x - y);
    for (let k = 0; k + 1 < punti.length; k++) {
      const x = punti[k], y = punti[k + 1];
      const o = occorrenze.find((oc) => oc.inizio <= x && oc.fine >= y);
      r.push({ tipo: t.tipo, testo: t.testo.slice(x - a, y - a), trovato: o ? (o.attiva ? 2 : 1) : 0 });
    }
    pos = b;
  }
  return r;
}
