// SGUARDO - rapporto HTML autonomo: nessuna risorsa esterna, tema chiaro e scuro.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Sguardo
{
    static class RapportoHtml
    {
        const string Stile = @"
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
body{margin:0;background:var(--sfondo);color:var(--testo);font:15px/1.5 ""Segoe UI"",system-ui,-apple-system,""Helvetica Neue"",Arial,sans-serif}
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
td a{color:inherit;text-decoration:none;font-family:""Cascadia Mono"",Consolas,ui-monospace,monospace;font-size:13.5px}
td a:hover{text-decoration:underline}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rosso{color:var(--rosso);font-weight:650}
.tenue{color:var(--tenue)}
.impronta{display:flex;height:16px;border-radius:3px;overflow:hidden;min-width:180px}
.impronta span{flex:1 1 0;min-width:1px}
.badge{display:inline-block;font:700 10.5px/1.6 ""Segoe UI"",system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:1px 8px;border-radius:999px;margin-left:8px;vertical-align:2px;white-space:nowrap}
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
summary h2{font:600 16px/1.3 ""Cascadia Mono"",Consolas,ui-monospace,monospace;margin:0}
summary .meta{color:var(--tenue);font-size:13px}
.avviso{padding:10px 18px;font-size:13.5px;border-bottom:1px solid var(--filo);background:rgba(var(--rosso-rgb),.05)}
.avviso a{color:var(--rosso);font-weight:650;text-decoration:none;font-variant-numeric:tabular-nums}
.avviso a:hover{text-decoration:underline}
.codice{overflow-x:auto;padding:8px 0;font:13px/1.65 ""Cascadia Mono"",""Cascadia Code"",Consolas,ui-monospace,""SF Mono"",Menlo,monospace}
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
";

        const string Occhio =
            "<svg width=\"38\" height=\"38\" viewBox=\"0 0 32 32\" aria-hidden=\"true\">" +
            "<path d=\"M1 16C8 4 24 4 31 16C24 28 8 28 1 16Z\" fill=\"var(--testo)\"/>" +
            "<circle cx=\"16\" cy=\"16\" r=\"6.5\" fill=\"#3fb950\"/><circle cx=\"16\" cy=\"16\" r=\"3\" fill=\"var(--sfondo)\"/></svg>";

        static string E(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            StringBuilder sb = new StringBuilder(s.Length + 16);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '&': sb.Append("&amp;"); break;
                    case '<': sb.Append("&lt;"); break;
                    case '>': sb.Append("&gt;"); break;
                    case '"': sb.Append("&quot;"); break;
                    case '\'': sb.Append("&#39;"); break;
                    default: sb.Append(c); break;
                }
            }
            return sb.ToString();
        }

        static string N(double v)
        {
            return v.ToString("0.###", Cultura.INV);
        }

        // Intensità del verde: 0 appena sopra la soglia, 1 con 4 volte la soglia.
        static double Intensita(RigaCodice r)
        {
            if (r.Soglia <= 0) return 1;
            return Math.Max(0, Math.Min(1, (r.Secondi / r.Soglia - 1) / 3));
        }

        static string ColoreStriscia(RigaCodice r)
        {
            StatoRiga st = r.Stato();
            if (r.Critica && st != StatoRiga.Letta) return "var(--rosso)";
            if (st == StatoRiga.Letta) return "rgba(var(--verde)," + N(0.5 + 0.5 * Intensita(r)) + ")";
            if (st == StatoRiga.Sfiorata) return "rgba(var(--verde),.22)";
            return "var(--grigio)";
        }

        static string Striscia(FileAnalizzato f)
        {
            List<RigaCodice> righe = f.Significative.ToList();
            StringBuilder sb = new StringBuilder("<div class=\"impronta\" aria-hidden=\"true\">");
            if (righe.Count == 0) { sb.Append("<span style=\"background:var(--grigio)\"></span></div>"); return sb.ToString(); }
            int celle = Math.Min(righe.Count, 240);
            for (int c = 0; c < celle; c++)
            {
                int da = c * righe.Count / celle, a = Math.Max(da + 1, (c + 1) * righe.Count / celle);
                List<RigaCodice> gruppo = righe.GetRange(da, a - da);
                string colore;
                if (gruppo.Count == 1) colore = ColoreStriscia(gruppo[0]);
                else if (gruppo.Any(r => r.Critica && r.Stato() != StatoRiga.Letta)) colore = "var(--rosso)";
                else
                {
                    double lette = gruppo.Count(r => r.Stato() == StatoRiga.Letta) / (double)gruppo.Count;
                    colore = lette >= 0.999 ? "rgba(var(--verde),.8)" : lette <= 0.001 ? "var(--grigio)" : "rgba(var(--verde)," + N(0.2 + 0.5 * lette) + ")";
                }
                sb.Append("<span style=\"background:").Append(colore).Append("\"></span>");
            }
            sb.Append("</div>");
            return sb.ToString();
        }

        static string Titolo(RigaCodice r)
        {
            StatoRiga st = r.Stato();
            string stato = st == StatoRiga.Letta ? "letta" : st == StatoRiga.Sfiorata ? "sfiorata" : "mai letta";
            StringBuilder t = new StringBuilder();
            t.Append("riga ").Append(r.Numero.ToString(Cultura.INV)).Append(" · ").Append(stato);
            if (r.Critica) t.Append(" · critica");
            t.Append(" · ").Append(Cultura.Secondi(r.Secondi)).Append(" di attenzione su ").Append(Cultura.Secondi(r.Soglia)).Append(" richiesti");
            if (r.Secondi > 0)
            {
                t.Append(" · ").Append(Cultura.Plurale(r.Sessioni, "sessione", "sessioni"));
                t.Append(" · ultima: ").Append(Cultura.Data(r.Ultima));
                t.Append(" · origine: ").Append(r.Origine);
            }
            return t.ToString();
        }

        public static void Scrivi(Analisi an, string percorso)
        {
            StringBuilder h = new StringBuilder(64 * 1024);
            DateTime ora = DateTime.Now;
            string nomeProgetto = Path.GetFileName(an.Progetto.Radice.TrimEnd('\\'));
            int crit = an.CriticheNonLette;
            int righeTotali = an.File.Sum(f => f.Righe.Count);

            h.Append("<!doctype html>\n<html lang=\"it\">\n<head>\n<meta charset=\"utf-8\">\n");
            h.Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
            h.Append("<meta name=\"color-scheme\" content=\"light dark\">\n");
            h.Append("<title>Sguardo · ").Append(E(nomeProgetto)).Append("</title>\n<style>").Append(Stile).Append("</style>\n</head>\n<body>\n<div class=\"pagina\">\n");

            // Intestazione
            h.Append("<header class=\"testa\">").Append(Occhio).Append("<h1>Chi ha letto questo codice?</h1></header>\n");
            h.Append("<p class=\"sotto\">Sguardo · rapporto di attenzione umana · <strong>").Append(E(nomeProgetto)).Append("</strong> · ")
             .Append(E(ora.ToString("d MMMM yyyy, HH:mm", Cultura.IT))).Append("<br>").Append(E(an.Cartella)).Append("</p>\n");

            // Esito della verifica
            if (an.Critiche == 0)
                h.Append("<div class=\"esito si\"><span class=\"punto\"></span><div><strong>Nessuna riga critica in questi file.</strong> La verifica non ha nulla da controllare.</div></div>\n");
            else if (crit > 0)
                h.Append("<div class=\"esito no\"><span class=\"punto\"></span><div><strong>La verifica non passa: ")
                 .Append(crit == 1 ? "1 riga critica non è stata letta" : crit.ToString(Cultura.INV) + " righe critiche non sono state lette")
                 .Append(" da un umano.</strong><br>Qualcuno le ha scritte (forse un'IA), ma nessuno le ha ancora guardate con attenzione. Sono evidenziate in rosso qui sotto.</div></div>\n");
            else
                h.Append("<div class=\"esito si\"><span class=\"punto\"></span><div><strong>La verifica passa: tutte le ")
                 .Append(an.Critiche.ToString(Cultura.INV)).Append(" righe critiche sono state lette da un umano.</strong></div></div>\n");
            if (an.Simulati > 0.001)
            {
                double quota = an.Secondi <= 0 ? 0 : an.Simulati / an.Secondi;
                h.Append("<p class=\"nota\">Nota: il ").Append(Cultura.Percento(quota))
                 .Append(" dell'attenzione registrata è <strong>simulata</strong> (sguardo simula o autotest), non letta da una persona. In CI usa <code>--solo-letture</code>.</p>\n");
            }
            if (an.SoloLetture)
                h.Append("<p class=\"nota\">Rapporto con <code>--solo-letture</code>: l'attenzione simulata non conta.</p>\n");

            // Schede
            int ia = an.File.Count(f => f.IA);
            h.Append("<div class=\"schede\">\n");
            h.Append("<div class=\"scheda\"><b>").Append(Cultura.Percento(an.Frazione)).Append("</b><span>delle righe lette da un umano</span>")
             .Append("<div class=\"metro\"><i style=\"width:").Append(N(Math.Floor(an.Frazione * 1000) / 10)).Append("%\"></i></div>")
             .Append("<span>").Append(an.Lette.ToString(Cultura.INV)).Append(" su ").Append(an.Significative.ToString(Cultura.INV)).Append(" righe non vuote</span></div>\n");
            h.Append("<div class=\"scheda\"><b>").Append(an.Mai.ToString(Cultura.INV)).Append("</b><span>")
             .Append(an.Mai == 1 ? "riga mai letta" : "righe mai lette").Append("</span><br><span>")
             .Append(Cultura.Plurale(an.Sfiorate, "altra solo sfiorata", "altre solo sfiorate")).Append("</span></div>\n");
            h.Append("<div class=\"scheda ").Append(crit > 0 ? "rossa" : "verde").Append("\"><b>").Append(crit.ToString(Cultura.INV)).Append("</b><span>")
             .Append(crit == 1 ? "riga critica non letta" : "righe critiche non lette").Append("</span><br><span>su ")
             .Append(Cultura.Plurale(an.Critiche, "riga critica", "righe critiche")).Append("</span></div>\n");
            h.Append("<div class=\"scheda\"><b>").Append(an.File.Count.ToString(Cultura.INV)).Append("</b><span>")
             .Append(an.File.Count == 1 ? "file" : "file").Append(" sorgente</span><br><span>")
             .Append(ia == 0 ? "nessuno dichiarato scritto dall'IA" : (ia == 1 ? "1 dichiarato scritto dall'IA" : ia.ToString(Cultura.INV) + " dichiarati scritti dall'IA"))
             .Append("</span></div>\n");
            h.Append("<div class=\"scheda\"><b>").Append(E(Cultura.Secondi(an.Secondi))).Append("</b><span>di attenzione registrata</span><br><span>")
             .Append(an.Simulati > 0.001 ? "di cui simulata: " + Cultura.Percento(an.Secondi <= 0 ? 0 : an.Simulati / an.Secondi) : "tutta da letture vere")
             .Append("</span></div>\n");
            h.Append("</div>\n");

            // Tabella dei file
            h.Append("<h3>File</h3>\n<div class=\"contenitore\"><table>\n<thead><tr><th>File</th><th class=\"num\">Righe</th><th class=\"num\">Lette</th>")
             .Append("<th class=\"col-imp\">Impronta dell'attenzione</th><th class=\"col-nl\">Non lette</th><th class=\"num\">Critiche non lette</th></tr></thead>\n<tbody>\n");
            for (int i = 0; i < an.File.Count; i++)
            {
                FileAnalizzato f = an.File[i];
                int cf = f.CriticheNonLette.Count;
                string nl = FileAnalizzato.Descrivi(f.IntervalliNonLette());
                h.Append("<tr").Append(cf > 0 ? " class=\"critico\"" : "").Append("><td><a href=\"#f").Append(i.ToString(Cultura.INV)).Append("\">")
                 .Append(E(f.Relativo.Replace('\\', '/'))).Append("</a>");
                if (f.IA) h.Append("<span class=\"badge ia\">IA</span>");
                h.Append("</td><td class=\"num\">").Append(f.NumSignificative.ToString(Cultura.INV)).Append("</td>");
                h.Append("<td class=\"num\"><strong>").Append(Cultura.Percento(f.Frazione)).Append("</strong></td>");
                h.Append("<td class=\"col-imp\">").Append(Striscia(f)).Append("</td>");
                h.Append("<td class=\"col-nl tenue\">").Append(nl.Length == 0 ? "—" : E(Accorcia(nl, 40))).Append("</td>");
                h.Append("<td class=\"num").Append(cf > 0 ? " rosso" : " tenue").Append("\">").Append(cf > 0 ? cf.ToString(Cultura.INV) : "—").Append("</td></tr>\n");
            }
            h.Append("</tbody></table></div>\n");

            // Mappa di calore
            h.Append("<h3>Mappa di calore del codice</h3>\n<div class=\"legenda\">")
             .Append("<span><i style=\"background:rgba(var(--verde),.9)\"></i>letta (più intensa = più attenzione)</span>")
             .Append("<span><i style=\"background:rgba(var(--verde),.3)\"></i>sfiorata</span>")
             .Append("<span><i style=\"background:var(--grigio)\"></i>mai letta, in ombra</span>")
             .Append("<span><i style=\"background:var(--rosso)\"></i>critica non letta</span>")
             .Append("<span>passa il mouse su una riga per i dettagli</span></div>\n");

            bool apriTutti = righeTotali <= 3000;
            for (int i = 0; i < an.File.Count; i++)
            {
                FileAnalizzato f = an.File[i];
                List<RigaCodice> cnl = f.CriticheNonLette;
                bool completo = f.NumLette == f.NumSignificative;
                string id = "f" + i.ToString(Cultura.INV);
                h.Append("<details class=\"file").Append(cnl.Count > 0 ? " critico" : "").Append("\" id=\"").Append(id).Append("\"")
                 .Append(apriTutti || !completo ? " open" : "").Append(">\n<summary><h2>").Append(E(f.Relativo.Replace('\\', '/'))).Append("</h2>");
                if (f.IA) h.Append("<span class=\"badge ia\">scritto dall'IA</span>");
                if (cnl.Count > 0) h.Append("<span class=\"badge crit\">").Append(Cultura.Plurale(cnl.Count, "riga critica non letta", "righe critiche non lette")).Append("</span>");
                else if (completo && f.NumSignificative > 0) h.Append("<span class=\"badge ok\">letto tutto</span>");
                string nl = FileAnalizzato.Descrivi(f.IntervalliNonLette());
                h.Append("<span class=\"meta\">").Append(Cultura.Plurale(f.NumSignificative, "riga", "righe")).Append(" · ")
                 .Append(Cultura.Percento(f.Frazione)).Append(" lette · ").Append(E(Cultura.Secondi(f.SecondiTotali))).Append(" di attenzione");
                if (nl.Length > 0) h.Append(" · non lette: ").Append(E(nl));
                h.Append("</span></summary>\n");
                if (cnl.Count > 0)
                {
                    h.Append("<div class=\"avviso\">Righe critiche da leggere: ");
                    for (int k = 0; k < cnl.Count; k++)
                    {
                        if (k > 0) h.Append(", ");
                        h.Append("<a href=\"#").Append(id).Append("-").Append(cnl[k].Numero.ToString(Cultura.INV)).Append("\">")
                         .Append(cnl[k].Numero.ToString(Cultura.INV)).Append("</a>");
                    }
                    h.Append("</div>\n");
                }
                h.Append("<div class=\"codice\"><div class=\"righe\">\n");
                Evidenziatore ev = new Evidenziatore(f.Estensione);
                foreach (RigaCodice r in f.Righe)
                {
                    string testo = Impronte.EspandiTab(r.Testo);
                    List<Token> token = ev.Riga(testo);
                    string num = r.Numero.ToString(Cultura.INV);
                    if (r.Vuota)
                    {
                        h.Append("<div class=\"r\" id=\"").Append(id).Append("-").Append(num).Append("\"><i class=\"m\"></i><i class=\"x\"></i><span class=\"n\">")
                         .Append(num).Append("</span><code></code></div>\n");
                        continue;
                    }
                    StatoRiga st = r.Stato();
                    string classe = st == StatoRiga.Letta ? "letta" : st == StatoRiga.Sfiorata ? "sfiorata" : "mai";
                    bool nonLetta = st != StatoRiga.Letta;
                    if (r.Critica) classe += nonLetta ? " crit nl" : " crit";
                    h.Append("<div class=\"r ").Append(classe).Append("\" id=\"").Append(id).Append("-").Append(num).Append("\"");
                    if (st == StatoRiga.Letta) h.Append(" style=\"--a:").Append(N(Intensita(r))).Append("\"");
                    else if (st == StatoRiga.Sfiorata) h.Append(" style=\"--a:").Append(N(Math.Min(1, r.Secondi / r.Soglia))).Append("\"");
                    h.Append(" title=\"").Append(E(Titolo(r))).Append("\"><i class=\"m\"></i><i class=\"x\">")
                     .Append(r.Critica && nonLetta ? "!" : "").Append("</i><span class=\"n\">").Append(num).Append("</span><code>");
                    foreach (Token t in token)
                    {
                        string c = null;
                        switch (t.Tipo)
                        {
                            case TipoToken.Chiave: c = "k"; break;
                            case TipoToken.Stringa: c = "s"; break;
                            case TipoToken.Commento: c = "c"; break;
                            case TipoToken.Numero: c = "d"; break;
                        }
                        if (c == null) h.Append(E(t.Testo));
                        else h.Append("<span class=\"").Append(c).Append("\">").Append(E(t.Testo)).Append("</span>");
                    }
                    h.Append("</code></div>\n");
                }
                h.Append("</div></div>\n</details>\n");
            }

            // Piede
            h.Append("<footer><p>Una riga conta come <strong>letta</strong> quando l'attenzione accumulata raggiunge ")
             .Append(E(an.Progetto.Regole.DescriviSoglia())).Append(" (caratteri non spazio). Righe critiche: <code>")
             .Append(E(an.Progetto.Regole.Critiche)).Append("</code> (da <code>.sguardo\\regole.json</code>).</p>")
             .Append("<p>Sguardo misura le righe, non le persone: nei dati non c'è nessun nome, solo tempi aggregati per riga. ")
             .Append("È un'euristica (finestra attiva, attività recente, vicinanza del puntatore), non eye tracking.</p>")
             .Append("<p>Generato da Sguardo il ").Append(E(ora.ToString("d MMMM yyyy 'alle' HH:mm", Cultura.IT))).Append(".</p></footer>\n");
            h.Append("</div>\n</body>\n</html>\n");

            string cartella = Path.GetDirectoryName(Path.GetFullPath(percorso));
            if (!string.IsNullOrEmpty(cartella)) Directory.CreateDirectory(cartella);
            File.WriteAllText(percorso, h.ToString(), new UTF8Encoding(false));
        }

        static string Accorcia(string s, int max)
        {
            return s.Length <= max ? s : s.Substring(0, max - 1) + "…";
        }
    }
}
