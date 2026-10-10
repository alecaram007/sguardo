// pagamenti.js — addebiti sulla carta del cliente
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

module.exports = { addebita, registraPagamento };