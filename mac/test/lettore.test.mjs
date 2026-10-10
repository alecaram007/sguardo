// La logica del lettore (lib/attenzione.mjs): pesi, fuoco, registrazione, colori,
// autotest, ricerca. È la stessa che usa web/lettore.js nel browser.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  vicinanza, peso, fuocoESigma, distribuisci, statoRegistrazione, descriviRegistrazione, Registrazione,
  coloreAttenzione, COLORE_MAI, passoAutotest, cerca, spezzaToken, SIGMA, PERIFERICA, TICK_SECONDI, SALVA_OGNI
} from '../lib/attenzione.mjs';

const vicino = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

describe('pesi: soglia × (0,06 + e^(−d²/2σ²))', () => {
  it('costanti come nell\'originale: 250 ms, salvataggio ogni 10 s, σ = 3,5, periferica 0,06', () => {
    assert.equal(TICK_SECONDI, 0.25);
    assert.equal(SALVA_OGNI, 10);
    assert.equal(SIGMA, 3.5);
    assert.equal(PERIFERICA, 0.06);
  });
  it('sul fuoco la vicinanza vale 1,06; lontano tende a 0,06', () => {
    assert.ok(vicino(vicinanza(0), 1.06));
    assert.ok(vicino(vicinanza(3.5), 0.06 + Math.exp(-0.5)));
    assert.ok(vicino(vicinanza(100), 0.06));
    assert.ok(vicino(peso(2, 0), 2.12));
  });
  it('distribuisce esattamente dt tra le righe visibili non vuote', () => {
    const soglie = [1, null, 2, 0.4, 2.6, null, 1.2];
    const q = distribuisci({ soglie, inizio: 0, fine: 7, fuoco: 3, sigma: SIGMA, dt: 0.25 });
    assert.equal(q.length, 7);
    assert.ok(vicino(q.reduce((s, x) => s + x, 0), 0.25));
    assert.equal(q[1], 0, 'righe vuote: niente attenzione');
    assert.equal(q[5], 0);
  });
  it('a parità di distanza, la quota è proporzionale alla soglia (le "}" brevi diventano lette insieme alle altre)', () => {
    const q = distribuisci({ soglie: [0.4, 2.0], inizio: 0, fine: 2, fuoco: 0.5, sigma: SIGMA, dt: 1 });
    assert.ok(vicino(q[1] / q[0], 5));
  });
  it('le righe vicine al puntatore ricevono più delle lontane', () => {
    const soglie = new Array(30).fill(1);
    const q = distribuisci({ soglie, inizio: 0, fine: 30, fuoco: 10, sigma: SIGMA, dt: 0.25 });
    assert.ok(q[10] > q[12] && q[12] > q[16] && q[16] > q[25]);
    assert.ok(vicino(q[25] / q[10], peso(1, 15) / peso(1, 0)));
  });
  it('solo le righe visibili [inizio, fine) e mai oltre la fine del file', () => {
    const q = distribuisci({ soglie: [1, 1, 1], inizio: 1, fine: 10, fuoco: 1, sigma: SIGMA, dt: 0.5 });
    assert.equal(q.length, 2);
    assert.ok(vicino(q[0] + q[1], 0.5));
    assert.deepEqual(distribuisci({ soglie: [null, null], inizio: 0, fine: 2, fuoco: 0, sigma: SIGMA, dt: 1 }), []);
    assert.deepEqual(distribuisci({ soglie: [1], inizio: 0, fine: 1, fuoco: 0, sigma: SIGMA, dt: 0 }), []);
  });
  it('visione periferica: restando a lungo su una schermata, anche le righe lontane diventano lette', () => {
    const soglie = new Array(30).fill(1.5);
    const accumulo = new Array(30).fill(0);
    for (let t = 0; t < 4 * 300; t++) {
      distribuisci({ soglie, inizio: 0, fine: 30, fuoco: 2, sigma: SIGMA, dt: 0.25 }).forEach((q, i) => { accumulo[i] += q; });
    }
    assert.ok(accumulo[29] >= 1.5, 'dopo 5 minuti la riga più lontana raggiunge la soglia: ' + accumulo[29]);
  });
});

describe('fuoco e larghezza della campana', () => {
  it('puntatore sul testo: fuoco alla riga sotto il puntatore, σ = 3,5', () => {
    assert.deepEqual(fuocoESigma({ puntatoreDentro: true, rigaPuntatore: 12.5, primaRiga: 10, righeVisibili: 25 }), { fuoco: 12, sigma: 3.5 });
  });
  it('puntatore fuori dal testo: fuoco al 40% dell\'area visibile, σ = max(4; righe visibili / 2,5)', () => {
    assert.deepEqual(fuocoESigma({ puntatoreDentro: false, rigaPuntatore: null, primaRiga: 10, righeVisibili: 25 }), { fuoco: 20, sigma: 10 });
    assert.deepEqual(fuocoESigma({ puntatoreDentro: false, rigaPuntatore: null, primaRiga: 0, righeVisibili: 5 }), { fuoco: 2, sigma: 4 });
    assert.equal(fuocoESigma({ puntatoreDentro: true, rigaPuntatore: NaN, primaRiga: 0, righeVisibili: 10 }).fuoco, 4);
  });
});

