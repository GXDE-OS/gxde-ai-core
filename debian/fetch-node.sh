#!/bin/sh
# Download a standalone Node.js binary for architectures where a portable
# standalone SEA build is possible. Distro Node binaries on Debian link against
# libnode, which would make the resulting package depend on Node.js at runtime
# (and the SEA fuse lives in libnode, so postject cannot inject the blob).
# x64/arm64 come from nodejs.org; x86 (i386), loong64 and riscv64 are only
# published by the Node.js unofficial-builds project.
set -eu

arch="${1:?usage: fetch-node.sh x64|arm64|x86|loong64|riscv64}"
version="20.19.0"
base_url="https://nodejs.org/dist"
unofficial=""

case "$arch" in
  x64)
    sha256="b4e336584d62abefad31baecff7af167268be9bb7dd11f1297112e6eed3ca0d5"
    ;;
  arm64)
    sha256="dbe339e55eb393955a213e6b872066880bb9feceaa494f4d44c7aac205ec2ab9"
    ;;
  x86)
    unofficial=1
    sha256="6c0e9b2447569ec0e02a3cca93b71372085f86ce924fca0e74a359187f04a8bc"
    ;;
  loong64)
    # unofficial-builds only publishes loong64 from v20.19.5 onward.
    unofficial=1
    version="20.19.5"
    sha256="e97e50293d1c545a68f42d2c27f7de92ccf8c8a49e4b79692641ea2fe0461272"
    ;;
  riscv64)
    unofficial=1
    sha256="c015869d4bf0104fe259f3abd75f307e296adee9ba269ebdc294da962aad1f09"
    ;;
  *)
    echo "Unsupported portable Node.js architecture: $arch" >&2
    exit 1
    ;;
esac

if [ -n "$unofficial" ]; then
  base_url="https://unofficial-builds.nodejs.org/download/release"
fi

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
root="$(dirname -- "$script_dir")"
dest="$root/debian/.node"
tarball="$root/debian/.node.tar.xz"

if [ -x "$dest/bin/node" ]; then
  exit 0
fi

echo "Downloading Node.js $version for linux-$arch from $base_url..."
curl -fsSL \
  "$base_url/v$version/node-v$version-linux-$arch.tar.xz" \
  -o "$tarball"
echo "$sha256  $tarball" | sha256sum -c -

mkdir -p "$dest"
tar -xJf "$tarball" -C "$dest" --strip-components=1
rm -f "$tarball"

# Unofficial builds ship with debug info (~95MB). On x86, postject's WASM
# runtime cannot grow enough memory under 32-bit Node to rewrite a binary that
# large ("copyWithin on a detached ArrayBuffer"); elsewhere it only bloats the
# package. Strip it before it is copied into the SEA. Stripping before
# injection is safe; only stripping the final SEA binary breaks it (see
# override_dh_strip in debian/rules).
if [ -n "$unofficial" ]; then
  strip "$dest/bin/node"
fi
