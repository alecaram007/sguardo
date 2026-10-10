#!/bin/bash
# Avvia l'interfaccia web di Sguardo e la apre nel browser.
#   doppio clic          la demo per Mac (demo/negozio; alla prima volta è una copia di ../demo/negozio)
#   ./avvia.command <cartella>   un altro progetto con .sguardo/
# I percorsi relativi valgono dalla cartella in cui sei (come per sguardo.command).
QUI="$(cd "$(dirname "$0")" && pwd)" || exit 2
if ! command -v node >/dev/null 2>&1; then
  echo "  Serve Node.js (versione 22 o successiva): https://nodejs.org"
  read -r -p "  Premi Invio per chiudere… " _
  exit 2
fi
PORTA="${PORT:-5176}"
PORT="$PORTA" node "$QUI/server.mjs" "$@" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; wait $SERVER 2>/dev/null' EXIT INT TERM
# Aspetto che sia proprio il NOSTRO server ad ascoltare sulla porta: se la porta è già
# occupata da un altro programma, curl avrebbe risposta da quello e il browser si aprirebbe lì.
for _ in $(seq 1 50); do
  if lsof -a -p "$SERVER" -iTCP:"$PORTA" -sTCP:LISTEN >/dev/null 2>&1 &&
     curl -s -o /dev/null "http://127.0.0.1:$PORTA/api/info"; then break; fi
  if ! kill -0 $SERVER 2>/dev/null; then
    read -r -p "  Il server non è partito. Premi Invio per chiudere… " _
    exit 2
  fi
  sleep 0.1
done
open "http://localhost:$PORTA/"
echo "  Chiudi questa finestra (o premi Ctrl+C) per spegnere Sguardo."
wait $SERVER
