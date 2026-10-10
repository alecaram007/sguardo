// carrello.js — il carrello del negozio
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

module.exports = { nuovoCarrello, aggiungi, rimuovi, totale };