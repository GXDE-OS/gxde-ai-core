#!/bin/sh
# Download a standalone Node.js binary for architectures where a portable
# standalone SEA build is possible. Distro Node binaries on Debian link against
# libnode, which would make the resulting package depend on Node.js at runtime
# (and the SEA fuse lives in libnode, so postject cannot inject the blob).
# x64/arm64 come from nodejs.org; x86 (i386) is only published by the Node.js
# unofficial-builds project.
set -eu

arch="${1:?usage: fetch-node.sh x64|arm64|x86}"
version="20.19.0"
base_url="https://nodejs.org/dist"

case "$arch" in
  x64)
    sha256="b4e336584d62abefad31baecff7af167268be9bb7dd11f1297112e6eed3ca0d5"
    ;;
  arm64)
    sha256="dbe339e55eb393955a213e6b872066880bb9feceaa494f4d44c7aac205ec2ab9"
    ;;
  x86)
    base_url="https://unofficial-builds.nodejs.org/download/release"
    sha256="6c0e9b2447569ec0e02a3cca93b71372085f86ce924fca0e74a359187f04a8bc"
    ;;
  *)
    echo "Unsupported portable Node.js architecture: $arch" >&2
    exit 1
    ;;
esac

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

# The unofficial x86 build ships with debug info (~94MB). postject's WASM
# runtime cannot grow enough memory under 32-bit Node to rewrite a binary that
# large ("copyWithin on a detached ArrayBuffer"), so strip it before it is
# copied into the SEA. Stripping before injection is safe; only stripping the
# final SEA binary breaks it (see override_dh_strip in debian/rules).
if [ "$arch" = x86 ]; then
  strip "$dest/bin/node"
fi
