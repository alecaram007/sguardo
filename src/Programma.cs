// SGUARDO - chi ha letto davvero questo codice?
// Registra quali righe sono state lette da un essere umano, e per quanto.
//
// Uso:  sguardo <comando> [argomenti]        (sguardo aiuto)
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Sguardo
{
    class Argomenti
    {
        static readonly HashSet<string> ConValore = new HashSet<string> { "autotest", "schermata", "html" };
        public string Comando = "";
        public List<string> Posizionali = new List<string>();
        readonly Dictionary<string, string> opzioni = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public Argomenti(string[] args)
        {
            int i = 0;
            if (args.Length > 0) { Comando = args[0].ToLowerInvariant(); i = 1; }
            for (; i < args.Length; i++)
            {
                string a = args[i];
                if (a.StartsWith("--") && a.Length > 2)
                {
                    string nome = a.Substring(2).ToLowerInvariant();
                    if (ConValore.Contains(nome))
                    {
                        if (i + 1 >= args.Length) throw new Errore("L'opzione --" + nome + " vuole un valore.");
                        opzioni[nome] = args[++i];
                    }
                    else opzioni[nome] = "";
                }
                else Posizionali.Add(a);
            }
        }

        public string Pos(int i) { return i < Posizionali.Count ? Posizionali[i] : null; }
        public bool Ha(string nome) { return opzioni.ContainsKey(nome); }
        public string Opz(string nome) { string v; return opzioni.TryGetValue(nome, out v) ? v : null; }

        public void SoloQueste(params string[] ammesse)
        {
            foreach (string k in opzioni.Keys)
                if (!ammesse.Contains(k)) throw new Errore("Opzione sconosciuta per '" + Comando + "': --" + k);
        }
    }

    static class Programma
    {
        // --- console --------------------------------------------------------
        static void W(string testo, ConsoleColor colore)
        {
            ConsoleColor prima = Console.ForegroundColor;
            Console.ForegroundColor = colore;
            Console.Write(testo);
            Console.ForegroundColor = prima;
        }

        static void WL(string testo, ConsoleColor colore)
        {
            W(testo, colore);
            Console.WriteLine();
        }

        static void WL(string testo)
        {
            Console.WriteLine(testo);
        }

        static string Taglia(string s, int max)
        {
            if (s.Length <= max) return s;
            return s.Substring(0, Math.Max(1, max - 1)) + "…";
        }

        [STAThread]
        static int Main(string[] args)
        {
            try { Console.OutputEncoding = new UTF8Encoding(false); } catch (Exception) { }
            try
            {
                Argomenti a = new Argomenti(args);
                switch (a.Comando)
                {
                    case "init": return Init(a);
                    case "leggi": return Leggi(a);
                    case "rapporto": return Rapporto(a);
                    case "verifica": return Verifica(a);
                    case "simula": return Simula(a);
                    case "mostra": return Mostra(a);
                    case "righe": return Righe(a);
                    case "": case "aiuto": case "help": case "-h": case "--help": case "/?":
                        Aiuto();
                        return 0;
                    default:
                        throw new Errore("Comando sconosciuto: '" + a.Comando + "'. Scrivi:  sguardo aiuto");
                }
            }
            catch (Errore e)
            {
                Console.Out.Flush();
                Console.Error.WriteLine("  Errore: " + e.Message);
                return 2;
            }
            catch (Exception e)
            {
                Console.Out.Flush();
                Console.Error.WriteLine("  Errore inatteso (" + e.GetType().Name + "): " + e.Message);
                return 2;
            }
        }

        // --- init -----------------------------------------------------------
        static int Init(Argomenti a)
        {
            a.SoloQueste();
            bool esisteva;
            Progetto p = Progetto.Inizializza(a.Pos(0), out esisteva);
            Console.WriteLine();
            if (esisteva)
            {
                WL("  Sguardo è già attivo in " + p.Radice + ". Non ho toccato nulla.", ConsoleColor.White);
                return 0;
            }
            WL("  Sguardo è attivo in " + p.Radice, ConsoleColor.White);
            WL("  .sguardo\\regole.json    righe critiche, soglia di lettura, estensioni (modificabile)", ConsoleColor.DarkGray);
            WL("  .sguardo\\letture\\       un JSON per file: impronta della riga → secondi di attenzione", ConsoleColor.DarkGray);
            WL("  Nessun nome viene salvato: solo tempi aggregati per riga.", ConsoleColor.DarkGray);
            WL("  Per leggere un file:  sguardo leggi <file>");
            return 0;
        }

        static Progetto ProgettoDelFile(string file)
        {
            if (file == null) throw new Errore("Manca il file.");
            string pieno = Path.GetFullPath(file);
            if (!File.Exists(pieno)) throw new Errore("Il file '" + pieno + "' non esiste.");
            return Progetto.Trova(Path.GetDirectoryName(pieno));
        }

        // --- leggi ----------------------------------------------------------
        static int Leggi(Argomenti a)
        {
            a.SoloQueste("autotest", "schermata");
            if (a.Pos(0) == null) throw new Errore("Quale file? Uso:  sguardo leggi <file> [--autotest <secondi> --schermata <png>]");
            Progetto p = ProgettoDelFile(a.Pos(0));
            double autotest = 0;
            if (a.Opz("autotest") != null)
            {
                autotest = Cultura.LeggiNumero(a.Opz("autotest"));
                if (autotest <= 0 || autotest > 600) throw new Errore("--autotest vuole un numero di secondi tra 0 e 600.");
            }
            string schermata = a.Opz("schermata");
            if (schermata != null && autotest <= 0) throw new Errore("--schermata si usa insieme a --autotest.");
            string rel = p.Relativo(a.Pos(0));

            Console.WriteLine();
            if (autotest > 0)
            {
                WL("  Autotest del lettore: apro " + rel + " per " + Cultura.Secondi(autotest) + ", scorro da solo e mi chiudo.", ConsoleColor.White);
                WL("  L'attività è simulata (il mouse vero non viene toccato) e viene registrata come «simulazione».", ConsoleColor.DarkGray);
            }
            else
            {
                WL("  Apro " + rel + " nel lettore di Sguardo.", ConsoleColor.White);
                WL("  Registro solo mentre la finestra è attiva e la usi (mouse, rotella, tasti). Esc per chiudere.", ConsoleColor.DarkGray);
            }

            EsitoLettura e = Lettore.Apri(p, a.Pos(0), autotest, schermata);

            Console.WriteLine();
            W("  Sessione: ", ConsoleColor.Gray);
            W(Cultura.Secondi(e.Attenzione) + " di attenzione", ConsoleColor.White);
            WL(" su " + Cultura.Plurale(e.RigheToccate, "riga", "righe") + " · origine «" + (e.Simulata ? "simulazione" : "lettura") + "»", ConsoleColor.Gray);
            W("  Righe lette: " + Cultura.Percento(e.FrazionePrima) + " → ", ConsoleColor.Gray);
            W(Cultura.Percento(e.FrazioneDopo), ConsoleColor.White);
            W(" · ", ConsoleColor.Gray);
            if (e.CriticheNonLette > 0) WL(Cultura.Plurale(e.CriticheNonLette, "riga critica non letta", "righe critiche non lette"), ConsoleColor.Red);
            else WL("nessuna riga critica da leggere", ConsoleColor.Green);
            WL("  Dati: " + e.PercorsoDati, ConsoleColor.DarkGray);
            if (e.Schermata != null) WL("  Schermata della finestra: " + e.Schermata, ConsoleColor.Cyan);
            if (e.Errore != null) { Console.Error.WriteLine("  Errore: " + e.Errore); return 2; }
            return 0;
        }

        // --- rapporto -------------------------------------------------------
        static void Barra(double frazione, int celle)
        {
            int piene = (int)Math.Round(frazione * celle);
            if (piene == celle && frazione < 1) piene = celle - 1;
            if (piene == 0 && frazione > 0) piene = 1;
            W(new string('█', piene), ConsoleColor.Green);
            W(new string('░', celle - piene), ConsoleColor.DarkGray);
        }

        static void Intestazione(Analisi an, string titolo)
        {
            Console.WriteLine();
            WL("  " + titolo, ConsoleColor.White);
            WL("  progetto  " + an.Progetto.Radice, ConsoleColor.DarkGray);
            if (!string.Equals(an.Cartella.TrimEnd('\\'), an.Progetto.Radice.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                WL("  cartella  " + an.Cartella, ConsoleColor.DarkGray);
            WL("  soglia    una riga è letta con almeno " + an.Progetto.Regole.DescriviSoglia() + " di attenzione", ConsoleColor.DarkGray);
            if (an.SoloLetture) WL("  --solo-letture: l'attenzione simulata non conta", ConsoleColor.DarkYellow);
        }

        static string DescriviStato(RigaCodice r)
        {
            return r.Stato() == StatoRiga.Sfiorata
                ? "sfiorata, " + Cultura.Secondi(r.Secondi).Replace(" s", "") + " su " + Cultura.Secondi(r.Soglia)
                : "mai letta";
        }

        static void ElencoCritiche(List<KeyValuePair<FileAnalizzato, RigaCodice>> righe, int massimo)
        {
            int larghezza = righe.Count == 0 ? 0 : righe.Max(x => (x.Key.Relativo + ":" + x.Value.Numero).Length);
            int lStato = righe.Count == 0 ? 0 : righe.Max(x => DescriviStato(x.Value).Length);
            int n = 0;
            foreach (KeyValuePair<FileAnalizzato, RigaCodice> kv in righe)
            {
                if (++n > massimo) { WL("    … e altre " + (righe.Count - massimo) + ".", ConsoleColor.DarkGray); break; }
                string dove = kv.Key.Relativo + ":" + kv.Value.Numero.ToString(Cultura.INV);
                W("    " + dove.PadRight(larghezza + 2), ConsoleColor.White);
                StatoRiga st = kv.Value.Stato();
                W(DescriviStato(kv.Value).PadRight(lStato) + "   ", st == StatoRiga.Sfiorata ? ConsoleColor.DarkYellow : ConsoleColor.Red);
                WL(Taglia(Impronte.Normalizza(kv.Value.Testo), 72), ConsoleColor.Gray);
            }
        }

        // Percorso da scrivere nel terminale: relativo alla cartella corrente se possibile.
        static string PerIlTerminale(string percorso)
        {
            string pieno = Path.GetFullPath(percorso);
            string qui = Directory.GetCurrentDirectory().TrimEnd('\\') + "\\";
            return pieno.StartsWith(qui, StringComparison.OrdinalIgnoreCase) ? pieno.Substring(qui.Length) : pieno;
        }

        static string QuotaSimulata(Analisi an)
        {
            return Cultura.Percento(an.Secondi <= 0 ? 0 : an.Simulati / an.Secondi);
        }

        static List<KeyValuePair<FileAnalizzato, RigaCodice>> CriticheNonLette(Analisi an)
        {
            List<KeyValuePair<FileAnalizzato, RigaCodice>> r = new List<KeyValuePair<FileAnalizzato, RigaCodice>>();
            foreach (FileAnalizzato f in an.File)
                foreach (RigaCodice riga in f.CriticheNonLette)
                    r.Add(new KeyValuePair<FileAnalizzato, RigaCodice>(f, riga));
            return r;
        }

        static int Rapporto(Argomenti a)
        {
            a.SoloQueste("html", "solo-letture");
            Analisi an = Analisi.Esegui(a.Pos(0), a.Ha("solo-letture"));
            string html = Path.GetFullPath(a.Opz("html") ?? Path.Combine(an.Progetto.Radice, "sguardo-rapporto.html"));
            Intestazione(an, "SGUARDO · chi ha letto davvero questo codice?");
            Console.WriteLine();
            if (an.File.Count == 0)
            {
                WL("  Nessun file sorgente qui (estensioni in .sguardo\\regole.json).", ConsoleColor.DarkGray);
            }
            else
            {
                int lNome = Math.Min(40, Math.Max(16, an.File.Max(f => f.Relativo.Length + (f.IA ? 4 : 0)) + 2));
                WL("  " + "FILE".PadRight(lNome) + "RIGHE   LETTE              NON LETTE             CRITICHE NON LETTE", ConsoleColor.DarkGray);
                foreach (FileAnalizzato f in an.File)
                {
                    string nome = Taglia(f.Relativo, lNome - (f.IA ? 6 : 2));
                    W("  " + nome, ConsoleColor.White);
                    int usati = nome.Length;
                    if (f.IA) { W("  IA", ConsoleColor.Magenta); usati += 4; }
                    W(new string(' ', Math.Max(1, lNome - usati)), ConsoleColor.Gray);
                    W(f.NumSignificative.ToString(Cultura.INV).PadLeft(5) + "   ", ConsoleColor.Gray);
                    Barra(f.Frazione, 10);
                    W(Cultura.Percento(f.Frazione).PadLeft(5) + "    ", ConsoleColor.White);
                    string nl = FileAnalizzato.Descrivi(f.IntervalliNonLette());
                    W(Taglia(nl.Length == 0 ? "—" : nl, 20).PadRight(22), nl.Length == 0 ? ConsoleColor.DarkGray : ConsoleColor.DarkYellow);
                    int c = f.CriticheNonLette.Count;
                    WL(c == 0 ? "—" : c.ToString(Cultura.INV), c == 0 ? ConsoleColor.DarkGray : ConsoleColor.Red);
                }
                Console.WriteLine();
                W("  Totale: ", ConsoleColor.Gray);
                W(an.Lette + " righe su " + an.Significative + " lette da un umano (" + Cultura.Percento(an.Frazione) + ")", ConsoleColor.White);
                W(" · " + an.Mai + " mai lette", ConsoleColor.Gray);
                if (an.Sfiorate > 0) W(" · " + Cultura.Plurale(an.Sfiorate, "sfiorata", "sfiorate"), ConsoleColor.Gray);
                Console.WriteLine();
                W("  Critiche: ", ConsoleColor.Gray);
                int crit = an.CriticheNonLette;
                if (crit > 0) WL(Cultura.Plurale(crit, "riga critica non letta", "righe critiche non lette") + " su " + an.Critiche, ConsoleColor.Red);
                else WL(an.Critiche == 0 ? "nessuna riga critica" : "tutte le " + an.Critiche + " righe critiche sono state lette", ConsoleColor.Green);
                if (an.Simulati > 0.001 && !an.SoloLetture)
                    WL("  Nota: il " + QuotaSimulata(an) + " dell'attenzione registrata è simulata (sguardo simula / autotest).", ConsoleColor.DarkYellow);
                if (crit > 0)
                {
                    Console.WriteLine();
                    WL("  Righe critiche non lette", ConsoleColor.White);
                    ElencoCritiche(CriticheNonLette(an), 30);
                }
            }
            RapportoHtml.Scrivi(an, html);
            Console.WriteLine();
            WL("  Rapporto HTML: " + html, ConsoleColor.Cyan);
            return 0;
        }

        // --- verifica -------------------------------------------------------
        static int Verifica(Argomenti a)
        {
            a.SoloQueste("solo-letture");
            Analisi an = Analisi.Esegui(a.Pos(0), a.Ha("solo-letture"));
            Console.WriteLine();
            WL("  SGUARDO · verifica", ConsoleColor.White);
            WL("  progetto  " + an.Progetto.Radice, ConsoleColor.DarkGray);
            WL("  regole    .sguardo\\regole.json · soglia " + an.Progetto.Regole.DescriviSoglia(), ConsoleColor.DarkGray);
            WL("  controllo " + Cultura.Plurale(an.Critiche, "riga critica", "righe critiche") + " in " + Cultura.Plurale(an.File.Count, "file", "file") +
               (an.SoloLetture ? " · --solo-letture: l'attenzione simulata non conta" : ""), ConsoleColor.DarkGray);
            Console.WriteLine();
            List<KeyValuePair<FileAnalizzato, RigaCodice>> nonLette = CriticheNonLette(an);
            if (nonLette.Count == 0)
            {
                if (an.Critiche == 0) WL("  PASSA   nessuna riga critica da controllare.", ConsoleColor.Green);
                else WL("  PASSA   " + (an.Critiche == 1 ? "l'unica riga critica è stata letta" : "tutte le " + an.Critiche + " righe critiche sono state lette") + " da un umano.", ConsoleColor.Green);
                if (an.Simulati > 0.001 && !an.SoloLetture)
                    WL("          attenzione: il " + QuotaSimulata(an) + " dell'attenzione è simulata. In una CI vera usa --solo-letture.", ConsoleColor.DarkYellow);
                return 0;
            }
            WL("  NON PASSA   " + (nonLette.Count == 1 ? "1 riga critica non è stata letta" : nonLette.Count + " righe critiche non sono state lette") + " da un umano:", ConsoleColor.Red);
            ElencoCritiche(nonLette, 50);
            Console.WriteLine();
            string primo = PerIlTerminale(nonLette[0].Key.Percorso);
            if (primo.IndexOf(' ') >= 0) primo = "\"" + primo + "\"";
            WL("  Qualcuno deve leggerle prima del merge:  sguardo leggi " + primo, ConsoleColor.DarkGray);
            return 1;
        }

        // --- simula ---------------------------------------------------------
        static List<int[]> Intervalli(string testo)
        {
            List<int[]> r = new List<int[]>();
            foreach (string parte in (testo ?? "").Split(new char[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                string[] ab = parte.Trim().Split('-');
                int da, a;
                if (ab.Length == 1 && int.TryParse(ab[0], out da)) a = da;
                else if (ab.Length == 2 && int.TryParse(ab[0], out da) && int.TryParse(ab[1], out a)) { }
                else throw new Errore("Intervallo non valido: '" + parte + "'. Esempi: 12  oppure  18-31  oppure  1-10,15-20");
                if (da < 1 || a < da) throw new Errore("Intervallo non valido: '" + parte + "'.");
                r.Add(new int[] { da, a });
            }
            if (r.Count == 0) throw new Errore("Manca l'intervallo di righe (es. 18-31).");
            return r;
        }

        static int Simula(Argomenti a)
        {
            a.SoloQueste();
            if (a.Posizionali.Count < 3) throw new Errore("Uso:  sguardo simula <file> <da>-<a> <secondi>   (es. sguardo simula app.js 18-31 40)");
            Progetto p = ProgettoDelFile(a.Pos(0));
            // L'ultimo argomento sono i secondi; in mezzo uno o più intervalli.
            string testoIntervalli = string.Join(",", a.Posizionali.Skip(1).Take(a.Posizionali.Count - 2));
            List<int[]> intervalli = Intervalli(testoIntervalli);
            double secondi = Cultura.LeggiNumero(a.Posizionali[a.Posizionali.Count - 1]);
            if (secondi <= 0) throw new Errore("Servono più di 0 secondi.");
            FileAnalizzato f = FileAnalizzato.Analizza(p, a.Pos(0), false);
            List<RigaCodice> righe = f.Righe.Where(r => !r.Vuota && intervalli.Any(x => r.Numero >= x[0] && r.Numero <= x[1])).ToList();
            if (righe.Count == 0) throw new Errore("Nessuna riga non vuota in " + a.Pos(1) + " (il file ha " + f.Righe.Count + " righe).");
            // Come un lettore che legge tutto il blocco con la stessa cura: ogni riga
            // riceve una quota proporzionale alla propria soglia (cioè alla lunghezza).
            double somma = righe.Sum(r => r.Soglia);
            Registro reg = Registro.Carica(f.PercorsoDati, f.Relativo);
            string oggi = Cultura.Oggi();
            foreach (RigaCodice r in righe) reg.Aggiungi(r.Impronta, secondi * r.Soglia / somma, true, true, oggi);
            reg.Salva(f.PercorsoDati);

            FileAnalizzato dopo = FileAnalizzato.Analizza(p, a.Pos(0), false);
            HashSet<int> numeri = new HashSet<int>(righe.Select(r => r.Numero));
            int lette = dopo.Righe.Count(r => numeri.Contains(r.Numero) && r.Stato() == StatoRiga.Letta);
            W("  simula  ", ConsoleColor.DarkYellow);
            W(f.Relativo + " righe " + a.Pos(1), ConsoleColor.White);
            WL(": " + Cultura.Secondi(secondi) + " su " + Cultura.Plurale(righe.Count, "riga", "righe") +
               " (per leggerle tutte ne servono " + Cultura.Secondi(somma) + ")", ConsoleColor.Gray);
            WL("          lette " + lette + " su " + righe.Count + " · file: " + Cultura.Percento(dopo.Frazione) + " letto · registrato come «simulazione»", ConsoleColor.DarkGray);
            return 0;
        }

        // --- mostra ---------------------------------------------------------
        static int Mostra(Argomenti a)
        {
            a.SoloQueste("solo-letture");
            Progetto p = ProgettoDelFile(a.Pos(0));
            FileAnalizzato f = FileAnalizzato.Analizza(p, a.Pos(0), a.Ha("solo-letture"));
            // PowerShell spezza "1-5,21-32" in due argomenti: li riunisco.
            List<int[]> intervalli = a.Pos(1) == null ? new List<int[]> { new int[] { 1, int.MaxValue } }
                : Intervalli(string.Join(",", a.Posizionali.Skip(1)));
            Console.WriteLine();
            W("  " + f.Relativo, ConsoleColor.White);
            if (f.IA) W(" · scritto dall'IA", ConsoleColor.Magenta);
            W(" · " + Cultura.Percento(f.Frazione) + " lette · ", ConsoleColor.Gray);
            int c = f.CriticheNonLette.Count;
            if (c > 0) WL(Cultura.Plurale(c, "riga critica non letta", "righe critiche non lette"), ConsoleColor.Red);
            else WL("nessuna riga critica da leggere", ConsoleColor.Green);
            Console.WriteLine();
            int cifre = Math.Max(3, f.Righe.Count.ToString(Cultura.INV).Length);
            foreach (RigaCodice r in f.Righe)
            {
                if (!intervalli.Any(x => r.Numero >= x[0] && r.Numero <= x[1])) continue;
                StatoRiga st = r.Stato();
                W("  " + r.Numero.ToString(Cultura.INV).PadLeft(cifre) + "  ", ConsoleColor.DarkGray);
                switch (st)
                {
                    case StatoRiga.Letta: W("██", ConsoleColor.Green); break;
                    case StatoRiga.Sfiorata: W("▒▒", ConsoleColor.DarkYellow); break;
                    case StatoRiga.Mai: W("░░", ConsoleColor.DarkGray); break;
                    default: W("  ", ConsoleColor.DarkGray); break;
                }
                bool criticaDaLeggere = r.Critica && st != StatoRiga.Letta;
                W(criticaDaLeggere ? " ! " : "   ", ConsoleColor.Red);
                string testo = Taglia(Impronte.EspandiTab(r.Testo), 96);
                WL(testo, st == StatoRiga.Letta ? ConsoleColor.Gray : (criticaDaLeggere ? ConsoleColor.DarkRed : ConsoleColor.DarkGray));
            }
            Console.WriteLine();
            W("  ", ConsoleColor.Gray); W("██", ConsoleColor.Green); W(" letta   ", ConsoleColor.DarkGray);
            W("▒▒", ConsoleColor.DarkYellow); W(" sfiorata   ", ConsoleColor.DarkGray);
            W("░░", ConsoleColor.DarkGray); W(" mai letta   ", ConsoleColor.DarkGray);
            W("!", ConsoleColor.Red); WL(" critica non letta", ConsoleColor.DarkGray);
            return 0;
        }

        // --- righe (dati grezzi per script e test) ----------------------------
        static int Righe(Argomenti a)
        {
            a.SoloQueste("solo-letture");
            Progetto p = ProgettoDelFile(a.Pos(0));
            FileAnalizzato f = FileAnalizzato.Analizza(p, a.Pos(0), a.Ha("solo-letture"));
            Console.WriteLine("# numero\tstato\tsecondi\tsoglia\tcritica\torigine\tsessioni\timpronta\ttesto");
            foreach (RigaCodice r in f.Righe)
            {
                StatoRiga st = r.Stato();
                string stato = st == StatoRiga.Letta ? "letta" : st == StatoRiga.Sfiorata ? "sfiorata" : st == StatoRiga.Mai ? "mai" : "vuota";
                Console.WriteLine(string.Join("\t", new string[] {
                    r.Numero.ToString(Cultura.INV), stato,
                    r.Secondi.ToString("0.###", Cultura.INV), r.Soglia.ToString("0.###", Cultura.INV),
                    r.Critica ? "1" : "0", r.Vuota ? "" : (r.Secondi > 0 ? r.Origine : "nessuna"),
                    r.Sessioni.ToString(Cultura.INV), r.Impronta ?? "", r.Testo.Replace("\t", " ")
                }));
            }
            return 0;
        }

        // --- aiuto ----------------------------------------------------------
        static void Aiuto()
        {
            Console.WriteLine();
            WL("  SGUARDO · chi ha letto davvero questo codice?", ConsoleColor.White);
            WL("  Registra quali righe sono state lette da un essere umano, e per quanto.", ConsoleColor.DarkGray);
            Console.WriteLine();
            WL("  sguardo init [cartella]                  attiva Sguardo in un progetto (crea .sguardo\\)");
            WL("  sguardo leggi <file>                     apre il lettore e registra l'attenzione");
            WL("  sguardo rapporto [cartella]              righe lette, righe mai lette, rapporto HTML");
            WL("  sguardo verifica [cartella]              per la CI: esce con 1 se una riga critica non è stata letta");
            WL("  sguardo mostra <file> [da-a]             il file in console con lo stato di ogni riga");
            WL("  sguardo simula <file> <da-a> <secondi>   registra attenzione simulata (demo e test)");
            WL("  sguardo righe <file>                     dati grezzi riga per riga (TSV, per script)");
            Console.WriteLine();
            WL("  Opzioni", ConsoleColor.White);
            WL("    --solo-letture       ignora l'attenzione simulata (rapporto, verifica, mostra, righe)");
            WL("    --html <file>        dove scrivere il rapporto HTML (predefinito: sguardo-rapporto.html nella radice)");
            WL("    --autotest <s>       (leggi) la finestra scorre da sola per <s> secondi, poi si chiude");
            WL("    --schermata <png>    (leggi --autotest) salva un'immagine della finestra");
            Console.WriteLine();
            WL("  Codici di uscita: 0 tutto bene · 1 verifica non passata · 2 errore", ConsoleColor.DarkGray);
        }
    }
}
