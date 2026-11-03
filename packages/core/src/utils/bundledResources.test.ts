/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isBinaryMode,
  resolveBundledResourcePath,
} from './bundledResources.js';

describe('bundledResources', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects binary mode from IS_BINARY', () => {
    expect(isBinaryMode()).toBe(false);
    vi.stubEnv('IS_BINARY', 'true');
    expect(isBinaryMode()).toBe(true);
  });

  it('returns the fallback path outside binary mode', () => {
    expect(resolveBundledResourcePath('docs', '/fallback/docs')).toBe(
      '/fallback/docs',
    );
  });

  it('returns the fallback when the sidecar is missing in binary mode', () => {
    vi.stubEnv('IS_BINARY', 'true');
    expect(resolveBundledResourcePath('missing-sidecar', '/fallback')).toBe(
      '/fallback',
    );
  });
});
