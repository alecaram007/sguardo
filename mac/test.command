#!/bin/bash
# I test automatici di Sguardo (node --test). Esce con 1 se qualcosa non va.
cd "$(dirname "$0")" || exit 2
if ! command -v node >/dev/null 2>&1; then
  echo "  Serve Node.js (versione 22 o successiva): https://nodejs.org"
  exit 2
fi
node --test
codice=$?
echo
if [ $codice -eq 0 ]; then echo "  Tutti i test sono OK."; else echo "  Qualche test è FALLITO (codice $codice)."; fi
if [ "${SGUARDO_VELOCE:-0}" != "1" ] && [ -t 0 ]; then
  read -r -p "  Premi Invio per chiudere… " _
fi
exit $codice
