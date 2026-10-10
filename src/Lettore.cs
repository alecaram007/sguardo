// SGUARDO - il lettore: una finestra WinForms disegnata a mano che registra
// quali righe hai davvero davanti agli occhi, e per quanto.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Sguardo
{
    static class Nativo
    {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attributo, ref int valore, int dimensione);
    }

    class EsitoLettura
    {
        public double Attenzione;
        public double Attiva;
        public int RigheToccate;
        public double FrazionePrima;
        public double FrazioneDopo;
        public int CriticheNonLette;
        public string Schermata;
        public string Errore;
        public bool Simulata;
        public string PercorsoDati;
    }

    enum StatoRegistrazione { Avvio, Registro, Inattivo, SenzaFocus }

    class Lettore : Control
    {
        // --- colori (tema scuro) -------------------------------------------
        public static readonly Color CSfondo = Color.FromArgb(24, 26, 31);
        static readonly Color CMargine = Color.FromArgb(21, 23, 27);
        static readonly Color CTesta = Color.FromArgb(31, 34, 41);
        static readonly Color CBordo = Color.FromArgb(46, 50, 59);
        static readonly Color CTesto = Color.FromArgb(216, 220, 227);
        static readonly Color CTenue = Color.FromArgb(128, 135, 148);
        static readonly Color CNumeri = Color.FromArgb(84, 90, 102);
        static readonly Color CChiave = Color.FromArgb(125, 168, 255);
        static readonly Color CStringa = Color.FromArgb(226, 190, 122);
        static readonly Color CCommento = Color.FromArgb(108, 117, 133);
        static readonly Color CNumero = Color.FromArgb(240, 140, 108);
        static readonly Color CMai = Color.FromArgb(64, 69, 80);
        public static readonly Color CVerde = Color.FromArgb(63, 185, 80);
        static readonly Color CRosso = Color.FromArgb(240, 98, 104);
        static readonly Color CAmbra = Color.FromArgb(232, 178, 76);
        static readonly Color CViola = Color.FromArgb(196, 160, 255);

        // --- stato ----------------------------------------------------------
        readonly Progetto progetto;
        readonly string percorso;
        public FileAnalizzato File_;
        List<List<Token>> token;
        double[] delta;
        readonly HashSet<string> contate = new HashSet<string>();
        int primaRiga;
        Point puntatore = new Point(-1, -1);
        bool puntatoreDentro;
        DateTime ultimaAttivita = DateTime.MinValue;
        readonly Stopwatch orologio = Stopwatch.StartNew();
        double ultimoTick, ultimoSalvataggio, ultimoControllo;
        StatoRegistrazione stato = StatoRegistrazione.Avvio;
        double attenzioneSessione, attivaSessione;
        readonly double autotest;
        readonly string schermata;
        bool chiuso, finito;
        long lunghezzaFile;
        readonly Timer timer;
        bool trascina;
        float trascinaOffset;
        int rotella;
        string avviso;
        double avvisoFino;
        public readonly EsitoLettura Esito = new EsitoLettura();

        // --- grafica --------------------------------------------------------
        public readonly float S;
        readonly Font fCodice, fCorsivo, fUi, fUiForte, fTitolo, fPiccolo;
        readonly int h, altezzaTesto;
        readonly float cw;
        Rectangle rTesta, rStato, rCodice, rBarra;
        int xNumeri, larghezzaNumeri, xTesto;

        const TextFormatFlags Piatto = TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine | TextFormatFlags.PreserveGraphicsClipping;

        public Lettore(Progetto p, string percorso, double autotest, string schermata)
        {
            progetto = p;
            this.percorso = Path.GetFullPath(percorso);
            this.autotest = autotest;
            this.schermata = schermata;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint |
                     ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) S = g.DpiX / 96f;
            string mono = FontEsiste("Cascadia Mono") ? "Cascadia Mono" : "Consolas";
            fCodice = new Font(mono, 10f);
            fCorsivo = new Font(mono, 10f, FontStyle.Italic);
            fUi = new Font("Segoe UI", 9f);
            fUiForte = new Font("Segoe UI Semibold", 9f);
            fTitolo = new Font("Segoe UI Semibold", 10.5f);
            fPiccolo = new Font("Segoe UI Semibold", 7.5f);
            Size m = TextRenderer.MeasureText(new string('0', 100), fCodice, Size.Empty, TextFormatFlags.NoPadding);
            cw = m.Width / 100f;
            altezzaTesto = m.Height;
            h = altezzaTesto + (int)Math.Round(6 * S);
            Carica();
            Esito.FrazionePrima = File_.Frazione;
            Esito.Simulata = autotest > 0;
            Esito.PercorsoDati = File_.PercorsoDati;
            timer = new Timer();
            timer.Interval = 250;
            timer.Tick += Tick;
            timer.Start();
        }

        static bool FontEsiste(string nome)
        {
            using (Font f = new Font(nome, 10f)) return string.Equals(f.Name, nome, StringComparison.OrdinalIgnoreCase);
        }

        void Carica()
        {
            File_ = FileAnalizzato.Analizza(progetto, percorso, false);
            lunghezzaFile = new FileInfo(percorso).Length;
            delta = new double[File_.Righe.Count];
            Evidenziatore ev = new Evidenziatore(File_.Estensione);
            token = new List<List<Token>>();
            foreach (RigaCodice r in File_.Righe) token.Add(ev.Riga(Impronte.EspandiTab(r.Testo)));
            Disponi();
        }

        // --- disposizione ---------------------------------------------------
        int Px(float v) { return (int)Math.Round(v * S); }
        int Pad { get { return Px(8); } }
        int RigheVisibili { get { return Math.Max(1, (rCodice.Height - Pad) / h); } }
        int MaxPrima { get { return Math.Max(0, File_.Righe.Count - RigheVisibili); } }
        void Limita() { primaRiga = Math.Max(0, Math.Min(primaRiga, MaxPrima)); }

        void Disponi()
        {
            if (File_ == null) return;
            int W = ClientSize.Width, H = ClientSize.Height;
            int testa = Px(48), piede = Px(32), barra = Px(18);
            rTesta = new Rectangle(0, 0, W, testa);
            rStato = new Rectangle(0, Math.Max(testa, H - piede), W, piede);
            rBarra = new Rectangle(Math.Max(0, W - barra), testa, barra, Math.Max(0, H - piede - testa));
            rCodice = new Rectangle(0, testa, Math.Max(0, W - barra), Math.Max(0, H - piede - testa));
            int cifre = Math.Max(3, File_.Righe.Count.ToString(Cultura.INV).Length);
            xNumeri = Px(36);
            larghezzaNumeri = (int)Math.Ceiling(cifre * cw);
            xTesto = xNumeri + larghezzaNumeri + Px(20);
            Limita();
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            Disponi();
            Invalidate();
        }

        // --- attenzione -----------------------------------------------------
        public void Attivita()
        {
            ultimaAttivita = DateTime.UtcNow;
        }

        void Tick(object sender, EventArgs e)
        {
            if (chiuso) return;
            double ora = orologio.Elapsed.TotalSeconds;
            double dt = Math.Min(1.0, ora - ultimoTick);
            ultimoTick = ora;
            if (autotest > 0) PassoAutotest(ora);

            Form form = FindForm();
            bool focus = autotest > 0 || (form != null && Nativo.GetForegroundWindow() == form.Handle);
            bool attivo = (DateTime.UtcNow - ultimaAttivita).TotalSeconds <= progetto.Regole.Inattivita;
            stato = !focus ? StatoRegistrazione.SenzaFocus : (!attivo ? StatoRegistrazione.Inattivo : StatoRegistrazione.Registro);
            if (stato == StatoRegistrazione.Registro && dt > 0) Distribuisci(dt);

            if (ora - ultimoSalvataggio >= 10) { SalvaSicuro(); ultimoSalvataggio = ora; }
            if (ora - ultimoControllo >= 2) { ControllaFile(ora); ultimoControllo = ora; }
            Invalidate();

            if (autotest > 0 && ora >= autotest && !finito)
            {
                finito = true;
                Update();
                try { SalvaSchermata(); }
                catch (Exception ex) { Esito.Errore = "schermata non salvata: " + ex.Message; }
                if (form != null) form.Close();
            }
        }

        // Distribuisce dt secondi tra le righe visibili non vuote: il peso di una
        // riga è la sua soglia (cioè la sua lunghezza) per la vicinanza al puntatore.
        void Distribuisci(double dt)
        {
            int inizio = primaRiga;
            int fine = Math.Min(File_.Righe.Count, primaRiga + RigheVisibili);
            if (fine <= inizio) return;
            double fuoco, sigma;
            if (puntatoreDentro)
            {
                fuoco = primaRiga + (puntatore.Y - rCodice.Top - Pad) / (double)h - 0.5;
                sigma = 3.5;
            }
            else
            {
                fuoco = primaRiga + RigheVisibili * 0.4;
                sigma = Math.Max(4.0, RigheVisibili / 2.5);
            }
            double[] pesi = new double[fine - inizio];
            double somma = 0;
            for (int i = inizio; i < fine; i++)
            {
                RigaCodice r = File_.Righe[i];
                if (r.Vuota) continue;
                double d = i - fuoco;
                double vicinanza = 0.06 + Math.Exp(-d * d / (2 * sigma * sigma));
                pesi[i - inizio] = r.Soglia * vicinanza;
                somma += pesi[i - inizio];
            }
            if (somma <= 0) return;
            for (int i = inizio; i < fine; i++)
            {
                double q = dt * pesi[i - inizio] / somma;
                if (q <= 0) continue;
                delta[i] += q;
                attenzioneSessione += q;
            }
            attivaSessione += dt;
        }

        void SalvaSicuro()
        {
            try { Salva(); }
            catch (Exception ex) { Avvisa("Salvataggio non riuscito: " + ex.Message, 10); }
        }

        void Salva()
        {
            bool qualcosa = false;
            for (int i = 0; i < delta.Length; i++) if (delta[i] > 0 && !File_.Righe[i].Vuota) { qualcosa = true; break; }
            if (!qualcosa) return;
            // Rilegge dal disco e somma: se nel frattempo qualcun altro ha scritto, non si perde nulla.
            Registro reg = Registro.Carica(File_.PercorsoDati, File_.Relativo);
            string oggi = Cultura.Oggi();
            for (int i = 0; i < delta.Length; i++)
            {
                RigaCodice r = File_.Righe[i];
                if (delta[i] <= 0 || r.Vuota) continue;
                reg.Aggiungi(r.Impronta, delta[i], autotest > 0, !contate.Contains(r.Impronta), oggi);
                contate.Add(r.Impronta);
            }
            reg.Salva(File_.PercorsoDati);
            for (int i = 0; i < delta.Length; i++)
            {
                RigaCodice r = File_.Righe[i];
                delta[i] = 0;
                Voce v;
                if (!r.Vuota && reg.Righe.TryGetValue(r.Impronta, out v))
                {
                    r.Secondi = v.Secondi; r.Simulati = v.Simulati; r.Sessioni = v.Sessioni; r.Ultima = v.Ultima;
                }
            }
        }

        void ControllaFile(double ora)
        {
            try
            {
                FileInfo fi = new FileInfo(percorso);
                if (!fi.Exists || (fi.LastWriteTimeUtc == File_.Modificato && fi.Length == lunghezzaFile)) return;
                Salva();
                int prima = primaRiga;
                Carica();
                primaRiga = prima;
                Limita();
                Avvisa("Il file è cambiato su disco: ricaricato. Le righe modificate tornano «mai lette».", 8);
            }
            catch (Exception) { }
        }

        void Avvisa(string testo, double secondi)
        {
            avviso = testo;
            avvisoFino = orologio.Elapsed.TotalSeconds + secondi;
        }

        public void Chiudi()
        {
            if (chiuso) return;
            chiuso = true;
            timer.Stop();
            try { Salva(); }
            catch (Exception ex) { Esito.Errore = "salvataggio non riuscito: " + ex.Message; }
            Esito.Attenzione = attenzioneSessione;
            Esito.Attiva = attivaSessione;
            Esito.RigheToccate = contate.Count;
            Esito.FrazioneDopo = File_.Frazione;
            Esito.CriticheNonLette = File_.CriticheNonLette.Count;
        }

        // --- autotest: attività simulata, senza toccare il mouse vero ---------
        void PassoAutotest(double t)
        {
            Attivita();
            int n = File_.Righe.Count;
            if (n == 0) return;
            double p = Math.Min(1.0, t / (autotest * 0.8));
            double fuoco = p * (n - 1);
            primaRiga = (int)Math.Round(fuoco - RigheVisibili * 0.55);
            Limita();
            puntatoreDentro = true;
            int y = rCodice.Top + Pad + (int)((fuoco - primaRiga + 0.5) * h);
            int x = xTesto + (int)(cw * (16 + 12 * Math.Sin(t * 1.3)));
            puntatore = new Point(x, y);
        }

        void SalvaSchermata()
        {
            if (string.IsNullOrEmpty(schermata)) return;
            string pieno = Path.GetFullPath(schermata);
            string cartella = Path.GetDirectoryName(pieno);
            if (!string.IsNullOrEmpty(cartella)) Directory.CreateDirectory(cartella);
            using (Bitmap bmp = new Bitmap(Width, Height, PixelFormat.Format24bppRgb))
            {
                DrawToBitmap(bmp, new Rectangle(0, 0, Width, Height));
                bmp.Save(pieno, ImageFormat.Png);
            }
            Esito.Schermata = pieno;
        }

        // --- input ----------------------------------------------------------
        protected override bool IsInputKey(Keys k)
        {
            switch (k & Keys.KeyCode)
            {
                case Keys.Up: case Keys.Down: case Keys.PageUp: case Keys.PageDown: case Keys.Home: case Keys.End: case Keys.Space:
                    return true;
            }
            return base.IsInputKey(k);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.KeyCode == Keys.Escape) { Form f = FindForm(); if (f != null) f.Close(); return; }
            if (autotest > 0) return;
            Attivita();
            switch (e.KeyCode)
            {
                case Keys.Down: primaRiga += 1; break;
                case Keys.Up: primaRiga -= 1; break;
                case Keys.PageDown: case Keys.Space: primaRiga += Math.Max(1, RigheVisibili - 2); break;
                case Keys.PageUp: primaRiga -= Math.Max(1, RigheVisibili - 2); break;
                case Keys.Home: primaRiga = 0; break;
                case Keys.End: primaRiga = MaxPrima; break;
            }
            Limita();
            Invalidate();
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (autotest > 0) return;
            if (e.Location != puntatore) Attivita();
            puntatore = e.Location;
            puntatoreDentro = rCodice.Contains(e.Location);
            if (trascina) TrascinaA(e.Y);
            Invalidate();
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            if (autotest > 0) return;
            puntatoreDentro = false;
            Invalidate();
        }

        protected override void OnMouseWheel(MouseEventArgs e)
        {
            base.OnMouseWheel(e);
            if (autotest > 0) return;
            Attivita();
            rotella += e.Delta;
            int passi = rotella / 40;
            rotella -= passi * 40;
            primaRiga -= passi;
            Limita();
            Invalidate();
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            Focus();
            if (autotest > 0) return;
            Attivita();
            if (rBarra.Contains(e.Location) && File_.Righe.Count > RigheVisibili)
            {
                RectangleF p = Pollice();
                if (!p.Contains(e.Location))
                {
                    float per = PerRiga();
                    primaRiga = (int)Math.Round((e.Y - (rBarra.Top + Px(4))) / per - RigheVisibili / 2.0);
                    Limita();
                    p = Pollice();
                }
                trascina = true;
                trascinaOffset = e.Y - p.Top;
                Invalidate();
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            trascina = false;
        }

        float PerRiga()
        {
            return (rBarra.Height - Px(8)) / (float)Math.Max(1, File_.Righe.Count);
        }

        RectangleF Pollice()
        {
            float top = rBarra.Top + Px(4), alt = rBarra.Height - Px(8), per = PerRiga();
            float vero = RigheVisibili * per;
            float th = Math.Max(Px(28), vero);
            float ty = top + primaRiga * per - (th - vero) / 2;
            ty = Math.Max(top, Math.Min(ty, top + alt - th));
            return new RectangleF(rBarra.Left + Px(3), ty, rBarra.Width - Px(6), th);
        }

        void TrascinaA(int y)
        {
            float top = rBarra.Top + Px(4), per = PerRiga();
            RectangleF p = Pollice();
            float vero = RigheVisibili * per;
            primaRiga = (int)Math.Round((y - trascinaOffset + (p.Height - vero) / 2 - top) / per);
            Limita();
        }

        // --- disegno --------------------------------------------------------
        static Color Mescola(Color a, Color b, double t)
        {
            t = Math.Max(0, Math.Min(1, t));
            return Color.FromArgb((int)(a.R + (b.R - a.R) * t), (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));
        }

        // grigio = mai letta, oliva = sfiorata, verde = letta (più intenso con più attenzione)
        static Color ColoreAttenzione(double secondi, double soglia)
        {
            if (secondi <= 1e-6) return CMai;
            double r = secondi / soglia;
            if (r < 1) return Mescola(Color.FromArgb(84, 92, 86), Color.FromArgb(128, 150, 84), r);
            return Mescola(Color.FromArgb(46, 160, 67), Color.FromArgb(118, 228, 128), (r - 1) / 3);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(CSfondo);
            if (File_ == null) return;
            DisegnaCodice(g);
            DisegnaBarra(g);
            DisegnaTesta(g);
            DisegnaStato(g);
            if (autotest > 0 && puntatoreDentro) DisegnaPuntatore(g);
        }

        void DisegnaCodice(Graphics g)
        {
            g.SetClip(rCodice);
            using (SolidBrush b = new SolidBrush(CMargine)) g.FillRectangle(b, 0, rCodice.Top, xTesto - Px(10), rCodice.Height);
            int y0 = rCodice.Top + Pad;
            int fine = Math.Min(File_.Righe.Count, primaRiga + RigheVisibili + 1);
            int rigaPuntatore = puntatoreDentro ? primaRiga + (int)Math.Floor((puntatore.Y - rCodice.Top - Pad) / (double)h) : -1;
            int dy = (h - altezzaTesto) / 2;
            using (SolidBrush velo = new SolidBrush(Color.FromArgb(26, 240, 98, 104)))
            using (SolidBrush evidenzia = new SolidBrush(Color.FromArgb(14, 255, 255, 255)))
            {
                for (int i = primaRiga; i < fine; i++)
                {
                    RigaCodice r = File_.Righe[i];
                    int y = y0 + (i - primaRiga) * h;
                    StatoRiga st = r.Stato(delta[i]);
                    bool criticaDaLeggere = r.Critica && st != StatoRiga.Letta;
                    if (criticaDaLeggere) g.FillRectangle(velo, xTesto - Px(10), y, rCodice.Right - xTesto + Px(10), h);
                    if (i == rigaPuntatore) g.FillRectangle(evidenzia, 0, y, rCodice.Width, h);
                    if (!r.Vuota)
                    {
                        using (SolidBrush b = new SolidBrush(ColoreAttenzione(r.Secondi + delta[i], r.Soglia)))
                            g.FillRectangle(b, Px(12), y + 1, Px(5), h - 2);
                    }
                    if (r.Critica)
                    {
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        float d = Px(6), cx = Px(26), cy = y + h / 2f;
                        using (SolidBrush b = new SolidBrush(criticaDaLeggere ? CRosso : Color.FromArgb(90, 150, 100)))
                            g.FillEllipse(b, cx - d / 2, cy - d / 2, d, d);
                        g.SmoothingMode = SmoothingMode.None;
                    }
                    Color cn = i == rigaPuntatore ? CTesto : (st == StatoRiga.Letta ? Color.FromArgb(104, 132, 110) : CNumeri);
                    TextRenderer.DrawText(g, (i + 1).ToString(Cultura.INV), fCodice, new Rectangle(xNumeri, y + dy, larghezzaNumeri, altezzaTesto), cn,
                        Piatto | TextFormatFlags.Right);
                    int col = 0;
                    foreach (Token t in token[i])
                    {
                        Color c = CTesto;
                        Font f = fCodice;
                        switch (t.Tipo)
                        {
                            case TipoToken.Chiave: c = CChiave; break;
                            case TipoToken.Stringa: c = CStringa; break;
                            case TipoToken.Numero: c = CNumero; break;
                            case TipoToken.Commento: c = CCommento; f = fCorsivo; break;
                        }
                        int x = (int)Math.Round(xTesto + col * cw);
                        if (x > rCodice.Right) break;
                        TextRenderer.DrawText(g, t.Testo, f, new Point(x, y + dy), c, Piatto);
                        col += t.Testo.Length;
                    }
                }
            }
            g.ResetClip();
            if (File_.Righe.Count == 0)
                TextRenderer.DrawText(g, "Il file è vuoto.", fUi, new Point(xTesto, rCodice.Top + Pad), CTenue, Piatto);
        }

        void DisegnaBarra(Graphics g)
        {
            using (SolidBrush b = new SolidBrush(CMargine)) g.FillRectangle(b, rBarra);
            using (Pen p = new Pen(CBordo)) g.DrawLine(p, rBarra.Left, rBarra.Top, rBarra.Left, rBarra.Bottom);
            int n = File_.Righe.Count;
            if (n == 0) return;
            float top = rBarra.Top + Px(4), per = PerRiga();
            float hh = Math.Max(Math.Max(1.5f, S * 1.5f), per);
            float x = rBarra.Left + Px(5), w = rBarra.Width - Px(10);
            for (int i = 0; i < n; i++)
            {
                RigaCodice r = File_.Righe[i];
                if (r.Vuota) continue;
                using (SolidBrush b = new SolidBrush(ColoreAttenzione(r.Secondi + delta[i], r.Soglia)))
                    g.FillRectangle(b, x, top + i * per, w, hh - (per > 3 ? 1 : 0));
            }
            using (SolidBrush rosso = new SolidBrush(CRosso))
            {
                for (int i = 0; i < n; i++)
                {
                    RigaCodice r = File_.Righe[i];
                    if (r.Critica && r.Stato(delta[i]) != StatoRiga.Letta)
                        g.FillRectangle(rosso, rBarra.Left + Px(2), top + i * per, rBarra.Width - Px(4), Math.Max(hh, Px(2)));
                }
            }
            if (n > RigheVisibili)
            {
                RectangleF pl = Pollice();
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath gp = Arrotondato(pl, Px(3)))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(trascina ? 70 : 44, 255, 255, 255)))
                using (Pen p = new Pen(Color.FromArgb(90, 255, 255, 255)))
                {
                    g.FillPath(b, gp);
                    g.DrawPath(p, gp);
                }
                g.SmoothingMode = SmoothingMode.None;
            }
        }

        static GraphicsPath Arrotondato(RectangleF r, float raggio)
        {
            GraphicsPath gp = new GraphicsPath();
            float d = Math.Min(raggio * 2, Math.Min(r.Width, r.Height));
            gp.AddArc(r.Left, r.Top, d, d, 180, 90);
            gp.AddArc(r.Right - d, r.Top, d, d, 270, 90);
            gp.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            gp.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
            gp.CloseFigure();
            return gp;
        }

        public static void DisegnaOcchio(Graphics g, float x, float y, float lato, Color bianco, Color iride, Color pupilla)
        {
            SmoothingMode prima = g.SmoothingMode;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            float m = lato / 32f;
            using (GraphicsPath occhio = new GraphicsPath())
            {
                occhio.AddBezier(x + 1 * m, y + 16 * m, x + 8 * m, y + 4 * m, x + 24 * m, y + 4 * m, x + 31 * m, y + 16 * m);
                occhio.AddBezier(x + 31 * m, y + 16 * m, x + 24 * m, y + 28 * m, x + 8 * m, y + 28 * m, x + 1 * m, y + 16 * m);
                using (SolidBrush b = new SolidBrush(bianco)) g.FillPath(b, occhio);
            }
            using (SolidBrush b = new SolidBrush(iride)) g.FillEllipse(b, x + 9.5f * m, y + 9.5f * m, 13 * m, 13 * m);
            using (SolidBrush b = new SolidBrush(pupilla)) g.FillEllipse(b, x + 13 * m, y + 13 * m, 6 * m, 6 * m);
            g.SmoothingMode = prima;
        }

        int Scrivi(Graphics g, string testo, Font f, Color c, int x, Rectangle area)
        {
            Size m = TextRenderer.MeasureText(g, testo, f, new Size(int.MaxValue, int.MaxValue), TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
            TextRenderer.DrawText(g, testo, f, new Rectangle(x, area.Top, m.Width + 4, area.Height), c,
                TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine | TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
            return x + m.Width;
        }

        int Misura(Graphics g, string testo, Font f)
        {
            return TextRenderer.MeasureText(g, testo, f, new Size(int.MaxValue, int.MaxValue), TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix).Width;
        }

        void DisegnaTesta(Graphics g)
        {
            using (SolidBrush b = new SolidBrush(CTesta)) g.FillRectangle(b, rTesta);
            using (Pen p = new Pen(CBordo)) g.DrawLine(p, 0, rTesta.Bottom - 1, rTesta.Right, rTesta.Bottom - 1);
            float lato = Px(24);
            DisegnaOcchio(g, Px(12), rTesta.Top + (rTesta.Height - lato) / 2f, lato, Color.FromArgb(226, 230, 236), CVerde, CSfondo);
            int x = Px(44);
            x = Scrivi(g, "Sguardo", fTitolo, CTesto, x, rTesta);
            x = Scrivi(g, "   " + File_.Relativo, fUi, CTenue, x, rTesta);
            if (File_.IA)
            {
                string etichetta = "SCRITTO DALL'IA";
                int w = Misura(g, etichetta, fPiccolo) + Px(12);
                Rectangle r = new Rectangle(x + Px(12), rTesta.Top + (rTesta.Height - Px(20)) / 2, w, Px(20));
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath gp = Arrotondato(r, Px(4)))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(40, 196, 160, 255)))
                using (Pen p = new Pen(Color.FromArgb(120, 196, 160, 255)))
                {
                    g.FillPath(b, gp);
                    g.DrawPath(p, gp);
                }
                g.SmoothingMode = SmoothingMode.None;
                TextRenderer.DrawText(g, etichetta, fPiccolo, r, CViola, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
            }

            // a destra: cosa sta facendo Sguardo in questo momento
            Color punto;
            string testo;
            switch (stato)
            {
                case StatoRegistrazione.Registro:
                    punto = autotest > 0 ? CAmbra : CVerde;
                    testo = autotest > 0 ? "Autotest · attività simulata" : "Registro l'attenzione";
                    break;
                case StatoRegistrazione.Inattivo:
                    punto = CMai;
                    testo = "In pausa · nessuna attività da " + ((int)progetto.Regole.Inattivita).ToString(Cultura.INV) + " s";
                    break;
                case StatoRegistrazione.SenzaFocus:
                    punto = CMai;
                    testo = "In pausa · finestra non attiva";
                    break;
                default:
                    punto = CMai;
                    testo = "In attesa";
                    break;
            }
            string tempo = "   " + Cultura.Secondi(attivaSessione) + " in questa sessione";
            int larghezza = Px(20) + Misura(g, testo, fUiForte) + Misura(g, tempo, fUi);
            int xd = rTesta.Right - larghezza - Px(16);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            float dp = Px(9);
            using (SolidBrush b = new SolidBrush(punto)) g.FillEllipse(b, xd, rTesta.Top + (rTesta.Height - dp) / 2f, dp, dp);
            if (stato == StatoRegistrazione.Registro)
                using (Pen p = new Pen(Color.FromArgb(70, punto), Px(2)))
                    g.DrawEllipse(p, xd - Px(3), rTesta.Top + (rTesta.Height - dp) / 2f - Px(3), dp + Px(6), dp + Px(6));
            g.SmoothingMode = SmoothingMode.None;
            xd += Px(20);
            xd = Scrivi(g, testo, fUiForte, stato == StatoRegistrazione.Registro ? CTesto : CTenue, xd, rTesta);
            Scrivi(g, tempo, fUi, CTenue, xd, rTesta);
        }

        void DisegnaStato(Graphics g)
        {
            using (SolidBrush b = new SolidBrush(CTesta)) g.FillRectangle(b, rStato);
            using (Pen p = new Pen(CBordo)) g.DrawLine(p, 0, rStato.Top, rStato.Right, rStato.Top);
            int significative = 0, lette = 0, critiche = 0, simulate = 0;
            for (int i = 0; i < File_.Righe.Count; i++)
            {
                RigaCodice r = File_.Righe[i];
                if (r.Vuota) continue;
                significative++;
                bool letta = r.Stato(delta[i]) == StatoRiga.Letta;
                if (letta) lette++;
                if (r.Critica && !letta) critiche++;
                if (r.Simulati > 0 || (autotest > 0 && delta[i] > 0)) simulate++;
            }
            int perc = significative == 0 ? 100 : (int)Math.Floor(100.0 * lette / significative + 1e-9);
            int x = Px(14);
            if (avviso != null && orologio.Elapsed.TotalSeconds < avvisoFino)
            {
                Scrivi(g, avviso, fUiForte, CAmbra, x, rStato);
                return;
            }
            x = Scrivi(g, "Lette da un umano: ", fUi, CTenue, x, rStato);
            x = Scrivi(g, perc.ToString(Cultura.INV) + "% delle righe", fUiForte, CTesto, x, rStato);
            x = Scrivi(g, "  ·  ", fUi, CTenue, x, rStato);
            if (critiche > 0)
                x = Scrivi(g, critiche == 1 ? "1 riga critica non letta" : critiche.ToString(Cultura.INV) + " righe critiche non lette", fUiForte, CRosso, x, rStato);
            else
                x = Scrivi(g, "nessuna riga critica da leggere", fUiForte, CVerde, x, rStato);
            if (simulate > 0)
            {
                x = Scrivi(g, "  ·  ", fUi, CTenue, x, rStato);
                x = Scrivi(g, Cultura.Plurale(simulate, "riga", "righe") + " con attenzione simulata", fUi, CAmbra, x, rStato);
            }
            int n = File_.Righe.Count;
            string destra = n == 0 ? "" : "righe " + (primaRiga + 1).ToString(Cultura.INV) + "–" +
                Math.Min(n, primaRiga + RigheVisibili).ToString(Cultura.INV) + " di " + n.ToString(Cultura.INV) + "   ·   Esc chiude";
            int wd = Misura(g, destra, fUi);
            if (rStato.Right - Px(14) - wd > x + Px(20)) Scrivi(g, destra, fUi, CTenue, rStato.Right - Px(14) - wd, rStato);
        }

        void DisegnaPuntatore(Graphics g)
        {
            float m = S;
            PointF[] forma = new PointF[] {
                new PointF(0, 0), new PointF(0, 17), new PointF(4.5f, 13), new PointF(7.5f, 19.5f), new PointF(10, 18.5f),
                new PointF(7, 12), new PointF(12.5f, 12)
            };
            for (int i = 0; i < forma.Length; i++) forma[i] = new PointF(puntatore.X + forma[i].X * m, puntatore.Y + forma[i].Y * m);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (SolidBrush b = new SolidBrush(Color.White)) g.FillPolygon(b, forma);
            using (Pen p = new Pen(Color.Black, Math.Max(1f, m))) g.DrawPolygon(p, forma);
            g.SmoothingMode = SmoothingMode.None;
        }

        // --- finestra -------------------------------------------------------
        static Icon Icona()
        {
            using (Bitmap b = new Bitmap(32, 32, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(b))
                {
                    g.Clear(Color.Transparent);
                    DisegnaOcchio(g, 0, 0, 32, Color.FromArgb(236, 239, 243), CVerde, CSfondo);
                }
                return Icon.FromHandle(b.GetHicon());
            }
        }

        public static EsitoLettura Apri(Progetto p, string percorso, double autotest, string schermata)
        {
            try { Nativo.SetProcessDPIAware(); } catch (Exception) { }
            Application.EnableVisualStyles();
            Lettore l = new Lettore(p, percorso, autotest, schermata);
            Form f = new Form();
            f.Text = "Sguardo · " + l.File_.Relativo;
            f.BackColor = CSfondo;
            f.StartPosition = FormStartPosition.CenterScreen;
            f.Icon = Icona();
            Rectangle area = Screen.PrimaryScreen.WorkingArea;
            int w = Math.Min((int)(1000 * l.S), area.Width - (int)(60 * l.S));
            int hgt = Math.Min((int)(660 * l.S), area.Height - (int)(60 * l.S));
            f.ClientSize = new Size(w, hgt);
            f.MinimumSize = new Size((int)(520 * l.S), (int)(320 * l.S));
            l.Dock = DockStyle.Fill;
            f.Controls.Add(l);
            f.HandleCreated += (o, e) =>
            {
                int uno = 1;
                try { Nativo.DwmSetWindowAttribute(f.Handle, 20, ref uno, 4); } catch (Exception) { }
            };
            f.Shown += (o, e) => { f.Activate(); l.Focus(); l.Attivita(); };
            f.FormClosing += (o, e) => l.Chiudi();
            Application.Run(f);
            return l.Esito;
        }
    }
}
