#!/bin/bash
# Sguardo dalla riga di comando. Esempi:
#   ./sguardo.command rapporto ../demo/negozio
#   ./sguardo.command verifica ../demo/negozio --solo-letture
# Con un doppio clic (senza argomenti) mostra l'aiuto e aspetta Invio.
# Come sguardo.cmd su Windows, i percorsi relativi valgono dalla cartella in cui sei.
QUI="$(cd "$(dirname "$0")" && pwd)" || exit 2
if ! command -v node >/dev/null 2>&1; then
  echo "  Serve Node.js (versione 22 o successiva): https://nodejs.org"
  exit 2
fi
node "$QUI/bin/sguardo.mjs" "$@"
codice=$?
if [ $# -eq 0 ] && [ -t 0 ]; then
  echo
  read -r -p "  Premi Invio per chiudere… " _
fi
exit $codice
