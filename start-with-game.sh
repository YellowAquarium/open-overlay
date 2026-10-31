#!/bin/sh
# Open Overlay - start the proxy together with Subway Builder (macOS / Linux).
#
#   Steam (recommended): Subway Builder > Properties > Launch Options:
#       "/full/path/to/open-overlay/start-with-game.sh" %command%
#   Then just play from Steam. The proxy runs in the background and stops when the game closes.
#
#   Or run this file directly (macOS: double-click start-with-game.command) to start the proxy and the game.
#
# The proxy writes its log to logs/proxy.log.

DIR="$(cd "$(dirname "$0")" && pwd)"
# Steam and Finder don't load your shell profile, so add the usual Node.js locations.
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:$HOME/.volta/bin:$HOME/.local/bin"
for nvm_node in "$HOME"/.nvm/versions/node/*/bin; do [ -d "$nvm_node" ] && PATH="$PATH:$nvm_node"; done
export PATH

if [ "$#" -gt 0 ]; then
  # Started by Steam with %command%: run the game and a proxy that follows its process.
  "$@" &
  GAME_PID=$!
  if command -v node >/dev/null 2>&1; then
    nohup node "$DIR/proxy.js" --game-pid "$GAME_PID" >/dev/null 2>&1 &
  else
    echo "Open Overlay: Node.js not found, proxy not started." >&2
  fi
  wait "$GAME_PID"
  exit $?
fi

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js was not found. Install it from https://nodejs.org/ and try again.'
  exit 1
fi
nohup node "$DIR/proxy.js" --with-game --launch-game >/dev/null 2>&1 &
echo 'Open Overlay proxy started in the background; it stops by itself when Subway Builder closes.'
