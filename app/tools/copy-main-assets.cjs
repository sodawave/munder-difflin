'use strict';

const { copyFileSync, mkdirSync, statSync } = require('node:fs');
const { dirname, join } = require('node:path');

const ROOT = join(__dirname, '..');
const MAIN_ASSETS = [
  ['src/main/slack-trigger.cjs', 'out/main/slack-trigger.cjs'],
  // Knowledge Graph core (pure-JS, no native deps) — required by knowledge.ts.
  ['src/main/kg-core.cjs', 'out/main/kg-core.cjs'],
  // Additive network bridge cores (required by deviceSeal.ts / topics.ts).
  ['src/main/network/deviceSealCore.cjs', 'out/main/network/deviceSealCore.cjs'],
  ['src/main/network/topics.cjs', 'out/main/network/topics.cjs'],
];

for (const [fromRel, toRel] of MAIN_ASSETS) {
  const from = join(ROOT, fromRel);
  const to = join(ROOT, toRel);

  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);

  const copied = statSync(to);
  if (!copied.isFile() || copied.size === 0) {
    throw new Error(`Failed to copy required main-process asset: ${fromRel} -> ${toRel}`);
  }
  console.log(`[copy-main-assets] ${fromRel} -> ${toRel}`);
}
