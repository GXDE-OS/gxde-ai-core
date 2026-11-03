/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const installer = fileURLToPath(
  new URL('../install-local.js', import.meta.url),
);
let temporary;
let checkout;
let prefix;

function write(relative, contents) {
  const filename = path.join(checkout, relative);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, contents);
}

function install() {
  return spawnSync(
    process.execPath,
    [path.join(checkout, 'scripts/install-local.js'), '--prefix', prefix],
    { encoding: 'utf8' },
  );
}

describe.skipIf(process.platform === 'win32')('local installation', () => {
  beforeEach(() => {
    temporary = mkdtempSync(path.join(tmpdir(), 'gxde-ai-core-installer-test-'));
    checkout = path.join(temporary, 'source');
    prefix = path.join(temporary, 'prefix with spaces');
    write(
      'package.json',
      JSON.stringify({
        name: 'gxde-ai-core',
        version: '1.0.0',
        type: 'module',
        optionalDependencies: { native: '1.0.0', absent: '1.0.0' },
      }),
    );
    write('scripts/install-local.js', '');
    cpSync(installer, path.join(checkout, 'scripts/install-local.js'));
    write(
      'bundle/gemini.js',
      '#!/usr/bin/env node\nimport native from "native"; console.log(native);\n',
    );
    write(
      'node_modules/native/package.json',
      JSON.stringify({
        name: 'native',
        main: 'index.cjs',
        dependencies: { nested: '1.0.0' },
      }),
    );
    write(
      'node_modules/native/index.cjs',
      'module.exports = require("nested");',
    );
    write(
      'node_modules/nested/package.json',
      JSON.stringify({ name: 'nested', main: 'index.cjs' }),
    );
    write(
      'node_modules/nested/index.cjs',
      'module.exports = "installed independently";',
    );
    write('LICENSE', 'license text');
    write('NOTICE', 'attribution');
  });

  afterEach(() => {
    rmSync(temporary, { recursive: true, force: true });
  });

  it('runs with transitive dependencies after removing the checkout', () => {
    expect(install().status).toBe(0);
    rmSync(checkout, { recursive: true });
    const result = spawnSync(
      process.execPath,
      [path.join(prefix, 'bin/gxde-ai-core')],
      {
        cwd: temporary,
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.stdout.trim()).toBe('installed independently');
    expect(
      readFileSync(path.join(prefix, 'lib/gxde-ai-core/NOTICE'), 'utf8'),
    ).toBe('attribution');
    expect(existsSync(path.join(prefix, 'bin/gemini'))).toBe(false);
  });

  it('updates an existing installation', () => {
    expect(install().status).toBe(0);
    write('node_modules/nested/index.cjs', 'module.exports = "updated";');
    expect(install().status).toBe(0);
    const result = spawnSync(
      process.execPath,
      [path.join(prefix, 'bin/gxde-ai-core')],
      {
        encoding: 'utf8',
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.stdout.trim()).toBe('updated');
  });

  it('leaves an unrelated executable intact', () => {
    mkdirSync(path.join(prefix, 'bin'), { recursive: true });
    writeFileSync(path.join(prefix, 'bin/gxde-ai-core'), 'do not overwrite');
    expect(install().status).not.toBe(0);
    expect(readFileSync(path.join(prefix, 'bin/gxde-ai-core'), 'utf8')).toBe(
      'do not overwrite',
    );
  });

  it('keeps the previous installation if preparing the update fails', () => {
    expect(install().status).toBe(0);
    rmSync(path.join(checkout, 'node_modules/nested'), { recursive: true });
    expect(install().status).not.toBe(0);
    const result = spawnSync(
      process.execPath,
      [path.join(prefix, 'bin/gxde-ai-core')],
      {
        encoding: 'utf8',
      },
    );
    expect(result.stdout.trim()).toBe('installed independently');
  });
});
