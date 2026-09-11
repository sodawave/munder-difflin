#!/usr/bin/env node
/**
 * Automated SPEC gate for mqtt-additive-bridge.
 * Exit 0 only when typecheck + network-focused tests + merge hygiene pass.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');

function run(cmd, args, cwd) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error(`\nFAIL: ${cmd} ${args.join(' ')} (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

run('npm', ['run', 'typecheck'], appRoot);

run(
  'node',
  [
    '--test',
    'test/device-seal.test.cjs',
    'test/network-topics.test.cjs',
    'test/network-bridge.spec.test.cjs',
  ],
  appRoot
);

// Merge hygiene (AD-12): these files must be untouched on this feature branch.
const forbidden = [
  'app/src/main/hive.ts',
  'app/src/main/hiveNudge.ts',
  'app/src/renderer/src/hooks/useHive.ts',
  'app/src/renderer/src/hooks/useHive.tsx',
  'app/src/main/workerWake.ts',
];
const diff = spawnSync('git', ['diff', '--name-only', 'dev...HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
const unstaged = spawnSync('git', ['diff', '--name-only'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
const changed = new Set(
  `${diff.stdout || ''}\n${unstaged.stdout || ''}\n${untracked.stdout || ''}`
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
);

const hits = forbidden.filter((f) => changed.has(f));
if (hits.length) {
  console.error('\nFAIL: AD-12 hygiene — forbidden files changed:\n', hits.join('\n'));
  process.exit(1);
}

console.log('\nOK: SPEC mqtt-additive-bridge verification green (typecheck + CAP tests + AD-12 hygiene)');
