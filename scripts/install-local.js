/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log('Usage: npm run build:install -- [--prefix /installation/path]');
  console.log('Default prefix: ~/.local. Requires Node.js 20 or newer.');
  process.exit(0);
}

if (process.platform === 'win32') {
  throw new Error(
    'This installer supports Linux and macOS. Use build:binary on Windows.',
  );
}

if (args.length !== 0 && (args.length !== 2 || args[0] !== '--prefix')) {
  throw new Error(
    'Usage: npm run build:install -- [--prefix /installation/path]',
  );
}

const prefix = path.resolve(args[1] ?? path.join(homedir(), '.local'));
const library = path.join(prefix, 'lib', 'gxde-ai-core');
const executable = path.join(prefix, 'bin', 'gxde-ai-core');
const bundle = path.join(root, 'bundle');

if (!existsSync(path.join(bundle, 'gemini.js'))) {
  throw new Error('Missing build output. Run npm run build:install first.');
}

const acceptedTargets = [
  path.join(library, 'bundle', 'gemini.js'),
  path.join(
    prefix,
    'lib',
    'node_modules',
    'gxde-ai-core',
    'bundle',
    'gemini.js',
  ),
  path.join(root, 'bundle', 'gemini.js'),
];

function existingLink(file, targets) {
  try {
    const stat = lstatSync(file);

    if (!stat.isSymbolicLink()) {
      throw new Error(`Refusing to replace an existing file: ${file}`);
    }

    const previous = readlinkSync(file);

    if (!targets.includes(path.resolve(path.dirname(file), previous))) {
      throw new Error(`Refusing to replace an unrelated executable: ${file}`);
    }

    return previous;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

const links = [
  {
    file: executable,
    target: '../lib/gxde-ai-core/bundle/gemini.js',
    previous: existingLink(executable, acceptedTargets),
  },
];

if (existsSync(library)) {
  const manifest = path.join(library, 'package.json');

  if (
    !existsSync(manifest) ||
    JSON.parse(readFileSync(manifest, 'utf8')).name !== 'gxde-ai-core'
  ) {
    throw new Error(`Refusing to replace an unrelated directory: ${library}`);
  }
}

mkdirSync(path.dirname(library), { recursive: true });
mkdirSync(path.dirname(executable), { recursive: true });
const staging = mkdtempSync(
  path.join(path.dirname(library), '.gxde-ai-core-install-'),
);
const application = path.join(staging, 'application');
const backup = path.join(staging, 'previous');
let movedPrevious = false;
let installed = false;

function copyDependency(name, from, destination, optional = false) {
  const require = createRequire(path.join(from, 'package.json'));
  let manifest;

  try {
    manifest = require.resolve(`${name}/package.json`);
  } catch (error) {
    if (optional && error.code === 'MODULE_NOT_FOUND') {
      return;
    }

    throw error;
  }

  const dependency = JSON.parse(readFileSync(manifest, 'utf8'));
  const target = path.join(destination, 'node_modules', name);

  if (existsSync(target)) {
    return;
  }

  cpSync(path.dirname(manifest), target, {
    recursive: true,
    dereference: true,
  });

  for (const child of Object.keys(dependency.dependencies ?? {})) {
    copyDependency(child, path.dirname(manifest), target);
  }

  for (const child of Object.keys(dependency.optionalDependencies ?? {})) {
    copyDependency(child, path.dirname(manifest), target, true);
  }
}

try {
  mkdirSync(application);
  cpSync(bundle, path.join(application, 'bundle'), {
    recursive: true,
    dereference: true,
  });
  const metadata = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8'),
  );

  for (const name of Object.keys(metadata.optionalDependencies ?? {})) {
    copyDependency(name, root, application, true);
  }

  writeFileSync(
    path.join(application, 'package.json'),
    JSON.stringify(
      {
        name: metadata.name,
        version: metadata.version,
        type: 'module',
        license: metadata.license,
        bin: { 'gxde-ai-core': 'bundle/gemini.js' },
      },
      null,
      2,
    ) + '\n',
  );

  for (const name of ['LICENSE', 'NOTICE']) {
    cpSync(path.join(root, name), path.join(application, name));
  }

  chmodSync(path.join(application, 'bundle', 'gemini.js'), 0o755);

  if (existsSync(library)) {
    renameSync(library, backup);
    movedPrevious = true;
  }

  renameSync(application, library);
  installed = true;

  for (const link of links) {
    if (link.previous !== undefined) {
      rmSync(link.file);
      link.removed = true;
    }

    symlinkSync(link.target, link.file);
    link.created = true;
  }

  console.log(`Installed ${metadata.name} ${metadata.version} to ${library}`);
  console.log(`Run: ${executable}`);

  if (
    !(process.env['PATH'] ?? '')
      .split(path.delimiter)
      .includes(path.dirname(executable))
  ) {
    console.log(`Add ${path.dirname(executable)} to your PATH.`);
  }
} catch (error) {
  if (installed) {
    rmSync(library, { recursive: true, force: true });
  }

  if (movedPrevious) {
    renameSync(backup, library);
  }

  for (const link of links) {
    if (link.created) {
      rmSync(link.file, { force: true });
    }

    if (link.removed) {
      symlinkSync(link.previous, link.file);
    }
  }

  throw error;
} finally {
  rmSync(staging, { recursive: true, force: true });
}
