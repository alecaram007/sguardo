// SGUARDO - rapporto HTML autonomo: nessuna risorsa esterna, tema chiaro e scuro.
// Porta fedele di RapportoHtml.cs: stesso markup, stesso stile, stessi testi.
// Modulo condiviso (Node e browser): restituisce il testo HTML, la scrittura su disco è altrove.
import { secondi as Secondi, percento as Percento, plurale as Plurale, data as Data, dataOraLunga, compatto } from './cultura.mjs';
import { Stato, FileAnalizzato } from './analisi.mjs';
import { Evidenziatore, TipoToken } from './evidenziatore.mjs';
import { espandiTab } from './impronte.mjs';

export const STILE = `
:root{
  --sfondo:#f4f5f7;--carta:#ffffff;--testo:#1c2128;--tenue:#626b76;--bordo:#dde1e6;--filo:#eef0f3;
  --verde:31,136,61;--verde-pieno:#1f883d;--grigio:#c4cad2;--trama:rgba(98,107,118,.10);
  --rosso:#cf222e;--rosso-rgb:207,34,46;--viola:#8250df;--ambra:#9a6700;
  --k:#0550ae;--s:#8a4600;--c:#6e7781;--d:#b35900;--ombra:0 1px 2px rgba(20,25,30,.05),0 4px 14px rgba(20,25,30,.04);
}
@media (prefers-color-scheme: dark){
  :root{
    --sfondo:#0d1015;--carta:#151a21;--testo:#e3e8ee;--tenue:#8b949e;--bordo:#2a313a;--filo:#1d232b;
    --verde:63,185,80;--verde-pieno:#3fb950;--grigio:#3a414a;--trama:rgba(139,148,158,.09);
    --rosso:#f85149;--rosso-rgb:248,81,73;--viola:#bc8cff;--ambra:#d29922;
    --k:#7cb7ff;--s:#e2be7a;--c:#7d8590;--d:#f0906a;--ombra:none;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--sfondo);color:var(--testo);font:15px/1.5 "Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif}
.pagina{max-width:1140px;margin:0 auto;padding:36px 20px 64px}
.testa{display:flex;align-items:center;gap:14px}
.testa svg{flex:none}
h1{font-size:27px;line-height:1.2;margin:0;letter-spacing:-.015em}
.sotto{color:var(--tenue);font-size:13.5px;margin:6px 0 26px;word-break:break-all}
.esito{border-radius:12px;padding:14px 18px;margin:0 0 18px;display:flex;gap:12px;align-items:flex-start;font-size:14.5px}
.esito strong{font-size:15px}
.esito .punto{flex:none;width:12px;height:12px;border-radius:50%;margin-top:5px}
.esito.no{background:rgba(var(--rosso-rgb),.08);border:1px solid rgba(var(--rosso-rgb),.35)}
.esito.no .punto{background:var(--rosso)}
.esito.no strong{color:var(--rosso)}
.esito.si{background:rgba(var(--verde),.08);border:1px solid rgba(var(--verde),.35)}
.esito.si .punto{background:var(--verde-pieno)}
.esito.si strong{color:var(--verde-pieno)}
.nota{color:var(--ambra);font-size:13.5px;margin:-6px 0 18px}
.schede{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin:0 0 26px}
.scheda{background:var(--carta);border:1px solid var(--bordo);border-radius:12px;padding:14px 16px;box-shadow:var(--ombra)}
.scheda b{display:block;font-size:30px;line-height:1.15;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.scheda span{color:var(--tenue);font-size:13px}
.scheda.rossa{border-color:rgba(var(--rosso-rgb),.45)}
.scheda.rossa b{color:var(--rosso)}
.scheda.verde b{color:var(--verde-pieno)}
.metro{height:6px;border-radius:3px;background:var(--grigio);margin:9px 0 4px;overflow:hidden}
.metro i{display:block;height:100%;background:var(--verde-pieno);border-radius:3px}
h3{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--tenue);margin:0 0 10px;font-weight:650}
.legenda{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;color:var(--tenue);margin:0 0 12px}
.legenda span{display:inline-flex;align-items:center;gap:7px}
.legenda i{display:inline-block;width:16px;height:11px;border-radius:2px}
.contenitore{background:var(--carta);border:1px solid var(--bordo);border-radius:12px;overflow:auto;margin:0 0 30px;box-shadow:var(--ombra)}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-weight:650;color:var(--tenue);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;padding:11px 14px;border-bottom:1px solid var(--bordo);white-space:nowrap}
td{padding:10px 14px;border-bottom:1px solid var(--filo);vertical-align:middle}
tr:last-child td{border-bottom:0}
tr.critico td:first-child{box-shadow:inset 3px 0 0 var(--rosso)}
td a{color:inherit;text-decoration:none;font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:13.5px}
td a:hover{text-decoration:underline}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rosso{color:var(--rosso);font-weight:650}
.tenue{color:var(--tenue)}
.impronta{display:flex;height:16px;border-radius:3px;overflow:hidden;min-width:180px}
.impronta span{flex:1 1 0;min-width:1px}
.badge{display:inline-block;font:700 10.5px/1.6 "Segoe UI",system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:1px 8px;border-radius:999px;margin-left:8px;vertical-align:2px;white-space:nowrap}
.badge.ia{color:var(--viola);border:1px solid currentColor}
.badge.crit{color:#fff;background:var(--rosso)}
.badge.ok{color:var(--verde-pieno);border:1px solid currentColor}
details.file{background:var(--carta);border:1px solid var(--bordo);border-radius:12px;margin:0 0 20px;overflow:hidden;box-shadow:var(--ombra)}
details.file.critico{border-color:rgba(var(--rosso-rgb),.6);box-shadow:0 0 0 3px rgba(var(--rosso-rgb),.10)}
details.file>summary{list-style:none;cursor:pointer;padding:14px 18px;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:baseline}
details.file>summary::-webkit-details-marker{display:none}
details.file>summary::before{content:'';width:7px;height:7px;border-right:2px solid var(--tenue);border-bottom:2px solid var(--tenue);transform:rotate(-45deg);margin-right:2px;align-self:center;transition:transform .15s}
details.file[open]>summary::before{transform:rotate(45deg)}
details.file[open]>summary{border-bottom:1px solid var(--bordo)}
summary h2{font:600 16px/1.3 "Cascadia Mono",Consolas,ui-monospace,monospace;margin:0}
summary .meta{color:var(--tenue);font-size:13px}
.avviso{padding:10px 18px;font-size:13.5px;border-bottom:1px solid var(--filo);background:rgba(var(--rosso-rgb),.05)}
.avviso a{color:var(--rosso);font-weight:650;text-decoration:none;font-variant-numeric:tabular-nums}
.avviso a:hover{text-decoration:underline}
.codice{overflow-x:auto;padding:8px 0;font:13px/1.65 "Cascadia Mono","Cascadia Code",Consolas,ui-monospace,"SF Mono",Menlo,monospace}
.righe{min-width:100%;width:max-content}
.r{display:grid;grid-template-columns:6px 20px 4.2em auto;min-height:1.65em;scroll-margin-top:40vh}
.r .m{display:block}
.r .x{display:block;text-align:center;font-weight:800;color:var(--rosso);font-style:normal}
.r .n{text-align:right;padding-right:16px;color:var(--tenue);opacity:.75;user-select:none;-webkit-user-select:none}
.r code{font:inherit;white-space:pre;padding-right:28px}
.r.letta{background-color:rgba(var(--verde),calc(.03 + var(--a) * .13))}
.r.letta .m{background:rgba(var(--verde),calc(.45 + var(--a) * .55))}
.r.sfiorata{background-image:repeating-linear-gradient(135deg,var(--trama) 0 4px,transparent 4px 9px)}
.r.sfiorata .m{background:linear-gradient(to top,rgba(var(--verde),.75) calc(var(--a) * 100%),var(--grigio) 0)}
.r.sfiorata code,.r.sfiorata .n{opacity:.6}
.r.mai{background-image:repeating-linear-gradient(135deg,var(--trama) 0 4px,transparent 4px 9px)}
.r.mai .m{background:var(--grigio)}
.r.mai code,.r.mai .n{opacity:.38}
.r.crit.nl{background-color:rgba(var(--rosso-rgb),.06);background-image:repeating-linear-gradient(135deg,rgba(var(--rosso-rgb),.10) 0 4px,transparent 4px 9px)}
.r.crit.nl .m{background:var(--rosso)}
.r.crit.nl code{opacity:.8}
.r.crit.nl .n{opacity:.9;color:var(--rosso)}
.r:hover{outline:1px solid var(--bordo);outline-offset:-1px}
.r:target{outline:2px solid var(--rosso);outline-offset:-2px}
.k{color:var(--k)}.s{color:var(--s)}.c{color:var(--c);font-style:italic}.d{color:var(--d)}
footer{color:var(--tenue);font-size:12.5px;margin-top:40px;border-top:1px solid var(--bordo);padding-top:16px;line-height:1.6}
footer p{margin:0 0 6px}
@media (max-width:720px){
  .pagina{padding:24px 16px 48px}
  h1{font-size:22px}
  .col-imp,.col-nl{display:none}
  .scheda b{font-size:25px}
}
@media print{details.file{break-inside:auto}.r:hover{outline:0}}
`;

