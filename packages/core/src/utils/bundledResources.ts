/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Returns true when the CLI is running from a Node.js SEA binary.
 */
export function isBinaryMode(): boolean {
  return process.env['IS_BINARY'] === 'true';
}

/**
 * Returns the directory containing the real executable, following symlinks.
 */
export function getBundledResourceRoot(): string {
  try {
    return path.dirname(fs.realpathSync(process.execPath));
  } catch {
    return path.dirname(process.execPath);
  }
}

/**
 * Resolves a bundled resource (skills, docs, examples, MCP bundles) that is
 * installed next to the standalone binary. In development, the provided
 * fallback path is used instead.
 */
export function resolveBundledResourcePath(
  relativePath: string,
  fallbackPath: string,
): string {
  if (isBinaryMode()) {
    const candidate = path.join(getBundledResourceRoot(), relativePath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return fallbackPath;
}
