#!/bin/sh
# Download the official Node.js binary for architectures where a portable
# standalone SEA build is possible. Distro Node binaries on Debian link against
# libnode, which would make the resulting package depend on Node.js at runtime.
set -eu

arch="${1:?usage: fetch-node.sh x64|arm64}"
version="20.19.0"

case "$arch" in
  x64)
    sha256="b4e336584d62abefad31baecff7af167268be9bb7dd11f1297112e6eed3ca0d5"
    ;;
  arm64)
    sha256="dbe339e55eb393955a213e6b872066880bb9feceaa494f4d44c7aac205ec2ab9"
    ;;
  *)
    echo "Unsupported official Node.js architecture: $arch" >&2
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

echo "Downloading official Node.js $version for linux-$arch..."
curl -fsSL \
  "https://nodejs.org/dist/v$version/node-v$version-linux-$arch.tar.xz" \
  -o "$tarball"
echo "$sha256  $tarball" | sha256sum -c -

mkdir -p "$dest"
tar -xJf "$tarball" -C "$dest" --strip-components=1
rm -f "$tarball"