const OCCHIO =
  '<svg width="38" height="38" viewBox="0 0 32 32" aria-hidden="true">' +
  '<path d="M1 16C8 4 24 4 31 16C24 28 8 28 1 16Z" fill="var(--testo)"/>' +
  '<circle cx="16" cy="16" r="6.5" fill="#3fb950"/><circle cx="16" cy="16" r="3" fill="var(--sfondo)"/></svg>';

export function E(s) {
  if (s === null || s === undefined || s === '') return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const N = (v) => compatto(v, 3, '.');

// Intensità del verde: 0 appena sopra la soglia, 1 con 4 volte la soglia.
export function intensita(r) {
  if (r.soglia <= 0) return 1;
  return Math.max(0, Math.min(1, (r.secondi / r.soglia - 1) / 3));
}

function coloreStriscia(r) {
  const st = r.stato();
  if (r.critica && st !== Stato.LETTA) return 'var(--rosso)';
  if (st === Stato.LETTA) return 'rgba(var(--verde),' + N(0.5 + 0.5 * intensita(r)) + ')';
  if (st === Stato.SFIORATA) return 'rgba(var(--verde),.22)';
  return 'var(--grigio)';
}

// I colori delle celle dell'«impronta dell'attenzione» di un file (al massimo 240 celle).
// Li usa anche l'interfaccia web, per disegnare la stessa striscia.
export function coloriStriscia(f) {
  const righe = f.significative;
  if (righe.length === 0) return ['var(--grigio)'];
  const celle = Math.min(righe.length, 240);
  const colori = [];
  for (let c = 0; c < celle; c++) {
    const da = Math.trunc((c * righe.length) / celle);
    const a = Math.max(da + 1, Math.trunc(((c + 1) * righe.length) / celle));
    const gruppo = righe.slice(da, a);
    let colore;
    if (gruppo.length === 1) colore = coloreStriscia(gruppo[0]);
    else if (gruppo.some((r) => r.critica && r.stato() !== Stato.LETTA)) colore = 'var(--rosso)';
    else {
      const lette = gruppo.filter((r) => r.stato() === Stato.LETTA).length / gruppo.length;
      colore = lette >= 0.999 ? 'rgba(var(--verde),.8)' : lette <= 0.001 ? 'var(--grigio)' : 'rgba(var(--verde),' + N(0.2 + 0.5 * lette) + ')';
    }
    colori.push(colore);
  }
  return colori;
}

function striscia(f) {
  let s = '<div class="impronta" aria-hidden="true">';
  if (f.significative.length === 0) return s + '<span style="background:var(--grigio)"></span></div>';
  for (const colore of coloriStriscia(f)) s += '<span style="background:' + colore + '"></span>';
  return s + '</div>';
}

export function titoloRiga(r) {
  const st = r.stato();
  const stato = st === Stato.LETTA ? 'letta' : st === Stato.SFIORATA ? 'sfiorata' : 'mai letta';
  let t = 'riga ' + r.numero + ' · ' + stato;
  if (r.critica) t += ' · critica';
  t += ' · ' + Secondi(r.secondi) + ' di attenzione su ' + Secondi(r.soglia) + ' richiesti';
  if (r.secondi > 0) {
    t += ' · ' + Plurale(r.sessioni, 'sessione', 'sessioni');
    t += ' · ultima: ' + Data(r.ultima);
    t += ' · origine: ' + r.origine;
  }
  return t;
}

function accorcia(s, max) {
  return s.length <= max ? s : s.substring(0, max - 1) + '…';
}

function nomeCartella(p) {
  const pulito = p.replace(/[\\/]+$/, '');
  const i = Math.max(pulito.lastIndexOf('/'), pulito.lastIndexOf('\\'));
  return i >= 0 ? pulito.slice(i + 1) : pulito;
}

// an: Analisi (con an.progetto.radice e an.progetto.regole). ora: Date.
export function rapportoHtml(an, ora = new Date()) {
  const h = [];
  const nomeProgetto = nomeCartella(an.progetto.radice);
  const crit = an.criticheNonLette;
  const righeTotali = an.file.reduce((s, f) => s + f.righe.length, 0);

  h.push('<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n');
  h.push('<meta name="viewport" content="width=device-width, initial-scale=1">\n');
  h.push('<meta name="color-scheme" content="light dark">\n');
  h.push('<title>Sguardo · ', E(nomeProgetto), '</title>\n<style>', STILE, '</style>\n</head>\n<body>\n<div class="pagina">\n');

  // Intestazione
  h.push('<header class="testa">', OCCHIO, '<h1>Chi ha letto questo codice?</h1></header>\n');
  h.push('<p class="sotto">Sguardo · rapporto di attenzione umana · <strong>', E(nomeProgetto), '</strong> · ',
    E(dataOraLunga(ora)), '<br>', E(an.cartella), '</p>\n');

  // Esito della verifica
  if (an.critiche === 0) {
    h.push('<div class="esito si"><span class="punto"></span><div><strong>Nessuna riga critica in questi file.</strong> La verifica non ha nulla da controllare.</div></div>\n');
  } else if (crit > 0) {
    h.push('<div class="esito no"><span class="punto"></span><div><strong>La verifica non passa: ',
      crit === 1 ? '1 riga critica non è stata letta' : crit + ' righe critiche non sono state lette',
      " da un umano.</strong><br>Qualcuno le ha scritte (forse un'IA), ma nessuno le ha ancora guardate con attenzione. Sono evidenziate in rosso qui sotto.</div></div>\n");
  } else {
    h.push('<div class="esito si"><span class="punto"></span><div><strong>La verifica passa: tutte le ',
      String(an.critiche), ' righe critiche sono state lette da un umano.</strong></div></div>\n');
  }
  if (an.simulati > 0.001) {
    const quota = an.secondi <= 0 ? 0 : an.simulati / an.secondi;
    h.push('<p class="nota">Nota: il ', Percento(quota),
      " dell'attenzione registrata è <strong>simulata</strong> (sguardo simula o autotest), non letta da una persona. In CI usa <code>--solo-letture</code>.</p>\n");
  }
  if (an.soloLetture) {
    h.push("<p class=\"nota\">Rapporto con <code>--solo-letture</code>: l'attenzione simulata non conta.</p>\n");
  }

  // Schede
  const ia = an.file.filter((f) => f.ia).length;
  h.push('<div class="schede">\n');
  h.push('<div class="scheda"><b>', Percento(an.frazione), '</b><span>delle righe lette da un umano</span>',
    '<div class="metro"><i style="width:', N(Math.floor(an.frazione * 1000) / 10), '%"></i></div>',
    '<span>', String(an.lette), ' su ', String(an.significative), ' righe non vuote</span></div>\n');
  h.push('<div class="scheda"><b>', String(an.mai), '</b><span>', an.mai === 1 ? 'riga mai letta' : 'righe mai lette',
    '</span><br><span>', Plurale(an.sfiorate, 'altra solo sfiorata', 'altre solo sfiorate'), '</span></div>\n');
  h.push('<div class="scheda ', crit > 0 ? 'rossa' : 'verde', '"><b>', String(crit), '</b><span>',
    crit === 1 ? 'riga critica non letta' : 'righe critiche non lette', '</span><br><span>su ',
    Plurale(an.critiche, 'riga critica', 'righe critiche'), '</span></div>\n');
  h.push('<div class="scheda"><b>', String(an.file.length), '</b><span>', 'file', ' sorgente</span><br><span>',
    ia === 0 ? "nessuno dichiarato scritto dall'IA" : ia === 1 ? "1 dichiarato scritto dall'IA" : ia + " dichiarati scritti dall'IA",
    '</span></div>\n');
  h.push('<div class="scheda"><b>', E(Secondi(an.secondi)), '</b><span>di attenzione registrata</span><br><span>',
    an.simulati > 0.001 ? 'di cui simulata: ' + Percento(an.secondi <= 0 ? 0 : an.simulati / an.secondi) : 'tutta da letture vere',
    '</span></div>\n');
  h.push('</div>\n');

  // Tabella dei file
  h.push('<h3>File</h3>\n<div class="contenitore"><table>\n<thead><tr><th>File</th><th class="num">Righe</th><th class="num">Lette</th>',
    "<th class=\"col-imp\">Impronta dell'attenzione</th><th class=\"col-nl\">Non lette</th><th class=\"num\">Critiche non lette</th></tr></thead>\n<tbody>\n");
  an.file.forEach((f, i) => {
    const cf = f.criticheNonLette.length;
    const nl = FileAnalizzato.descrivi(f.intervalliNonLette());
    h.push('<tr', cf > 0 ? ' class="critico"' : '', '><td><a href="#f', String(i), '">', E(f.relativo.replace(/\\/g, '/')), '</a>');
    if (f.ia) h.push('<span class="badge ia">IA</span>');
    h.push('</td><td class="num">', String(f.numSignificative), '</td>');
    h.push('<td class="num"><strong>', Percento(f.frazione), '</strong></td>');
    h.push('<td class="col-imp">', striscia(f), '</td>');
    h.push('<td class="col-nl tenue">', nl.length === 0 ? '—' : E(accorcia(nl, 40)), '</td>');
    h.push('<td class="num', cf > 0 ? ' rosso' : ' tenue', '">', cf > 0 ? String(cf) : '—', '</td></tr>\n');
  });
  h.push('</tbody></table></div>\n');

  // Mappa di calore
  h.push('<h3>Mappa di calore del codice</h3>\n<div class="legenda">',
    '<span><i style="background:rgba(var(--verde),.9)"></i>letta (più intensa = più attenzione)</span>',
    '<span><i style="background:rgba(var(--verde),.3)"></i>sfiorata</span>',
    '<span><i style="background:var(--grigio)"></i>mai letta, in ombra</span>',
    '<span><i style="background:var(--rosso)"></i>critica non letta</span>',
    '<span>passa il mouse su una riga per i dettagli</span></div>\n');

  const apriTutti = righeTotali <= 3000;
  an.file.forEach((f, i) => {
    const cnl = f.criticheNonLette;
    const completo = f.numLette === f.numSignificative;
    const id = 'f' + i;
    h.push('<details class="file', cnl.length > 0 ? ' critico' : '', '" id="', id, '"',
      apriTutti || !completo ? ' open' : '', '>\n<summary><h2>', E(f.relativo.replace(/\\/g, '/')), '</h2>');
    if (f.ia) h.push("<span class=\"badge ia\">scritto dall'IA</span>");
    if (cnl.length > 0) h.push('<span class="badge crit">', Plurale(cnl.length, 'riga critica non letta', 'righe critiche non lette'), '</span>');
    else if (completo && f.numSignificative > 0) h.push('<span class="badge ok">letto tutto</span>');
    const nl = FileAnalizzato.descrivi(f.intervalliNonLette());
    h.push('<span class="meta">', Plurale(f.numSignificative, 'riga', 'righe'), ' · ',
      Percento(f.frazione), ' lette · ', E(Secondi(f.secondiTotali)), ' di attenzione');
    if (nl.length > 0) h.push(' · non lette: ', E(nl));
    h.push('</span></summary>\n');
    if (cnl.length > 0) {
      h.push('<div class="avviso">Righe critiche da leggere: ');
      cnl.forEach((r, k) => {
        if (k > 0) h.push(', ');
        h.push('<a href="#', id, '-', String(r.numero), '">', String(r.numero), '</a>');
      });
      h.push('</div>\n');
    }
    h.push('<div class="codice"><div class="righe">\n');
    const ev = new Evidenziatore(f.estensione);
    for (const r of f.righe) {
      const testo = espandiTab(r.testo);
      const token = ev.riga(testo);
      const num = String(r.numero);
      if (r.vuota) {
        h.push('<div class="r" id="', id, '-', num, '"><i class="m"></i><i class="x"></i><span class="n">', num, '</span><code></code></div>\n');
        continue;
      }
      const st = r.stato();
      let classe = st === Stato.LETTA ? 'letta' : st === Stato.SFIORATA ? 'sfiorata' : 'mai';
      const nonLetta = st !== Stato.LETTA;
      if (r.critica) classe += nonLetta ? ' crit nl' : ' crit';
      h.push('<div class="r ', classe, '" id="', id, '-', num, '"');
      if (st === Stato.LETTA) h.push(' style="--a:', N(intensita(r)), '"');
      else if (st === Stato.SFIORATA) h.push(' style="--a:', N(Math.min(1, r.secondi / r.soglia)), '"');
      h.push(' title="', E(titoloRiga(r)), '"><i class="m"></i><i class="x">', r.critica && nonLetta ? '!' : '',
        '</i><span class="n">', num, '</span><code>');
      for (const t of token) {
        const c = t.tipo === TipoToken.CHIAVE ? 'k' : t.tipo === TipoToken.STRINGA ? 's' : t.tipo === TipoToken.COMMENTO ? 'c' : t.tipo === TipoToken.NUMERO ? 'd' : null;
        if (c === null) h.push(E(t.testo));
        else h.push('<span class="', c, '">', E(t.testo), '</span>');
      }
      h.push('</code></div>\n');
    }
    h.push('</div></div>\n</details>\n');
  });

  // Piede
  h.push('<footer><p>Una riga conta come <strong>letta</strong> quando l\'attenzione accumulata raggiunge ',
    E(an.progetto.regole.descriviSoglia()), ' (caratteri non spazio). Righe critiche: <code>',
    E(an.progetto.regole.critiche), '</code> (da <code>.sguardo/regole.json</code>).</p>',
    '<p>Sguardo misura le righe, non le persone: nei dati non c\'è nessun nome, solo tempi aggregati per riga. ',
    'È un\'euristica (finestra attiva, attività recente, vicinanza del puntatore), non eye tracking.</p>',
    '<p>Generato da Sguardo il ', E(dataOraLunga(ora, ' alle ')), '.</p></footer>\n');
  h.push('</div>\n</body>\n</html>\n');
  return h.join('');
}
