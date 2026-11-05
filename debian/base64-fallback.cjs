/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
// Preloaded (NODE_OPTIONS=--require) into scripts/build_binary.js and the
// tools it spawns (npx postject).
//
// postject embeds its LIEF WebAssembly module as a base64 data URI and decodes
// it with Buffer.from(str, 'base64'). On some hosts, notably loong64 builders
// that run under QEMU user-mode emulation, Node's SIMD base64 decoder returns
// corrupted bytes, and postject aborts with
//   "WebAssembly.instantiate(): expected magic word 00 61 73 6d, found ..."
// This probes the native decoder once and, only if it is wrong, routes
// base64/base64url string decoding through a plain JavaScript decoder.
// On a healthy host it changes nothing.

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LUT = new Int16Array(256).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LUT[ALPHABET.charCodeAt(i)] = i;
// Node accepts both alphabets regardless of the requested encoding.
LUT['-'.charCodeAt(0)] = 62;
LUT['_'.charCodeAt(0)] = 63;

function jsEncode(bytes) {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[n >> 18] +
      ALPHABET[(n >> 12) & 63] +
      ALPHABET[(n >> 6) & 63] +
      ALPHABET[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[n >> 18] +
      ALPHABET[(n >> 12) & 63] +
      ALPHABET[(n >> 6) & 63] +
      '=';
  }
  return out;
}

// Forgiving decoder matching Node's semantics: skips characters outside the
// alphabet and stops at the first '='.
function jsDecode(str) {
  const out = Buffer.alloc(Math.ceil((str.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 61) break; // '='
    const v = c < 256 ? LUT[c] : -1;
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
    }
    acc &= (1 << bits) - 1;
  }
  return out.subarray(0, n);
}

function nativeDecoderIsBroken() {
  // Large enough to take the SIMD fast paths.
  const probe = Buffer.alloc(64 * 1024);
  for (let i = 0; i < probe.length; i++) probe[i] = (i * 131 + 7) & 0xff;
  // Also cover the exact prefix postject decodes first ("\0asm\x01\0\0\0").
  probe.set([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00], 0);
  const decoded = Buffer.from(jsEncode(probe), 'base64');
  return !decoded.equals(probe);
}

const force = process.env.GXDE_FORCE_BASE64_FALLBACK === '1';
if (force || nativeDecoderIsBroken()) {
  if (!process.env.GXDE_BASE64_FALLBACK_REPORTED) {
    process.env.GXDE_BASE64_FALLBACK_REPORTED = '1';
    process.stderr.write(
      force
        ? 'base64-fallback: forced JavaScript base64 decoder.\n'
        : 'base64-fallback: WARNING: native Buffer base64 decoding is broken on ' +
            `this host (${process.platform}-${process.arch}); using a ` +
            'JavaScript decoder for the build.\n',
    );
  }
  const nativeFrom = Buffer.from;
  Buffer.from = function from(value, encodingOrOffset, length) {
    if (
      typeof value === 'string' &&
      typeof encodingOrOffset === 'string' &&
      /^base64(url)?$/i.test(encodingOrOffset)
    ) {
      return jsDecode(value);
    }
    return nativeFrom.call(this, value, encodingOrOffset, length);
  };
}
