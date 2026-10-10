// SGUARDO - i tre file del negozio della demo, identici a quelli di demo.ps1
// (fine riga LF e nessun a capo finale, come le here-string di PowerShell).

export const CARRELLO = `// carrello.js — il carrello del negozio
// Scritto a mano dal team del negozio.

const IVA = 0.22;

function nuovoCarrello(cliente) {
  return { cliente: cliente, articoli: [], creato: new Date() };
}

function aggiungi(carrello, prodotto, quantita) {
  if (quantita <= 0) {
    throw new Error('Quantità non valida');
  }
  const riga = carrello.articoli.find(a => a.codice === prodotto.codice);
  if (riga) {
    riga.quantita += quantita;
  } else {
    carrello.articoli.push({ codice: prodotto.codice, prezzo: prodotto.prezzo, quantita: quantita });
  }
}

function rimuovi(carrello, codice) {
  carrello.articoli = carrello.articoli.filter(a => a.codice !== codice);
}

function totale(carrello) {
  const imponibile = carrello.articoli.reduce((s, a) => s + a.prezzo * a.quantita, 0);
  return Math.round(imponibile * (1 + IVA) * 100) / 100;
}

module.exports = { nuovoCarrello, aggiungi, rimuovi, totale };`;

export const PAGAMENTI = `// pagamenti.js — addebiti sulla carta del cliente
// Scritto a mano e revisionato in coppia a settembre 2026.

const gateway = require('./gateway');

const TENTATIVI_MASSIMI = 3;

async function addebita(ordine, carta) {
  const token = await gateway.autorizza(carta, ordine.totale);
  if (!token) {
    throw new Error('Pagamento rifiutato dalla banca');
  }
  for (let tentativo = 1; tentativo <= TENTATIVI_MASSIMI; tentativo++) {
    const esito = await gateway.incassa(token, ordine.totale);
    if (esito.ok) {
      ordine.token = token;
      ordine.pagato = ordine.totale;
      ordine.stato = 'pagato';
      return esito.idTransazione;
    }
  }
  throw new Error('Incasso non riuscito dopo ' + TENTATIVI_MASSIMI + ' tentativi');
}

function registraPagamento(db, ordine, idTransazione) {
  return db.query(
    'INSERT INTO pagamenti (ordine, importo, transazione) VALUES (?, ?, ?)',
    [ordine.id, ordine.pagato, idTransazione]
  );
}

module.exports = { addebita, registraPagamento };`;

export const RIMBORSI = `// rimborsi.js — resi e rimborsi dei clienti
// Scritto dall'IA (assistente di codice) il 28 settembre 2026 e unito senza modifiche.

const gateway = require('./gateway');

const GIORNI_PER_IL_RESO = 30;

function giorniDallAcquisto(ordine, oggi) {
  return Math.floor((oggi - ordine.data) / 86400000);
}

function resoAmmesso(ordine, oggi) {
  return ordine.stato === 'pagato' && giorniDallAcquisto(ordine, oggi) <= GIORNI_PER_IL_RESO;
}

function importoRimborsabile(ordine) {
  return ordine.pagato - (ordine.rimborsato || 0);
}

async function emettiRimborso(ordine, importo, motivo) {
  if (!resoAmmesso(ordine, new Date())) {
    throw new Error('Reso fuori tempo massimo');
  }
  if (importo <= 0) {
    throw new Error('Importo del rimborso non valido');
  }
  const esito = await gateway.accredita(ordine.token, importo);
  ordine.rimborsato = (ordine.rimborsato || 0) + importo;
  ordine.note.push('Rimborso di ' + importo + ' euro: ' + motivo);
  return esito.idTransazione;
}

function riepilogoRimborsi(ordini) {
  const conRimborso = ordini.filter(o => (o.rimborsato || 0) > 0);
  return {
    ordini: conRimborso.length,
    totale: conRimborso.reduce((s, o) => s + o.rimborsato, 0)
  };
}

module.exports = { resoAmmesso, importoRimborsabile, emettiRimborso, riepilogoRimborsi };`;

export const RIGA_CORRETTA = '  if (importo <= 0 || importo > importoRimborsabile(ordine)) {';
export const RIGA_AGGIUNTA = "// 1 ottobre 2026: aggiunto il controllo sull'importo massimo.";

// Il passo 7 della demo: la riga 24 cambia e una riga si aggiunge in cima (fine riga CRLF).
export function correggiRimborsi(testo) {
  const righe = testo.split(/\r\n|\n|\r/);
  if (righe.length && righe[righe.length - 1] === '') righe.pop();
  const vecchia = righe[23];
  righe[23] = RIGA_CORRETTA;
  righe.splice(2, 0, RIGA_AGGIUNTA);
  return { testo: righe.join('\r\n') + '\r\n', vecchia, righe };
}
