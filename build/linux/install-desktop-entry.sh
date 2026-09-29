#!/bin/sh
# Adds Tulip File Explorer to your application menu with its icon.
# For the portable tar.gz build; the .deb and AppImage set this up themselves.
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"

mkdir -p "$APPS"
for size in 16 32 48 64 128 256 512; do
    if [ -f "$APP_DIR/icons/${size}x${size}.png" ]; then
        mkdir -p "$ICONS/${size}x${size}/apps"
        cp "$APP_DIR/icons/${size}x${size}.png" "$ICONS/${size}x${size}/apps/tulip-file-explorer.png"
    fi
done

cat > "$APPS/tulip-file-explorer.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Tulip File Explorer
Comment=A modern cross-platform file explorer
Exec="$APP_DIR/tulip-file-explorer" %U
Icon=tulip-file-explorer
Terminal=false
Categories=Utility;FileManager;System;
StartupWMClass=tulip-file-explorer
DESKTOP

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$ICONS" >/dev/null 2>&1 || true

echo "Tulip File Explorer added to your applications menu."
