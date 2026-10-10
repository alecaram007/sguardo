// SGUARDO - nucleo: progetto, regole, impronte delle righe, registro dell'attenzione.
// C# 5 (csc di .NET Framework 4.8): niente interpolazione, niente ?. , niente =>.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Sguardo
{
    // -----------------------------------------------------------------------
    // Formati italiani e numeri
    // -----------------------------------------------------------------------
    static class Cultura
    {
        public static readonly CultureInfo IT = CultureInfo.GetCultureInfo("it-IT");
        public static readonly CultureInfo INV = CultureInfo.InvariantCulture;

        public static string Secondi(double s)
        {
            if (s < 0.05) return "0 s";
            if (s < 10) return s.ToString("0.0", IT) + " s";
            if (s < 60) return s.ToString("0", IT) + " s";
            int tot = (int)Math.Round(s);
            if (tot < 3600) return (tot / 60).ToString(INV) + " min " + (tot % 60).ToString(INV) + " s";
            return (tot / 3600).ToString(INV) + " h " + ((tot % 3600) / 60).ToString(INV) + " min";
        }

        public static string Numero(double v, string formato)
        {
            return v.ToString(formato, IT);
        }

        public static string Percento(double frazione)
        {
            return ((int)Math.Floor(frazione * 100 + 1e-9)).ToString(INV) + "%";
        }

        // Accetta sia "2,5" sia "2.5".
        public static double LeggiNumero(string testo)
        {
            double v;
            string t = (testo ?? "").Trim().Replace(',', '.');
            if (!double.TryParse(t, NumberStyles.Float, INV, out v) || v < 0 || double.IsInfinity(v))
                throw new Errore("'" + testo + "' non è un numero di secondi valido.");
            return v;
        }

        public static string Data(string iso)
        {
            DateTime d;
            if (string.IsNullOrEmpty(iso) || !DateTime.TryParseExact(iso, "yyyy-MM-dd", INV, DateTimeStyles.None, out d)) return "—";
            return d.ToString("d MMM yyyy", IT);
        }

        public static string Oggi()
        {
            return DateTime.Now.ToString("yyyy-MM-dd", INV);
        }

        public static string Plurale(int n, string singolare, string plurale)
        {
            return n.ToString(INV) + " " + (n == 1 ? singolare : plurale);
        }
    }

    // Errore "previsto": viene mostrato all'utente senza stack trace.
    class Errore : Exception
    {
        public Errore(string messaggio) : base(messaggio) { }
    }

    // -----------------------------------------------------------------------
    // JSON: lettura con JavaScriptSerializer, scrittura leggibile fatta a mano
    // -----------------------------------------------------------------------
    static class Json
    {
        public static object Leggi(string testo)
        {
            JavaScriptSerializer js = new JavaScriptSerializer();
            js.MaxJsonLength = int.MaxValue;
            return js.DeserializeObject(testo);
        }

        // Gli oggetti più profondi di "espansi" livelli vanno su una riga sola.
        public static string Scrivi(object valore, int espansi)
        {
            StringBuilder sb = new StringBuilder();
            Scrivi(sb, valore, 0, espansi);
            sb.Append("\n");
            return sb.ToString();
        }

        static void Scrivi(StringBuilder sb, object v, int livello, int espansi)
        {
            if (v == null) { sb.Append("null"); return; }
            if (v is string) { Stringa(sb, (string)v); return; }
            if (v is bool) { sb.Append((bool)v ? "true" : "false"); return; }
            if (v is int || v is long) { sb.Append(Convert.ToInt64(v).ToString(Cultura.INV)); return; }
            if (v is double || v is float || v is decimal)
            {
                sb.Append(Convert.ToDouble(v).ToString("0.###", Cultura.INV));
                return;
            }
            bool espandi = livello < espansi;
            string rientro = new string(' ', (livello + 1) * 2);
            string chiusura = new string(' ', livello * 2);
            IDictionary diz = v as IDictionary;
            if (diz != null)
            {
                if (diz.Count == 0) { sb.Append("{}"); return; }
                sb.Append(espandi ? "{\n" : "{");
                bool primo = true;
                foreach (DictionaryEntry kv in diz)
                {
                    if (!primo) sb.Append(espandi ? ",\n" : ", ");
                    primo = false;
                    if (espandi) sb.Append(rientro);
                    Stringa(sb, Convert.ToString(kv.Key, Cultura.INV));
                    sb.Append(": ");
                    Scrivi(sb, kv.Value, livello + 1, espansi);
                }
                sb.Append(espandi ? "\n" + chiusura + "}" : "}");
                return;
            }
            IEnumerable lista = v as IEnumerable;
            if (lista != null)
            {
                sb.Append("[");
                bool primo = true;
                foreach (object o in lista)
                {
                    if (!primo) sb.Append(", ");
                    primo = false;
                    Scrivi(sb, o, livello + 1, espansi);
                }
                sb.Append("]");
                return;
            }
            Stringa(sb, Convert.ToString(v, Cultura.INV));
        }

        static void Stringa(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", Cultura.INV));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        public static double Numero(Dictionary<string, object> o, string chiave, double predefinito)
        {
            object v;
            if (o == null || !o.TryGetValue(chiave, out v) || v == null) return predefinito;
            try { return Convert.ToDouble(v, Cultura.INV); }
            catch (Exception) { return predefinito; }
        }

        public static string Testo(Dictionary<string, object> o, string chiave, string predefinito)
        {
            object v;
            if (o == null || !o.TryGetValue(chiave, out v) || v == null) return predefinito;
            return Convert.ToString(v, Cultura.INV);
        }

        public static List<string> Elenco(Dictionary<string, object> o, string chiave, List<string> predefinito)
        {
            object v;
            if (o == null || !o.TryGetValue(chiave, out v)) return predefinito;
            object[] a = v as object[];
            if (a == null) { ArrayList al = v as ArrayList; if (al != null) a = al.ToArray(); }
            if (a == null) return predefinito;
            return a.Select(x => Convert.ToString(x, Cultura.INV)).ToList();
        }

        public static void ScriviFileAtomico(string percorso, string testo)
        {
            string cartella = Path.GetDirectoryName(percorso);
            if (!string.IsNullOrEmpty(cartella)) Directory.CreateDirectory(cartella);
            string tmp = percorso + ".tmp";
            File.WriteAllText(tmp, testo, new UTF8Encoding(false));
            if (File.Exists(percorso))
            {
                try { File.Replace(tmp, percorso, null); return; }
                catch (Exception) { }
                File.Copy(tmp, percorso, true);
                File.Delete(tmp);
            }
            else
            {
                File.Move(tmp, percorso);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Regole (.sguardo\regole.json)
    // -----------------------------------------------------------------------
    class Regole
    {
        public const string CritichePredefinite =
            "password|token|segreto|secret|pagament|payment|crypt|auth|sql|admin|delete|drop|rimbors|iban";
        public const string IAPredefinita =
            "scritt[oa] dall['’] ?IA|generat[oa] (dall['’] ?|da ?(un['’] ?)?)IA|AI[- ]generated|generated (by|with) (an? )?(AI|Copilot|ChatGPT|Claude|LLM)|@generated";

        public string Critiche = CritichePredefinite;
        public string MarcatoriIA = IAPredefinita;
        public double SogliaMinima = 0.4;
        public double SecondiPerCarattere = 0.05;
        public double Inattivita = 20;
        public List<string> Estensioni = new List<string> {
            ".cs", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".kt", ".go", ".rs", ".rb", ".php",
            ".c", ".h", ".cpp", ".hpp", ".swift", ".sql", ".ps1", ".sh", ".vb", ".fs", ".scala", ".dart", ".lua"
        };
        public List<string> Escludi = new List<string> { "bin", "obj", "node_modules", "vendor", "dist", "build", "target" };

        Regex rCritiche, rIA;

        public double Soglia(int caratteri)
        {
            return Math.Max(SogliaMinima, SecondiPerCarattere * caratteri);
        }

        public bool Critica(string riga)
        {
            if (rCritiche == null) rCritiche = Compila(Critiche, "critiche");
            return rCritiche != null && rCritiche.IsMatch(riga);
        }

        public bool DichiaraIA(string riga)
        {
            if (rIA == null) rIA = Compila(MarcatoriIA, "marcatoriIA");
            return rIA != null && rIA.IsMatch(riga);
        }

        static Regex Compila(string schema, string nome)
        {
            if (string.IsNullOrWhiteSpace(schema)) return null;
            try { return new Regex(schema, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant); }
            catch (ArgumentException e) { throw new Errore("In regole.json, '" + nome + "' non è un'espressione regolare valida: " + e.Message); }
        }

        public string DescriviSoglia()
        {
            return "max(" + Cultura.Numero(SogliaMinima, "0.###") + " s; " + Cultura.Numero(SecondiPerCarattere, "0.###") + " s × carattere)";
        }

        public static Regole Carica(string percorso)
        {
            Regole r = new Regole();
            if (!File.Exists(percorso)) return r;
            Dictionary<string, object> o;
            try { o = Json.Leggi(File.ReadAllText(percorso, Encoding.UTF8)) as Dictionary<string, object>; }
            catch (Exception e) { throw new Errore("Non riesco a leggere " + percorso + ": " + e.Message); }
            if (o == null) return r;
            r.Critiche = Json.Testo(o, "critiche", r.Critiche);
            r.MarcatoriIA = Json.Testo(o, "marcatoriIA", r.MarcatoriIA);
            r.SogliaMinima = Json.Numero(o, "sogliaMinimaSecondi", r.SogliaMinima);
            r.SecondiPerCarattere = Json.Numero(o, "secondiPerCarattere", r.SecondiPerCarattere);
            r.Inattivita = Json.Numero(o, "inattivitaSecondi", r.Inattivita);
            r.Estensioni = Json.Elenco(o, "estensioni", r.Estensioni).Select(x => x.StartsWith(".") ? x.ToLowerInvariant() : "." + x.ToLowerInvariant()).ToList();
            r.Escludi = Json.Elenco(o, "escludi", r.Escludi);
            if (r.SogliaMinima <= 0) r.SogliaMinima = 0.4;
            return r;
        }

        public void Salva(string percorso)
        {
            var o = new Dictionary<string, object>();
            o["_nota"] = "Regole di Sguardo. 'critiche' e 'marcatoriIA' sono espressioni regolari (maiuscole e minuscole indifferenti). " +
                         "Una riga è letta quando l'attenzione accumulata raggiunge max(sogliaMinimaSecondi; secondiPerCarattere × caratteri non spazio).";
            o["critiche"] = Critiche;
            o["marcatoriIA"] = MarcatoriIA;
            o["sogliaMinimaSecondi"] = SogliaMinima;
            o["secondiPerCarattere"] = SecondiPerCarattere;
            o["inattivitaSecondi"] = Inattivita;
            o["estensioni"] = Estensioni;
            o["escludi"] = Escludi;
            Json.ScriviFileAtomico(percorso, Json.Scrivi(o, 1));
        }
    }

    // -----------------------------------------------------------------------
    // Progetto: la cartella che contiene .sguardo\
    // -----------------------------------------------------------------------
    class Progetto
    {
        public const string NomeMeta = ".sguardo";
        public string Radice;
        public string Meta;
        public Regole Regole;

        public string PercorsoRegole { get { return Path.Combine(Meta, "regole.json"); } }
        public string CartellaLetture { get { return Path.Combine(Meta, "letture"); } }

        Progetto(string radice)
        {
            Radice = Path.GetFullPath(radice).TrimEnd('\\');
            if (Radice.EndsWith(":")) Radice += "\\";
            Meta = Path.Combine(Radice, NomeMeta);
        }

        public static Progetto Trova(string da)
        {
            string inizio = Path.GetFullPath(string.IsNullOrEmpty(da) ? "." : da);
            if (File.Exists(inizio)) inizio = Path.GetDirectoryName(inizio);
            if (!Directory.Exists(inizio)) throw new Errore("La cartella '" + inizio + "' non esiste.");
            DirectoryInfo d = new DirectoryInfo(inizio);
            while (d != null)
            {
                if (Directory.Exists(Path.Combine(d.FullName, NomeMeta)))
                {
                    Progetto p = new Progetto(d.FullName);
                    p.Regole = Regole.Carica(p.PercorsoRegole);
                    return p;
                }
                d = d.Parent;
            }
            throw new Errore("Nessun progetto Sguardo trovato risalendo da '" + inizio + "'. Crealo con:  sguardo init <cartella>");
        }

        public static Progetto Inizializza(string cartella, out bool esisteva)
        {
            string c = Path.GetFullPath(string.IsNullOrEmpty(cartella) ? "." : cartella);
            if (!Directory.Exists(c)) throw new Errore("La cartella '" + c + "' non esiste.");
            Progetto p = new Progetto(c);
            esisteva = Directory.Exists(p.Meta);
            Directory.CreateDirectory(p.CartellaLetture);
            if (File.Exists(p.PercorsoRegole)) p.Regole = Regole.Carica(p.PercorsoRegole);
            else { p.Regole = new Regole(); p.Regole.Salva(p.PercorsoRegole); }
            return p;
        }

        // Percorso relativo alla radice, con "\" (per mostrarlo).
        public string Relativo(string percorso)
        {
            string pieno = Path.GetFullPath(percorso);
            string base_ = Radice.EndsWith("\\") ? Radice : Radice + "\\";
            if (!pieno.StartsWith(base_, StringComparison.OrdinalIgnoreCase))
                throw new Errore("Il file '" + pieno + "' non è dentro il progetto '" + Radice + "'.");
            return pieno.Substring(base_.Length);
        }

        public string PercorsoDati(string percorso)
        {
            return Path.Combine(CartellaLetture, Relativo(percorso) + ".json");
        }

        public List<string> FileSorgente(string cartella)
        {
            List<string> risultato = new List<string>();
            Raccogli(Path.GetFullPath(cartella), risultato);
            return risultato.OrderBy(x => Relativo(x), StringComparer.OrdinalIgnoreCase).ToList();
        }

        void Raccogli(string cartella, List<string> risultato)
        {
            foreach (string f in Directory.GetFiles(cartella))
            {
                if (Regole.Estensioni.Contains(Path.GetExtension(f).ToLowerInvariant())) risultato.Add(f);
            }
            foreach (string d in Directory.GetDirectories(cartella))
            {
                string nome = Path.GetFileName(d);
                if (nome.StartsWith(".")) continue;
                if (Regole.Escludi.Any(x => string.Equals(x, nome, StringComparison.OrdinalIgnoreCase))) continue;
                Raccogli(d, risultato);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Impronte: hash della riga normalizzata + indice di occorrenza
    // -----------------------------------------------------------------------
    static class Impronte
    {
        static readonly Regex Spazi = new Regex(@"\s+", RegexOptions.Compiled);

        public static string Normalizza(string riga)
        {
            return Spazi.Replace(riga.Trim(), " ");
        }

        public static int Caratteri(string riga)
        {
            int n = 0;
            foreach (char c in riga) if (!char.IsWhiteSpace(c)) n++;
            return n;
        }

        // null per le righe vuote. Due righe identiche (es. due "}") ricevono #0, #1, ...
        public static string[] Calcola(IList<string> righe)
        {
            string[] r = new string[righe.Count];
            Dictionary<string, int> visti = new Dictionary<string, int>();
            using (SHA256 sha = SHA256.Create())
            {
                for (int i = 0; i < righe.Count; i++)
                {
                    string n = Normalizza(righe[i]);
                    if (n.Length == 0) continue;
                    byte[] h = sha.ComputeHash(Encoding.UTF8.GetBytes(n));
                    StringBuilder sb = new StringBuilder(16);
                    for (int k = 0; k < 6; k++) sb.Append(h[k].ToString("x2", Cultura.INV));
                    string hash = sb.ToString();
                    int occ;
                    visti.TryGetValue(hash, out occ);
                    visti[hash] = occ + 1;
                    r[i] = hash + "#" + occ.ToString(Cultura.INV);
                }
            }
            return r;
        }

        public static List<string> LeggiRighe(string percorso)
        {
            if (!File.Exists(percorso)) throw new Errore("Il file '" + percorso + "' non esiste.");
            string testo = File.ReadAllText(percorso, Encoding.UTF8);
            List<string> righe = testo.Split(new string[] { "\r\n", "\n", "\r" }, StringSplitOptions.None).ToList();
            if (righe.Count > 0 && righe[righe.Count - 1].Length == 0) righe.RemoveAt(righe.Count - 1);
            return righe;
        }

        public static string EspandiTab(string riga)
        {
            if (riga.IndexOf('\t') < 0) return riga;
            StringBuilder sb = new StringBuilder();
            foreach (char c in riga)
            {
                if (c == '\t') { do sb.Append(' '); while (sb.Length % 4 != 0); }
                else sb.Append(c);
            }
            return sb.ToString();
        }
    }

    // -----------------------------------------------------------------------
    // Registro: un JSON per file, impronta -> attenzione accumulata
    // Niente nomi, niente orari: solo secondi, numero di sessioni, giorno.
    // -----------------------------------------------------------------------
    class Voce
    {
        public double Secondi;
        public double Simulati;
        public int Sessioni;
        public string Ultima;

        public string Origine
        {
            get
            {
                if (Simulati <= 0.0005) return "lettura";
                if (Simulati >= Secondi - 0.0005) return "simulazione";
                return "mista";
            }
        }
    }

    class Registro
    {
        public string Relativo;
        public Dictionary<string, Voce> Righe = new Dictionary<string, Voce>();

        public static Registro Carica(string percorso, string relativo)
        {
            Registro r = new Registro();
            r.Relativo = relativo;
            if (!File.Exists(percorso)) return r;
            Dictionary<string, object> radice;
            try { radice = Json.Leggi(File.ReadAllText(percorso, Encoding.UTF8)) as Dictionary<string, object>; }
            catch (Exception e) { throw new Errore("Dati illeggibili in '" + percorso + "': " + e.Message); }
            if (radice == null) return r;
            object righe;
            if (radice.TryGetValue("righe", out righe) && righe is Dictionary<string, object>)
            {
                foreach (KeyValuePair<string, object> kv in (Dictionary<string, object>)righe)
                {
                    Dictionary<string, object> o = kv.Value as Dictionary<string, object>;
                    if (o == null) continue;
                    Voce v = new Voce();
                    v.Secondi = Json.Numero(o, "secondi", 0);
                    v.Simulati = Json.Numero(o, "simulati", Json.Testo(o, "origine", "") == "simulazione" ? v.Secondi : 0);
                    v.Sessioni = (int)Json.Numero(o, "sessioni", 0);
                    v.Ultima = Json.Testo(o, "ultima", null);
                    r.Righe[kv.Key] = v;
                }
            }
            return r;
        }

        public void Aggiungi(string impronta, double secondi, bool simulato, bool nuovaSessione, string giorno)
        {
            if (impronta == null || secondi <= 0) return;
            Voce v;
            if (!Righe.TryGetValue(impronta, out v)) { v = new Voce(); Righe[impronta] = v; }
            v.Secondi += secondi;
            if (simulato) v.Simulati += secondi;
            if (nuovaSessione) v.Sessioni++;
            v.Ultima = giorno;
        }

        public void Salva(string percorso)
        {
            var righe = new SortedDictionary<string, object>(StringComparer.Ordinal);
            foreach (KeyValuePair<string, Voce> kv in Righe)
            {
                var o = new Dictionary<string, object>();
                o["secondi"] = Math.Round(kv.Value.Secondi, 3);
                o["simulati"] = Math.Round(kv.Value.Simulati, 3);
                o["sessioni"] = kv.Value.Sessioni;
                o["ultima"] = kv.Value.Ultima;
                o["origine"] = kv.Value.Origine;
                righe[kv.Key] = o;
            }
            var radice = new Dictionary<string, object>();
            radice["formato"] = "sguardo/1";
            radice["file"] = Relativo.Replace('\\', '/');
            radice["righe"] = righe;
            Json.ScriviFileAtomico(percorso, Json.Scrivi(radice, 2));
        }
    }

    // -----------------------------------------------------------------------
    // Un file sorgente con lo stato di attenzione di ogni riga
    // -----------------------------------------------------------------------
    enum StatoRiga { Vuota, Mai, Sfiorata, Letta }

    class RigaCodice
    {
        public int Numero;
        public string Testo;
        public string Impronta;
        public int Caratteri;
        public double Soglia;
        public bool Critica;
        public double Secondi;
        public double Simulati;
        public int Sessioni;
        public string Ultima;

        public bool Vuota { get { return Impronta == null; } }

        public StatoRiga Stato(double extra)
        {
            if (Impronta == null) return StatoRiga.Vuota;
            double s = Secondi + extra;
            if (s >= Soglia - 1e-6) return StatoRiga.Letta;
            if (s > 1e-6) return StatoRiga.Sfiorata;
            return StatoRiga.Mai;
        }

        public StatoRiga Stato() { return Stato(0); }

        public string Origine
        {
            get
            {
                if (Secondi <= 0) return "—";
                if (Simulati <= 0.0005) return "lettura";
                if (Simulati >= Secondi - 0.0005) return "simulazione";
                return "mista";
            }
        }
    }

    class FileAnalizzato
    {
        public string Percorso;
        public string Relativo;
        public string PercorsoDati;
        public string Estensione;
        public List<RigaCodice> Righe = new List<RigaCodice>();
        public bool IA;
        public int RigaIA;
        public DateTime Modificato;

        public static FileAnalizzato Analizza(Progetto p, string percorso, bool soloLetture)
        {
            FileAnalizzato f = new FileAnalizzato();
            f.Percorso = Path.GetFullPath(percorso);
            f.Relativo = p.Relativo(f.Percorso);
            f.PercorsoDati = p.PercorsoDati(f.Percorso);
            f.Estensione = Path.GetExtension(f.Percorso).ToLowerInvariant();
            f.Modificato = File.GetLastWriteTimeUtc(f.Percorso);
            List<string> testi = Impronte.LeggiRighe(f.Percorso);
            string[] impronte = Impronte.Calcola(testi);
            Registro reg = Registro.Carica(f.PercorsoDati, f.Relativo);
            for (int i = 0; i < testi.Count; i++)
            {
                RigaCodice r = new RigaCodice();
                r.Numero = i + 1;
                r.Testo = testi[i];
                r.Impronta = impronte[i];
                if (r.Impronta != null)
                {
                    r.Caratteri = Impronte.Caratteri(r.Testo);
                    r.Soglia = p.Regole.Soglia(r.Caratteri);
                    r.Critica = p.Regole.Critica(r.Testo);
                    Voce v;
                    if (reg.Righe.TryGetValue(r.Impronta, out v))
                    {
                        r.Simulati = soloLetture ? 0 : v.Simulati;
                        r.Secondi = soloLetture ? Math.Max(0, v.Secondi - v.Simulati) : v.Secondi;
                        r.Sessioni = v.Sessioni;
                        r.Ultima = v.Ultima;
                    }
                    if (!f.IA && i < 40 && p.Regole.DichiaraIA(r.Testo)) { f.IA = true; f.RigaIA = r.Numero; }
                }
                f.Righe.Add(r);
            }
            return f;
        }

        public IEnumerable<RigaCodice> Significative { get { return Righe.Where(r => !r.Vuota); } }
        public int NumSignificative { get { return Significative.Count(); } }
        public int NumLette { get { return Righe.Count(r => r.Stato() == StatoRiga.Letta); } }
        public int NumSfiorate { get { return Righe.Count(r => r.Stato() == StatoRiga.Sfiorata); } }
        public int NumMai { get { return Righe.Count(r => r.Stato() == StatoRiga.Mai); } }
        public int NumCritiche { get { return Righe.Count(r => r.Critica); } }
        public List<RigaCodice> CriticheNonLette { get { return Righe.Where(r => r.Critica && r.Stato() != StatoRiga.Letta).ToList(); } }
        public double SecondiTotali { get { return Righe.Sum(r => r.Secondi); } }
        public double SecondiSimulati { get { return Righe.Sum(r => r.Simulati); } }

        public double Frazione
        {
            get { int n = NumSignificative; return n == 0 ? 1 : (double)NumLette / n; }
        }

        // Intervalli di righe non lette ("18-31, 35"); le righe vuote non spezzano un intervallo.
        public List<int[]> IntervalliNonLette()
        {
            List<int[]> r = new List<int[]>();
            int[] corrente = null;
            foreach (RigaCodice riga in Significative)
            {
                if (riga.Stato() != StatoRiga.Letta)
                {
                    if (corrente == null) { corrente = new int[] { riga.Numero, riga.Numero }; r.Add(corrente); }
                    else corrente[1] = riga.Numero;
                }
                else corrente = null;
            }
            return r;
        }

        public static string Descrivi(List<int[]> intervalli)
        {
            return string.Join(", ", intervalli.Select(x => x[0] == x[1] ? x[0].ToString(Cultura.INV) : x[0].ToString(Cultura.INV) + "-" + x[1].ToString(Cultura.INV)));
        }
    }

    // -----------------------------------------------------------------------
    // Analisi di una cartella (rapporto e verifica)
    // -----------------------------------------------------------------------
    class Analisi
    {
        public Progetto Progetto;
        public string Cartella;
        public bool SoloLetture;
        public List<FileAnalizzato> File = new List<FileAnalizzato>();

        public static Analisi Esegui(string cartella, bool soloLetture)
        {
            Analisi a = new Analisi();
            a.Cartella = Path.GetFullPath(string.IsNullOrEmpty(cartella) ? "." : cartella);
            if (!Directory.Exists(a.Cartella)) throw new Errore("La cartella '" + a.Cartella + "' non esiste.");
            a.Progetto = Progetto.Trova(a.Cartella);
            a.SoloLetture = soloLetture;
            foreach (string f in a.Progetto.FileSorgente(a.Cartella))
                a.File.Add(FileAnalizzato.Analizza(a.Progetto, f, soloLetture));
            return a;
        }

        public int Significative { get { return File.Sum(f => f.NumSignificative); } }
        public int Lette { get { return File.Sum(f => f.NumLette); } }
        public int Mai { get { return File.Sum(f => f.NumMai); } }
        public int Sfiorate { get { return File.Sum(f => f.NumSfiorate); } }
        public int Critiche { get { return File.Sum(f => f.NumCritiche); } }
        public int CriticheNonLette { get { return File.Sum(f => f.CriticheNonLette.Count); } }
        public double Secondi { get { return File.Sum(f => f.SecondiTotali); } }
        public double Simulati { get { return File.Sum(f => f.SecondiSimulati); } }
        public double Frazione { get { int n = Significative; return n == 0 ? 1 : (double)Lette / n; } }
    }
}
