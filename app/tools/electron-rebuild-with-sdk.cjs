#!/usr/bin/env node
/**
 * Run electron-rebuild with a Darwin SDK libc++ fallback when Command Line
 * Tools ship an incomplete usr/include/c++/v1 tree (missing <functional>).
 *
 * Observed on some macOS 15+/CLT 26 installs: clang searches
 *   /Library/Developer/CommandLineTools/usr/include/c++/v1
 * but the real headers live under the MacOSX SDK. Without -isystem to the SDK
 * path, node-pty's native build fails with: fatal error: 'functional' file not found.
 *
 * No-op adjustment on non-darwin or when CLT headers are already complete.
 * Never throws for detection failures — rebuild still runs with ambient env.
 */
'use strict';

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = { ...process.env };

function applyDarwinSdkFallback() {
  if (process.platform !== 'darwin') return;

  const cltFunctional =
    '/Library/Developer/CommandLineTools/usr/include/c++/v1/functional';
  if (fs.existsSync(cltFunctional)) return;

  let sdkRoot = env.SDKROOT;
  if (!sdkRoot) {
    try {
      sdkRoot = execSync('xcrun --show-sdk-path', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      console.warn(
        '[electron-rebuild-with-sdk] xcrun --show-sdk-path failed; rebuild may fail without SDKROOT',
      );
      return;
    }
  }

  const isystem = path.join(sdkRoot, 'usr/include/c++/v1');
  if (!fs.existsSync(path.join(isystem, 'functional'))) {
    console.warn(
      `[electron-rebuild-with-sdk] SDK libc++ not found at ${isystem}; rebuild may fail`,
    );
    return;
  }

  env.SDKROOT = sdkRoot;
  const flag = `-isystem ${isystem}`;
  env.CXXFLAGS = env.CXXFLAGS ? `${env.CXXFLAGS} ${flag}` : flag;
  console.log(
    `[electron-rebuild-with-sdk] CLT libc++ incomplete; SDKROOT=${sdkRoot} CXXFLAGS+=${flag}`,
  );
}

applyDarwinSdkFallback();

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['electron-rebuild', '-f'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: path.join(__dirname, '..'),
});

if (result.error) {
  console.error('[electron-rebuild-with-sdk]', result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
