/**
 * @license
 * Copyright 2026 CharOfString <root@charofstring.cc>
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const NODE_ARCH_TO_DEB = {
  x64: 'amd64',
  arm64: 'arm64',
  arm: 'armhf',
  ia32: 'i386',
};

function parseArgs(argv) {
  const args = {
    skipBuild: false,
    arch: undefined,
    output: undefined,
    version: undefined,
    maintainer:
      process.env['DEB_MAINTAINER'] || 'CharOfString <root@charofstring.cc>',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--skip-build') {
      args.skipBuild = true;
    } else if (arg === '--arch') {
      args.arch = argv[++i];
    } else if (arg.startsWith('--arch=')) {
      args.arch = arg.slice('--arch='.length);
    } else if (arg === '--output') {
      args.output = argv[++i];
    } else if (arg.startsWith('--output=')) {
      args.output = arg.slice('--output='.length);
    } else if (arg === '--version') {
      args.version = argv[++i];
    } else if (arg.startsWith('--version=')) {
      args.version = arg.slice('--version='.length);
    } else if (arg === '--maintainer') {
      args.maintainer = argv[++i];
    } else if (arg.startsWith('--maintainer=')) {
      args.maintainer = arg.slice('--maintainer='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/build_deb.js [options]

Builds a .deb from the standalone Node SEA binary.

Options:
  --skip-build          Reuse an existing dist/linux-<arch> build
  --arch <deb-arch>     Debian architecture (default: derived from process.arch)
  --output <dir>        Output directory (default: dist)
  --version <version>   Package version (default: package.json version)
  --maintainer <value>  Maintainer field
  --help                Show this help`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status}: ${command} ${args.join(' ')}`,
    );
  }
}

function ensureDpkgDeb() {
  const result = spawnSync('dpkg-deb', ['--version'], {
    stdio: 'ignore',
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      'dpkg-deb is required to build a .deb. Install dpkg-dev or run this on Debian/Ubuntu.',
    );
  }
}

function directorySize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        total += statSync(fullPath).size;
      }
    }
  }
  return total;
}

function buildControlFile({
  version,
  arch,
  maintainer,
  installedSize,
  description,
}) {
  return `Package: gxde-ai-core
Version: ${version}
Section: utils
Priority: optional
Architecture: ${arch}
Maintainer: ${maintainer}
Installed-Size: ${installedSize}
Depends: libc6 (>= 2.28), libstdc++6
Recommends: git, libsecret-1-0
Description: ${description}
 Hachimi CLI is a terminal AI coding agent with provider-account
 authentication and support for domestic model providers.
`;
}

function buildChangelog(version, maintainer) {
  const date = new Date().toUTCString();
  return `gxde-ai-core (${version}) unstable; urgency=medium

  * Package build.

 -- ${maintainer}  ${date}
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.platform !== 'linux') {
    throw new Error(
      'Debian packages can only be built on Linux. Use a Linux CI runner or container.',
    );
  }

  const packageJson = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
  );
  const version = args.version || packageJson.version;
  const debArch = args.arch || NODE_ARCH_TO_DEB[process.arch];
  if (!debArch) {
    throw new Error(`Unsupported architecture: ${process.arch}`);
  }
  const hostDebArch = NODE_ARCH_TO_DEB[process.arch];
  if (args.arch && args.arch !== hostDebArch) {
    console.warn(
      `Warning: package architecture ${args.arch} does not match the host binary architecture ${hostDebArch}. ` +
        'Node SEA cannot cross-compile; build on a matching runner.',
    );
  }

  const distDir = join(root, 'dist', `linux-${process.arch}`);
  const binaryPath = join(distDir, 'gxde-ai-core');
  const outputDir = args.output
    ? isAbsolute(args.output)
      ? args.output
      : join(root, args.output)
    : join(root, 'dist');
  const outputPath = join(outputDir, `gxde-ai-core_${version}_${debArch}.deb`);

  if (!args.skipBuild) {
    console.log('Building standalone binary...');
    run('npm', ['run', 'build:binary']);
  }

  if (!existsSync(binaryPath)) {
    throw new Error(
      `Standalone binary not found at ${binaryPath}. Run "npm run build:binary" first, or omit --skip-build.`,
    );
  }

  ensureDpkgDeb();

  const stageRoot = join(root, 'build', 'deb');
  const packageRoot = join(stageRoot, `gxde-ai-core_${version}_${debArch}`);
  const debianDir = join(packageRoot, 'DEBIAN');
  const libDir = join(packageRoot, 'usr', 'lib', 'gxde-ai-core');
  const binDir = join(packageRoot, 'usr', 'bin');
  const docDir = join(packageRoot, 'usr', 'share', 'doc', 'gxde-ai-core');

  console.log(`Staging package in ${packageRoot}...`);
  rmSync(packageRoot, { recursive: true, force: true });
  mkdirSync(debianDir, { recursive: true });
  mkdirSync(libDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(docDir, { recursive: true });

  // Install the SEA binary and all sidecar resources produced by
  // scripts/build_binary.js (builtin skills, docs, bundled MCP, examples).
  cpSync(distDir, libDir, { recursive: true });
  chmodSync(join(libDir, 'gxde-ai-core'), 0o755);

  symlinkSync('../lib/gxde-ai-core/gxde-ai-core', join(binDir, 'gxde-ai-core'));
  symlinkSync('gxde-ai-core', join(binDir, 'hachimi'));

  const licensePath = join(root, 'LICENSE');
  if (existsSync(licensePath)) {
    cpSync(licensePath, join(docDir, 'copyright'));
  }
  const noticePath = join(root, 'NOTICE');
  if (existsSync(noticePath)) {
    cpSync(noticePath, join(docDir, 'NOTICE'));
  }

  writeFileSync(
    join(docDir, 'changelog.Debian.gz'),
    gzipSync(buildChangelog(version, args.maintainer)),
  );

  const installedSize = Math.ceil(directorySize(packageRoot) / 1024);
  writeFileSync(
    join(debianDir, 'control'),
    buildControlFile({
      version,
      arch: debArch,
      maintainer: args.maintainer,
      installedSize,
      description: 'terminal AI coding agent',
    }),
  );

  mkdirSync(outputDir, { recursive: true });
  console.log(`Building ${relative(root, outputPath)}...`);
  run('dpkg-deb', [
    '--build',
    '--root-owner-group',
    '-Zxz',
    packageRoot,
    outputPath,
  ]);

  console.log(`\nCreated ${outputPath}`);
  console.log('Inspect with:');
  console.log(`  dpkg-deb -I ${relative(root, outputPath)}`);
  console.log(`  dpkg-deb -c ${relative(root, outputPath)}`);
}

try {
  main();
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
