// rimborsi.js — resi e rimborsi dei clienti
// Scritto dall'IA (assistente di codice) il 28 settembre 2026 e unito senza modifiche.
// 1 ottobre 2026: aggiunto il controllo sull'importo massimo.

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
  if (importo <= 0 || importo > importoRimborsabile(ordine)) {
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

module.exports = { resoAmmesso, importoRimborsabile, emettiRimborso, riepilogoRimborsi };
