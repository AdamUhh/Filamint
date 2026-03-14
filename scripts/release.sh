#!/bin/bash
# scripts/release.sh
set -e

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  exit 1
fi

REPO="AdamUhh/filamint"
BIN_DIR="./bin"
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "→ Building..."
wails3 task common:update:build-assets
wails3 package

echo "→ Generating latest.json..."
cat > latest.json << EOF
{
  "version": "$VERSION",
  "notes": "Release v$VERSION",
  "pub_date": "$DATE",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/$REPO/releases/download/v$VERSION/filamint-windows-amd64.exe"
    },
    "darwin-x86_64": {
      "url": "https://github.com/$REPO/releases/download/v$VERSION/filamint-darwin-amd64.dmg"
    },
    "darwin-aarch64": {
      "url": "https://github.com/$REPO/releases/download/v$VERSION/filamint-darwin-arm64.dmg"
    },
    "linux-x86_64": {
      "url": "https://github.com/$REPO/releases/download/v$VERSION/filamint-linux-amd64.AppImage"
    }
  }
}
EOF

echo "→ Creating GitHub release v$VERSION and uploading assets..."
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes "Release v$VERSION" \
  $BIN_DIR/* \
  latest.json

echo "✓ Done! Make sure you edit your release description:"
echo "https://github.com/$REPO/releases/tag/v$VERSION"
