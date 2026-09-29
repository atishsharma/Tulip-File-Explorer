#!/bin/sh
# Removes the menu entry and icons added by install-desktop-entry.sh
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
rm -f "$APPS/tulip-file-explorer.desktop"
rm -f "$ICONS"/*/apps/tulip-file-explorer.png
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
echo "Tulip File Explorer removed from your applications menu."
