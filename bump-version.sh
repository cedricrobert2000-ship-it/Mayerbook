#!/bin/sh
# Force les navigateurs à recharger CSS/JS après une mise à jour (cache de GitHub Pages).
# Usage : ./bump-version.sh  (puis commit)
V=$(date +%Y%m%d%H%M)
sed -i.bak -E "s#\?v=[0-9]+#?v=$V#g" index.html && rm -f index.html.bak
echo "Version des fichiers : $V"
