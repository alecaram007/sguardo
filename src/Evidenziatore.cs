// SGUARDO - evidenziazione della sintassi, volutamente semplice e condivisa
// tra il lettore (WinForms) e il rapporto HTML.
using System;
using System.Collections.Generic;
using System.Text;

namespace Sguardo
{
    enum TipoToken { Testo, Chiave, Stringa, Commento, Numero }

    class Token
    {
        public TipoToken Tipo;
        public string Testo;
        public Token(TipoToken tipo, string testo) { Tipo = tipo; Testo = testo; }
    }

    class Evidenziatore
    {
        static readonly HashSet<string> Chiavi = new HashSet<string>(new string[] {
            "abstract", "and", "as", "async", "await", "base", "bool", "break", "byte", "case", "catch", "char", "class",
            "const", "continue", "def", "default", "del", "delete", "do", "double", "elif", "else", "enum", "except",
            "export", "extends", "false", "False", "final", "finally", "float", "fn", "for", "foreach", "from", "func",
            "function", "go", "if", "implements", "import", "in", "int", "interface", "is", "lambda", "let", "long",
            "match", "module", "namespace", "new", "nil", "None", "not", "null", "of", "or", "override", "package",
            "param", "pass", "private", "protected", "pub", "public", "raise", "readonly", "require", "return", "self",
            "static", "string", "struct", "super", "switch", "this", "throw", "true", "True", "try", "type", "typeof",
            "undefined", "using", "var", "virtual", "void", "while", "with", "yield", "SELECT", "FROM", "WHERE",
            "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "DROP", "TABLE", "AND", "OR", "NOT", "NULL"
        }, StringComparer.Ordinal);

        readonly string commentoRiga;
        readonly bool commentiBlocco;
        bool inBlocco;

        public Evidenziatore(string estensione)
        {
            switch (estensione)
            {
                case ".py": case ".rb": case ".sh": case ".ps1":
                    commentoRiga = "#"; commentiBlocco = false; break;
                case ".sql": case ".lua":
                    commentoRiga = "--"; commentiBlocco = estensione == ".sql"; break;
                case ".vb":
                    commentoRiga = "'"; commentiBlocco = false; break;
                default:
                    commentoRiga = "//"; commentiBlocco = true; break;
            }
        }

        static bool InizioNome(char c) { return char.IsLetter(c) || c == '_' || c == '$'; }
        static bool ParteNome(char c) { return char.IsLetterOrDigit(c) || c == '_' || c == '$'; }

        // "testo" deve avere già i tab espansi. Va chiamato riga dopo riga, in ordine:
        // ricorda se un commento /* ... */ continua sulla riga successiva.
        public List<Token> Riga(string testo)
        {
            List<Token> r = new List<Token>();
            StringBuilder semplice = new StringBuilder();
            int i = 0, n = testo.Length;
            while (i < n)
            {
                if (inBlocco)
                {
                    int fine = testo.IndexOf("*/", i, StringComparison.Ordinal);
                    int stop = fine < 0 ? n : fine + 2;
                    Svuota(r, semplice);
                    r.Add(new Token(TipoToken.Commento, testo.Substring(i, stop - i)));
                    if (fine >= 0) inBlocco = false;
                    i = stop;
                    continue;
                }
                char c = testo[i];
                if (commentiBlocco && c == '/' && i + 1 < n && testo[i + 1] == '*')
                {
                    Svuota(r, semplice);
                    int fine = testo.IndexOf("*/", i + 2, StringComparison.Ordinal);
                    int stop = fine < 0 ? n : fine + 2;
                    r.Add(new Token(TipoToken.Commento, testo.Substring(i, stop - i)));
                    if (fine < 0) inBlocco = true;
                    i = stop;
                    continue;
                }
                if (string.CompareOrdinal(testo, i, commentoRiga, 0, commentoRiga.Length) == 0)
                {
                    Svuota(r, semplice);
                    r.Add(new Token(TipoToken.Commento, testo.Substring(i)));
                    break;
                }
                if (c == '"' || c == '`' || (c == '\'' && commentoRiga != "'"))
                {
                    Svuota(r, semplice);
                    int j = i + 1;
                    while (j < n && testo[j] != c) { if (testo[j] == '\\') j++; j++; }
                    int stop = Math.Min(n, j + 1);
                    r.Add(new Token(TipoToken.Stringa, testo.Substring(i, stop - i)));
                    i = stop;
                    continue;
                }
                if (char.IsDigit(c) && (i == 0 || !ParteNome(testo[i - 1])))
                {
                    Svuota(r, semplice);
                    int j = i;
                    while (j < n && (char.IsLetterOrDigit(testo[j]) || testo[j] == '.' || testo[j] == '_')) j++;
                    r.Add(new Token(TipoToken.Numero, testo.Substring(i, j - i)));
                    i = j;
                    continue;
                }
                if (InizioNome(c))
                {
                    int j = i;
                    while (j < n && ParteNome(testo[j])) j++;
                    string nome = testo.Substring(i, j - i);
                    if (Chiavi.Contains(nome)) { Svuota(r, semplice); r.Add(new Token(TipoToken.Chiave, nome)); }
                    else semplice.Append(nome);
                    i = j;
                    continue;
                }
                semplice.Append(c);
                i++;
            }
            Svuota(r, semplice);
            return r;
        }

        static void Svuota(List<Token> r, StringBuilder sb)
        {
            if (sb.Length == 0) return;
            r.Add(new Token(TipoToken.Testo, sb.ToString()));
            sb.Length = 0;
        }
    }
}
