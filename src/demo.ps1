<#
    Demo di Sguardo: un piccolo negozio online con tre file sorgente, uno
    scritto dall'IA con un bug nei rimborsi. Una revisione umana (simulata)
    salta proprio quel blocco, e Sguardo se ne accorge.
    Tutto avviene nella cartella "demo" accanto a questo progetto.
#>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false } catch { }

$radice    = Split-Path -Parent $PSScriptRoot
$exe       = Join-Path $radice 'bin\sguardo.exe'
$demo      = Join-Path $radice 'demo'
$marcatore = Join-Path $demo '.demo-sguardo'
$negozio   = Join-Path $demo 'negozio'

if (-not (Test-Path -LiteralPath $exe)) {
    Write-Host '  Compilo Sguardo...' -ForegroundColor DarkGray
    & cmd /c "`"$(Join-Path $radice 'build.cmd')`"" | Out-Null
    if (-not (Test-Path -LiteralPath $exe)) { throw "Compilazione non riuscita: lancia build.cmd per vedere l'errore." }
}
if (Test-Path -LiteralPath $demo) {
    if (-not (Test-Path -LiteralPath $marcatore)) { throw "La cartella '$demo' esiste ma non l'ha creata la demo: non la tocco." }
    Remove-Item -LiteralPath $demo -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $negozio | Out-Null
Set-Content -LiteralPath $marcatore -Value 'Cartella generata da demo.ps1: viene ricreata a ogni esecuzione.'
Set-Location -LiteralPath $demo

function Sguardo {
    Write-Host ''
    Write-Host ('  > sguardo ' + ($args -join ' ')) -ForegroundColor DarkCyan
    & $exe @args
    $script:uscita = $LASTEXITCODE
}
function Titolo([string]$testo) {
    Write-Host ''
    Write-Host ''
    Write-Host "━━━ $testo" -ForegroundColor Magenta
}
function Racconta([string]$testo) {
    Write-Host ''
    foreach ($riga in ($testo -split "`n")) { Write-Host ('  ' + $riga.TrimEnd()) -ForegroundColor Gray }
}
function Uscita {
    $colore = if ($script:uscita -eq 0) { 'Green' } else { 'Red' }
    Write-Host "  codice di uscita: $($script:uscita)" -ForegroundColor $colore
}

# ---------------------------------------------------------------------------
# Il negozio
# ---------------------------------------------------------------------------
$utf8 = New-Object Text.UTF8Encoding $false