describe('quando si registra', () => {
  it('serve il focus e attività negli ultimi 20 s', () => {
    assert.equal(statoRegistrazione({ focus: true, secondiDallUltimaAttivita: 3, inattivita: 20 }), Registrazione.REGISTRO);
    assert.equal(statoRegistrazione({ focus: true, secondiDallUltimaAttivita: 20, inattivita: 20 }), Registrazione.REGISTRO);
    assert.equal(statoRegistrazione({ focus: true, secondiDallUltimaAttivita: 20.1, inattivita: 20 }), Registrazione.INATTIVO);
    assert.equal(statoRegistrazione({ focus: true, secondiDallUltimaAttivita: Infinity, inattivita: 20 }), Registrazione.INATTIVO);
    assert.equal(statoRegistrazione({ focus: false, secondiDallUltimaAttivita: 1, inattivita: 20 }), Registrazione.SENZA_FOCUS);
    assert.equal(statoRegistrazione({ focus: false, secondiDallUltimaAttivita: 1, inattivita: 20, autotest: true }), Registrazione.REGISTRO);
  });
  it('l\'indicatore dice il motivo della pausa', () => {
    assert.equal(descriviRegistrazione(Registrazione.REGISTRO), "Registro l'attenzione");
    assert.equal(descriviRegistrazione(Registrazione.REGISTRO, { autotest: true }), 'Autotest · attività simulata');
    assert.equal(descriviRegistrazione(Registrazione.INATTIVO, { inattivita: 20 }), 'In pausa · nessuna attività da 20 s');
    assert.equal(descriviRegistrazione(Registrazione.SENZA_FOCUS), 'In pausa · finestra non attiva');
    assert.equal(descriviRegistrazione(Registrazione.AVVIO), 'In attesa');
  });
});

describe('colori del margine: grigio → oliva → verde', () => {
  it('mai letta = grigio; sfiorata tra oliva scuro e oliva; letta sempre più verde', () => {
    assert.deepEqual(coloreAttenzione(0, 1), COLORE_MAI);
    assert.deepEqual(coloreAttenzione(0.0001, 1), [84, 92, 85]);
    assert.deepEqual(coloreAttenzione(0.5, 1), [106, 121, 85]);
    assert.deepEqual(coloreAttenzione(1, 1), [46, 160, 67]);
    assert.deepEqual(coloreAttenzione(4, 1), [118, 228, 128]);
    assert.deepEqual(coloreAttenzione(40, 1), [118, 228, 128]);
  });
});

describe('autotest', () => {
  it('scorre dall\'inizio alla fine nell\'80% del tempo, senza uscire dal file', () => {
    const inizio = passoAutotest(0, 6, 42, 20);
    assert.equal(inizio.primaRiga, 0);
    assert.equal(inizio.fuoco, 0);
    const fine = passoAutotest(6, 6, 42, 20);
    assert.equal(fine.fuoco, 41);
    assert.equal(fine.primaRiga, 22, 'al massimo righe − visibili');
    assert.ok(vicino(passoAutotest(4.8, 6, 42, 20).fuoco, 41, 1e-9), 'all\'80% del tempo è già in fondo');
    const meta = passoAutotest(3, 6, 42, 20);
    assert.ok(vicino(meta.fuoco, 25.625));
    assert.equal(meta.primaRiga, 15);
    assert.equal(passoAutotest(1, 6, 0, 20).primaRiga, 0);
  });
});

describe('ricerca (novità)', () => {
  const testi = ['const ordine = 1;', 'ORDINE.pagato', 'niente', 'ordine ordine'];
  it('trova tutte le occorrenze, senza distinguere le maiuscole se non richiesto', () => {
    assert.deepEqual(cerca(testi, 'ordine').map((o) => [o.riga, o.inizio]), [[0, 6], [1, 0], [3, 0], [3, 7]]);
    assert.deepEqual(cerca(testi, 'ORDINE', { maiuscole: true }).map((o) => o.riga), [1]);
    assert.deepEqual(cerca(testi, ''), []);
  });
  it('spezza i token sui confini delle occorrenze, senza perdere testo', () => {
    const tokens = [{ tipo: 'chiave', testo: 'const' }, { tipo: 'testo', testo: ' ordine = ' }, { tipo: 'numero', testo: '1' }];
    const pezzi = spezzaToken(tokens, [{ inizio: 6, fine: 12, attiva: true }, { inizio: 3, fine: 5, attiva: false }]);
    assert.equal(pezzi.map((p) => p.testo).join(''), 'const ordine = 1');
    assert.deepEqual(pezzi.filter((p) => p.trovato === 2).map((p) => p.testo), ['ordine']);
    assert.deepEqual(pezzi.filter((p) => p.trovato === 1).map((p) => [p.tipo, p.testo]), [['chiave', 'st']]);
  });
});
