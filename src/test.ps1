<#
    Test automatici di Sguardo.
    Lavorano nella cartella "prove" accanto al progetto: viene ricreata a ogni
    esecuzione e cancellata alla fine se tutto è andato bene.
    Esce con 0 se tutti i controlli passano, con 1 altrimenti.
#>
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false } catch { }
Add-Type -AssemblyName System.Drawing
$INV  = [Globalization.CultureInfo]::InvariantCulture
$UTF8 = New-Object Text.UTF8Encoding $false

$radice    = Split-Path -Parent $PSScriptRoot
$exe       = Join-Path $radice 'bin\sguardo.exe'
$prove     = Join-Path $radice 'prove'
$marcatore = Join-Path $prove '.prove-sguardo'
$progetto  = Join-Path $prove 'progetto'

if (-not (Test-Path -LiteralPath $exe)) { & cmd /c "`"$(Join-Path $radice 'build.cmd')`"" | Out-Null }
if (-not (Test-Path -LiteralPath $exe)) { Write-Host '  FALLITO  compilazione (lancia build.cmd)' -ForegroundColor Red; exit 1 }
if (Test-Path -LiteralPath $prove) {
    if (-not (Test-Path -LiteralPath $marcatore)) {
        Write-Host "  La cartella '$prove' esiste ma non l'hanno creata i test: non la tocco." -ForegroundColor Red
        exit 1
    }
    Remove-Item -LiteralPath $prove -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $progetto | Out-Null
Set-Content -LiteralPath $marcatore -Value 'Cartella generata da test.ps1: viene ricreata a ogni esecuzione.'

$script:ok = 0
$script:falliti = 0
$script:codice = 0

function Sezione([string]$testo) {
    Write-Host ''
    Write-Host "━━━ $testo" -ForegroundColor Magenta
}
function Controlla([string]$nome, [bool]$esito, [string]$dettaglio = '') {
    if ($esito) {
        $script:ok++
        Write-Host "  OK       $nome" -ForegroundColor Green
    } else {
        $script:falliti++
        Write-Host "  FALLITO  $nome" -ForegroundColor Red
        if ($dettaglio) { Write-Host "           $dettaglio" -ForegroundColor DarkGray }
    }
}
# Esegue sguardo.exe e restituisce l'output come testo; il codice d'uscita va in $script:codice.
function Sguardo {
    $out = & $exe @args 2>$null
    $script:codice = $LASTEXITCODE
    return (@($out) -join "`n")
}
# Stato di ogni riga, dal comando "righe" (TSV).
function Righe([string]$file) {
    $risultato = @()
    foreach ($l in (& $exe righe $file 2>$null)) {
        if ($l -notmatch '^\d+\t') { continue }
        $c = $l -split "`t"
        $risultato += [pscustomobject]@{
            n = [int]$c[0]; stato = $c[1]
            secondi = [double]::Parse($c[2], $INV); soglia = [double]::Parse($c[3], $INV)
            critica = ($c[4] -eq '1'); origine = $c[5]; sessioni = [int]$c[6]; impronta = $c[7]; testo = $c[8]
        }
    }
    return $risultato
}
function Riga($righe, [int]$n) { return @($righe | Where-Object { $_.n -eq $n })[0] }
function Scrivi([string]$file, [string[]]$righe) {
    [IO.File]::WriteAllText($file, (($righe -join "`r`n") + "`r`n"), $UTF8)
}
function SommaSecondi([string]$json) {
    $o = [IO.File]::ReadAllText($json, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $s = 0.0
    foreach ($p in $o.righe.PSObject.Properties) { $s += [double]$p.Value.secondi }
    return $s
}

Write-Host ''
Write-Host '  Test di Sguardo' -ForegroundColor White
Write-Host "  cartella di prova: $prove" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
Sezione 'init'
$o = Sguardo init $progetto
Controlla 'init crea .sguardo\regole.json e .sguardo\letture\' (($script:codice -eq 0) -and (Test-Path "$progetto\.sguardo\regole.json") -and (Test-Path "$progetto\.sguardo\letture")) $o
$o = Sguardo init $progetto
Controlla 'init su un progetto già attivo non tocca nulla' (($script:codice -eq 0) -and ($o -match 'già attivo')) $o

# ---------------------------------------------------------------------------
Sezione 'soglia di lettura'
$soglia = Join-Path $progetto 'soglia.js'
Scrivi $soglia @('}', ('abcdefghij' * 4), 'uno due tre quattro cinque')
$r = Righe $soglia
Controlla 'riga di 1 carattere: soglia minima 0,4 s' ((Riga $r 1).soglia -eq 0.4) "soglia = $((Riga $r 1).soglia)"
Controlla 'riga di 40 caratteri: soglia 40 × 0,05 = 2 s' ((Riga $r 2).soglia -eq 2.0) "soglia = $((Riga $r 2).soglia)"
Controlla 'gli spazi non contano: 22 caratteri → 1,1 s' ((Riga $r 3).soglia -eq 1.1) "soglia = $((Riga $r 3).soglia)"
Controlla 'prima di ogni lettura le righe sono «mai lette»' (@($r | Where-Object { $_.stato -ne 'mai' }).Count -eq 0)

$null = Sguardo simula $soglia 1 0.39
$r = Righe $soglia
Controlla '0,39 s su una soglia di 0,4 s: «sfiorata», non letta' ((Riga $r 1).stato -eq 'sfiorata') "stato = $((Riga $r 1).stato)"
$null = Sguardo simula $soglia 1 '0,02'
$r = Righe $soglia
Controlla 'altri 0,02 s (scritti all''italiana): ora è letta' ((Riga $r 1).stato -eq 'letta') "stato = $((Riga $r 1).stato), secondi = $((Riga $r 1).secondi)"
$null = Sguardo simula $soglia 2 1.9
$r = Righe $soglia
Controlla '1,9 s su 2 s: non ancora letta' ((Riga $r 2).stato -eq 'sfiorata') "stato = $((Riga $r 2).stato)"
$null = Sguardo simula $soglia 2 0.1
$r = Righe $soglia
Controlla 'l''attenzione si accumula tra sessioni: 1,9 + 0,1 = soglia → letta' ((Riga $r 2).stato -eq 'letta') "stato = $((Riga $r 2).stato), secondi = $((Riga $r 2).secondi)"
Controlla 'due sessioni contate sulla stessa riga' ((Riga $r 2).sessioni -eq 2) "sessioni = $((Riga $r 2).sessioni)"
Controlla 'la riga non toccata resta «mai letta»' ((Riga $r 3).stato -eq 'mai')

# ---------------------------------------------------------------------------
Sezione 'impronte: righe spostate, modificate, identiche'
$app = Join-Path $progetto 'app.js'
Scrivi $app @(
    'function prova(a) {',
    '  const segreto = a * 2;',
    '  if (segreto > 10) {',
    '    return segreto;',
    '  }',
    '  return 0;',
    '}'
)
$o = Sguardo simula $app 1-7 60
$prima = Righe $app
Controlla 'simula: tutte le 7 righe lette, origine «simulazione»' ((@($prima | Where-Object { $_.stato -eq 'letta' -and $_.origine -eq 'simulazione' }).Count -eq 7) -and ($script:codice -eq 0)) $o

Scrivi $app @(
    '// intestazione aggiunta dopo la lettura',
    '',
    'const x = 1;',
    'function prova(a) {',
    '  const segreto = a * 2;',
    '  if (segreto > 10) {',
    '          return segreto;',
    '  }',
    '  return -1;',
    '}'
)
$dopo = Righe $app
$spostate = @(@(4, 1), @(5, 2), @(6, 3), @(8, 5), @(10, 7))
$stabili = $true
foreach ($c in $spostate) {
    $nuova = Riga $dopo $c[0]; $vecchia = Riga $prima $c[1]
    if ($nuova.stato -ne 'letta' -or $nuova.impronta -ne $vecchia.impronta) { $stabili = $false }
}
Controlla 'impronte stabili: 3 righe in più sopra, le righe spostate restano lette' $stabili (($dopo | ForEach-Object { "$($_.n):$($_.stato)" }) -join ' ')
Controlla 'rientro diverso (spazi) = stessa riga: resta letta' (((Riga $dopo 7).stato -eq 'letta') -and ((Riga $dopo 7).impronta -eq (Riga $prima 4).impronta))
Controlla 'riga modificata ("return 0" → "return -1") torna «mai letta»' ((Riga $dopo 9).stato -eq 'mai') "stato = $((Riga $dopo 9).stato)"
Controlla 'righe nuove: «mai lette»' (((Riga $dopo 1).stato -eq 'mai') -and ((Riga $dopo 3).stato -eq 'mai'))

$graffe = Join-Path $progetto 'graffe.js'
Scrivi $graffe @('if (a) {', '  x();', '}', 'if (b) {', '  y();', '}')
$null = Sguardo simula $graffe 1-3 10
$g = Righe $graffe
$h3 = (Riga $g 3).impronta; $h6 = (Riga $g 6).impronta
Controlla 'due "}" identiche hanno impronte distinte (#0 e #1)' (($h3 -ne $h6) -and ($h3 -like '*#0') -and ($h6 -like '*#1') -and ($h3.Split('#')[0] -eq $h6.Split('#')[0])) "$h3 / $h6"
Controlla 'letta la prima "}", non la seconda' (((Riga $g 3).stato -eq 'letta') -and ((Riga $g 6).stato -eq 'mai'))
Scrivi $graffe @('// commento nuovo', 'if (a) {', '  x();', '}', 'if (b) {', '  y();', '}')
$g = Righe $graffe
Controlla 'dopo uno spostamento ogni "}" conserva la propria lettura' (((Riga $g 4).stato -eq 'letta') -and ((Riga $g 7).stato -eq 'mai'))

# ---------------------------------------------------------------------------
Sezione 'verifica (CI)'
$critico = Join-Path $progetto 'critico.js'
Scrivi $critico @('const password = leggiDalVault();', "console.log('pronto');")
$o = Sguardo verifica $progetto
Controlla 'riga critica non letta: codice di uscita 1' ($script:codice -eq 1) "codice = $($script:codice)"
Controlla 'la verifica elenca la riga (critico.js:1)' ($o -match 'critico\.js:1') $o
Controlla 'le righe critiche già lette non vengono elencate (app.js:5)' ($o -notmatch 'app\.js:5')
$null = Sguardo simula $critico 1 5
$o = Sguardo verifica $progetto
Controlla 'dopo la lettura: codice di uscita 0' ($script:codice -eq 0) $o
$o = Sguardo verifica $progetto --solo-letture
Controlla '--solo-letture: l''attenzione simulata non basta (codice 1)' ($script:codice -eq 1) "codice = $($script:codice)"

$regole = Join-Path $progetto '.sguardo\regole.json'
$originali = [IO.File]::ReadAllText($regole, [Text.Encoding]::UTF8)
$j = $originali | ConvertFrom-Json
$j.critiche = 'parolachenoncenessuncodice'
[IO.File]::WriteAllText($regole, ($j | ConvertTo-Json -Depth 5), $UTF8)
$o = Sguardo verifica $progetto --solo-letture
Controlla 'regole.json configurabile: nessuna riga critica → codice 0' ($script:codice -eq 0) $o
$j.critiche = 'console'
[IO.File]::WriteAllText($regole, ($j | ConvertTo-Json -Depth 5), $UTF8)
$o = Sguardo verifica $progetto
Controlla 'regole.json configurabile: "console" diventa critica → critico.js:2' (($script:codice -eq 1) -and ($o -match 'critico\.js:2')) $o
[IO.File]::WriteAllText($regole, $originali, $UTF8)

# ---------------------------------------------------------------------------
Sezione 'rapporto'
$o = Sguardo rapporto $progetto
$html = Join-Path $progetto 'sguardo-rapporto.html'
Controlla 'rapporto in console: codice 0, elenca i file' (($script:codice -eq 0) -and ($o -match 'app\.js') -and ($o -match 'graffe\.js')) $o
Controlla 'il rapporto indica gli intervalli non letti (app.js: 1-3, 9)' ($o -match '1-3, 9') $o
Controlla 'sguardo-rapporto.html generato' (Test-Path -LiteralPath $html)
$t = if (Test-Path -LiteralPath $html) { [IO.File]::ReadAllText($html, [Text.Encoding]::UTF8) } else { '' }
Controlla 'HTML completo, con mappa di calore e righe in ombra' (($t -match '^<!doctype html>') -and ($t -match '</html>\s*$') -and ($t -match 'class="r mai') -and ($t -match 'class="r letta') -and ($t -match 'app\.js'))
Controlla 'HTML autonomo: nessuna risorsa esterna' (($t -notmatch 'https?://') -and ($t -notmatch '<script') -and ($t -notmatch '<link') -and ($t -notmatch '\ssrc='))
Controlla 'HTML con tema scuro (prefers-color-scheme)' ($t -match 'prefers-color-scheme:\s*dark')
Controlla 'HTML: accenti in UTF-8 corretti' (($t -match 'Chi ha letto questo codice\?') -and ($t -match 'è') -and ($t -notmatch 'Ã'))
$altro = Join-Path $prove 'altro.html'
$null = Sguardo rapporto $progetto --html $altro
Controlla 'rapporto --html <file> scrive dove richiesto' (($script:codice -eq 0) -and (Test-Path -LiteralPath $altro))

$interno = Join-Path $progetto 'sotto\interno'
New-Item -ItemType Directory -Force -Path $interno | Out-Null
$dentro = Join-Path $interno 'dentro.js'
Scrivi $dentro @('const annidato = true;')
$o = Sguardo rapporto (Join-Path $progetto 'sotto') --html (Join-Path $prove 'sotto.html')
Controlla 'da una sottocartella trova .sguardo risalendo' (($script:codice -eq 0) -and ($o -match 'dentro\.js') -and ($o -notmatch 'app\.js')) $o
$null = Sguardo simula $dentro 1 2
Controlla 'i dati di un file annidato vanno in .sguardo\letture\sotto\interno\' (Test-Path "$progetto\.sguardo\letture\sotto\interno\dentro.js.json")

$vuota = Join-Path $prove 'senza-progetto'
New-Item -ItemType Directory -Force -Path $vuota | Out-Null
$null = Sguardo verifica $vuota
Controlla 'senza .sguardo: errore con codice 2 (non 0, non 1)' ($script:codice -eq 2) "codice = $($script:codice)"
$null = Sguardo simula $app 9-3 5
Controlla 'intervallo sbagliato: errore con codice 2' ($script:codice -eq 2) "codice = $($script:codice)"

# ---------------------------------------------------------------------------
Sezione 'dati e privacy'
$jsonApp = Join-Path $progetto '.sguardo\letture\app.js.json'
$dati = [IO.File]::ReadAllText($jsonApp, [Text.Encoding]::UTF8) | ConvertFrom-Json
$voci = @($dati.righe.PSObject.Properties)
$formatoOk = ($dati.formato -eq 'sguardo/1') -and ($dati.file -eq 'app.js') -and ($voci.Count -ge 7)
foreach ($v in $voci) {
    $campi = @($v.Value.PSObject.Properties.Name) -join ','
    if ($campi -ne 'secondi,simulati,sessioni,ultima,origine') { $formatoOk = $false }
    if ($v.Name -notmatch '^[0-9a-f]{12}#\d+$') { $formatoOk = $false }
    if ($v.Value.ultima -notmatch '^\d{4}-\d{2}-\d{2}$') { $formatoOk = $false }
    if (@('lettura', 'simulazione', 'mista') -notcontains $v.Value.origine) { $formatoOk = $false }
}
Controlla 'JSON per file: impronta → secondi, sessioni, giorno, origine' $formatoOk
$privato = $true
foreach ($f in Get-ChildItem -LiteralPath (Join-Path $progetto '.sguardo\letture') -Recurse -Filter *.json) {
    $d = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
    $o = $d | ConvertFrom-Json
    if ((@($o.PSObject.Properties.Name) -join ',') -ne 'formato,file,righe') { $privato = $false }
    if ($o.file -match ':' -or $o.file.StartsWith('/')) { $privato = $false }
    if ($d.IndexOf($prove, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $privato = $false }
    foreach ($chi in @($env:USERNAME, $env:COMPUTERNAME)) {
        if ($chi -and $chi.Length -ge 3 -and $chi -notmatch '^[0-9a-fA-F]+$' -and $d.IndexOf($chi, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $privato = $false }
    }
}
Controlla 'privacy: nei dati nessun nome utente, nessun computer, nessun percorso assoluto' $privato

# ---------------------------------------------------------------------------
Sezione 'lettore (finestra vera, autotest)'
$png = Join-Path $prove 'lettore.png'
$primaSec = SommaSecondi $jsonApp
$o = Sguardo leggi $app --autotest 3 --schermata $png
$dopoSec = SommaSecondi $jsonApp
Controlla 'leggi --autotest: la finestra si apre, si chiude da sola, codice 0' ($script:codice -eq 0) $o
Controlla 'schermata PNG salvata' (Test-Path -LiteralPath $png)
if (Test-Path -LiteralPath $png) {
    $bmp = [Drawing.Bitmap]::FromFile($png)
    $colori = New-Object 'System.Collections.Generic.HashSet[int]'
    for ($x = 0; $x -lt $bmp.Width; $x += 7) { for ($y = 0; $y -lt $bmp.Height; $y += 7) { [void]$colori.Add($bmp.GetPixel($x, $y).ToArgb()) } }
    $dim = "$($bmp.Width)×$($bmp.Height), $($colori.Count) colori campionati"
    Controlla "la schermata contiene un'interfaccia disegnata ($dim)" (($bmp.Width -ge 400) -and ($bmp.Height -ge 300) -and ($colori.Count -ge 20))
    $bmp.Dispose()
}
Controlla 'l''autotest registra attenzione nel JSON' ($dopoSec -gt $primaSec + 1) ("prima {0:N2} s, dopo {1:N2} s" -f $primaSec, $dopoSec)
$dopoAuto = Righe $app
Controlla 'l''attenzione dell''autotest è marcata come simulazione' (@($dopoAuto | Where-Object { $_.origine -eq 'lettura' -or $_.origine -eq 'mista' }).Count -eq 0)

# ---------------------------------------------------------------------------
Write-Host ''
$totale = $script:ok + $script:falliti
if ($script:falliti -eq 0) {
    Write-Host "  Tutti i $totale controlli sono OK." -ForegroundColor Green
    Set-Location -LiteralPath $radice
    Remove-Item -LiteralPath $prove -Recurse -Force
    exit 0
}
Write-Host "  $($script:falliti) controlli FALLITI su $totale. La cartella di prova resta per l'analisi: $prove" -ForegroundColor Red
exit 1