[IO.File]::WriteAllText((Join-Path $negozio 'carrello.js'), @'
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
'@, $utf8)

[IO.File]::WriteAllText((Join-Path $negozio 'pagamenti.js'), @'
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
'@, $utf8)

$rimborsi = Join-Path $negozio 'rimborsi.js'
[IO.File]::WriteAllText($rimborsi, @'
// rimborsi.js — resi e rimborsi dei clienti
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

module.exports = { resoAmmesso, importoRimborsabile, emettiRimborso, riepilogoRimborsi };
'@, $utf8)

# ---------------------------------------------------------------------------
# La storia
# ---------------------------------------------------------------------------
Titolo "1 · Un piccolo negozio online: tre file, uno scritto dall'IA"
Write-Host ''
foreach ($f in Get-ChildItem -LiteralPath $negozio -Filter *.js | Sort-Object Name) {
    $righe = [IO.File]::ReadAllLines($f.FullName, [Text.Encoding]::UTF8)
    Write-Host ('  {0,-14} {1,3} righe   {2}' -f $f.Name, $righe.Count, $righe[1].TrimStart('/ ')) -ForegroundColor White
}
Racconta @'
Con l'IA che scrive sempre più codice, la domanda vera non è più «chi l'ha scritto?»
ma «qualcuno l'ha letto?». Attiviamo Sguardo nel progetto.
'@
Sguardo init negozio

Titolo '2 · La revisione: carrello e pagamenti letti tutti, rimborsi.js solo in parte'
Racconta @'
Il revisore legge con cura carrello.js e pagamenti.js. Di rimborsi.js legge l'inizio
e la fine, dà un'occhiata alla firma di emettiRimborso() e salta il corpo: «è dell'IA,
sembra a posto». (Qui la lettura è simulata; nella realtà la registra  sguardo leggi <file>.)
'@
Sguardo simula negozio\carrello.js 1-31 45
Sguardo simula negozio\pagamenti.js 1-32 50
Sguardo simula negozio\rimborsi.js 1-19 30
Sguardo simula negozio\rimborsi.js 20 1
Sguardo simula negozio\rimborsi.js 33-41 25

Titolo '3 · Il rapporto: chi ha letto cosa'
Sguardo rapporto negozio --html revisione-parziale.html

Titolo "4 · Dov'è il bug? Proprio tra le righe mai lette"
Sguardo mostra negozio\rimborsi.js 16-31
Racconta @'
emettiRimborso() controlla solo che l'importo sia positivo: non lo confronta mai con
importoRimborsabile(). Si può rimborsare più di quanto è stato pagato, e più volte.
La funzione giusta esiste (riga 16), ma le righe che avrebbero dovuto usarla non le ha
lette nessuno. git blame direbbe chi le ha scritte; Sguardo dice che nessuno le ha lette.
'@

Titolo '5 · La CI chiede a Sguardo: le righe critiche sono state lette?'
Sguardo verifica negozio
Uscita
Racconta 'La pipeline si ferma prima del merge.'

Titolo '6 · Un umano legge davvero il blocco (simulato) e la verifica passa'
Sguardo simula negozio\rimborsi.js 20-31 40
Sguardo verifica negozio
Uscita

Titolo "7 · Qualcuno corregge il bug: una riga cambia e un'altra si aggiunge in cima"
$righe = [Collections.Generic.List[string]]([IO.File]::ReadAllLines($rimborsi, [Text.Encoding]::UTF8))
$vecchia = $righe[23]
$righe[23] = '  if (importo <= 0 || importo > importoRimborsabile(ordine)) {'
$righe.Insert(2, "// 1 ottobre 2026: aggiunto il controllo sull'importo massimo.")
[IO.File]::WriteAllText($rimborsi, (($righe -join "`r`n") + "`r`n"), $utf8)
Write-Host ''
Write-Host "  riga 24  - $vecchia" -ForegroundColor DarkRed
Write-Host "  riga 25  + $($righe[24])" -ForegroundColor DarkGreen
Write-Host "  riga 3   + $($righe[2])" -ForegroundColor DarkGreen
Sguardo mostra negozio\rimborsi.js '1-5,21-32'
Racconta @'
Tutte le righe sotto la 3 si sono spostate di una posizione ma restano lette: l'impronta
segue il contenuto della riga, non il suo numero. La riga corretta invece torna «mai letta»,
e ha ragione: la versione nuova non l'ha ancora letta nessuno.
'@
Sguardo verifica negozio
Uscita

Titolo '8 · Il rapporto HTML'
Sguardo rapporto negozio

Titolo '9 · Il lettore vero: autotest della finestra per 6 secondi'
Racconta @'
Si apre la finestra di Sguardo: scorre da sola simulando un lettore, salva una schermata
e si chiude. È solo una prova che l'interfaccia funziona: questa attenzione viene
registrata come «simulazione», non come lettura umana.
'@
Sguardo leggi negozio\rimborsi.js --autotest 6 --schermata lettore-autotest.png

Titolo 'Fine'
Write-Host ''
Write-Host "  Rapporto dopo la revisione parziale:  $(Join-Path $demo 'revisione-parziale.html')" -ForegroundColor White
Write-Host "  Rapporto finale:                      $(Join-Path $negozio 'sguardo-rapporto.html')" -ForegroundColor White
Write-Host "  Schermata del lettore:                $(Join-Path $demo 'lettore-autotest.png')" -ForegroundColor White
Write-Host ''
Write-Host '  Per leggere tu la riga corretta:  sguardo leggi demo\negozio\rimborsi.js' -ForegroundColor DarkGray
Write-Host ''
