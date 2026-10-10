#!/bin/bash
# La demo narrata di Sguardo (crea mac/demo/ e la ricrea a ogni esecuzione).
#   SGUARDO_VELOCE=1 ./demo.command    senza attese, autotest del lettore di 2 s
cd "$(dirname "$0")" || exit 2
if ! command -v node >/dev/null 2>&1; then
  echo "  Serve Node.js (versione 22 o successiva): https://nodejs.org"
  exit 2
fi
node bin/demo.mjs "$@"
codice=$?
if [ "${SGUARDO_VELOCE:-0}" != "1" ] && [ -t 0 ]; then
  echo
  read -r -p "  Premi Invio per chiudere… " _
fi
exit $codice
