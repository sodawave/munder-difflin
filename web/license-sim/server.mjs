#!/usr/bin/env node
/**
 * Local Pro / Teams license simulator — redeem MDS-* keys against an installId,
 * serve entitlement JSON for the Electron app's Refresh plan.
 *
 * Not part of the product build. Run from this directory: npm start
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const DATA_PATH = join(__dirname, '.data.json');
const TEAMS_SEAT_CAP = 5;
const TEAMS_ORG = 'org_demo';

/** Demo keys → plan (+ Teams seat metadata). Production would mint these after Stripe. */
const DEMO_KEYS = {
  'MDS-00000-00000-00000': { plan: 'pro' },
  'MDS-TEAM0-00000-00001': { plan: 'teams', orgId: TEAMS_ORG, seatId: 'seat_1', seatLabel: 'Ada' },
  'MDS-TEAM0-00000-00002': { plan: 'teams', orgId: TEAMS_ORG, seatId: 'seat_2', seatLabel: 'Jim' },
  'MDS-TEAM0-00000-00003': { plan: 'teams', orgId: TEAMS_ORG, seatId: 'seat_3', seatLabel: 'Pam' },
  'MDS-TEAM0-00000-00004': { plan: 'teams', orgId: TEAMS_ORG, seatId: 'seat_4', seatLabel: 'Dwight' },
  'MDS-TEAM0-00000-00005': { plan: 'teams', orgId: TEAMS_ORG, seatId: 'seat_5', seatLabel: 'Michael' },
  // Extra key only to exercise seat-cap rejection once 00001–00005 are bound.
  'MDS-TEAM0-00000-00006': { plan: 'teams', orgId: TEAMS_ORG, seatId: 'seat_6', seatLabel: 'Overflow' },
};

/**
 * @typedef {{
 *   keys: Record<string, { installId: string, plan: string, redeemedAt: string, orgId?: string, seatId?: string, seatLabel?: string }>,
 *   byInstall: Record<string, { plan: string, trialEndsAt: null, key: string, orgId?: string|null, seatId?: string|null, seatLabel?: string|null, networkEnabled?: boolean }>
 * }} Store
 */
/** @type {Store} */
let store = { keys: {}, byInstall: {} };

function load() {
  if (!existsSync(DATA_PATH)) return;
  try {
    store = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
    if (!store.keys) store.keys = {};
    if (!store.byInstall) store.byInstall = {};
  } catch {
    /* keep empty */
  }
}

function save() {
  try {
    writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[license-sim] persist failed:', e);
  }
}

function normalizeKey(key) {
  return String(key || '').trim().toUpperCase();
}

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function countTeamsSeats(orgId) {
  let n = 0;
  for (const row of Object.values(store.byInstall)) {
    if (row.plan === 'teams' && row.orgId === orgId) n += 1;
  }
  return n;
}

function entitlementPayload(row) {
  if (!row) {
    return {
      plan: 'community',
      trialEndsAt: null,
      orgId: null,
      seatId: null,
      seatLabel: null,
      networkEnabled: false,
    };
  }
  if (row.plan === 'teams') {
    return {
      plan: 'teams',
      trialEndsAt: row.trialEndsAt ?? null,
      orgId: row.orgId ?? TEAMS_ORG,
      seatId: row.seatId ?? null,
      seatLabel: row.seatLabel ?? null,
      networkEnabled: row.networkEnabled !== false,
    };
  }
  return {
    plan: row.plan,
    trialEndsAt: row.trialEndsAt ?? null,
    orgId: null,
    seatId: null,
    seatLabel: null,
    networkEnabled: false,
  };
}

load();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/entitlement') {
    const installId = (url.searchParams.get('installId') || '').trim();
    if (!installId) {
      sendJson(res, 400, { error: 'missing installId' });
      return;
    }
    sendJson(res, 200, entitlementPayload(store.byInstall[installId]));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/license/revoke') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      return;
    }
    const installId = String(body.installId || '').trim();
    if (!installId) {
      sendJson(res, 400, { error: 'missing installId' });
      return;
    }
    const row = store.byInstall[installId];
    if (!row) {
      sendJson(res, 200, { ok: true, revoked: false });
      return;
    }
    if (row.key && store.keys[row.key]) delete store.keys[row.key];
    delete store.byInstall[installId];
    save();
    console.log(`[license-sim] revoked installId=${installId}`);
    sendJson(res, 200, { ok: true, revoked: true, installId });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/license/redeem') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      return;
    }
    const key = normalizeKey(body.key);
    const installId = String(body.installId || '').trim();
    if (!installId) {
      sendJson(res, 400, { error: 'missing installId' });
      return;
    }
    const meta = DEMO_KEYS[key];
    if (!meta) {
      sendJson(res, 400, { error: 'unknown or invalid license key' });
      return;
    }

    // One machine per key: drop previous install binding for this key.
    const prev = store.keys[key];
    if (prev?.installId && prev.installId !== installId) {
      delete store.byInstall[prev.installId];
    }

    if (meta.plan === 'teams') {
      const already = store.byInstall[installId]?.key === key;
      const seats = countTeamsSeats(meta.orgId);
      const occupying = !!store.keys[key];
      if (!already && !occupying && seats >= TEAMS_SEAT_CAP) {
        sendJson(res, 400, { error: `team seat cap (${TEAMS_SEAT_CAP}) reached` });
        return;
      }
    }

    const redeemedAt = new Date().toISOString();
    store.keys[key] = {
      installId,
      plan: meta.plan,
      redeemedAt,
      orgId: meta.orgId,
      seatId: meta.seatId,
      seatLabel: meta.seatLabel,
    };
    store.byInstall[installId] = {
      plan: meta.plan,
      trialEndsAt: null,
      key,
      orgId: meta.orgId ?? null,
      seatId: meta.seatId ?? null,
      seatLabel: meta.seatLabel ?? null,
      networkEnabled: meta.plan === 'teams',
    };
    save();
    console.log(`[license-sim] redeemed ${key} → ${installId} (${meta.plan})`);
    sendJson(res, 200, {
      ok: true,
      plan: meta.plan,
      installId,
      redeemedAt,
      orgId: meta.orgId ?? null,
      seatId: meta.seatId ?? null,
      seatLabel: meta.seatLabel ?? null,
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[license-sim] http://127.0.0.1:${PORT}/`);
  console.log(`[license-sim] entitlement GET http://127.0.0.1:${PORT}/entitlement?installId=…`);
  console.log(`[license-sim] demo Pro  MDS-00000-00000-00000`);
  console.log(`[license-sim] demo Team MDS-TEAM0-00000-00001 … 00005 (cap ${TEAMS_SEAT_CAP})`);
});
