#!/usr/bin/env node
/**
 * Local Pro license simulator — redeem MDS-* keys against an installId,
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

/** Demo keys → plan. Production would mint these after Stripe. */
const DEMO_KEYS = {
  'MDS-00000-00000-00000': 'pro',
};

/** @type {{ keys: Record<string, { installId: string, plan: string, redeemedAt: string }>, byInstall: Record<string, { plan: string, trialEndsAt: null, key: string }> }} */
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
    const row = store.byInstall[installId];
    if (!row) {
      sendJson(res, 200, { plan: 'community', trialEndsAt: null });
      return;
    }
    sendJson(res, 200, { plan: row.plan, trialEndsAt: row.trialEndsAt ?? null });
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
    const plan = DEMO_KEYS[key];
    if (!plan) {
      sendJson(res, 400, { error: 'unknown or invalid license key' });
      return;
    }
    // One machine per key: drop previous install binding for this key.
    const prev = store.keys[key];
    if (prev?.installId && prev.installId !== installId) {
      delete store.byInstall[prev.installId];
    }
    const redeemedAt = new Date().toISOString();
    store.keys[key] = { installId, plan, redeemedAt };
    store.byInstall[installId] = { plan, trialEndsAt: null, key };
    save();
    console.log(`[license-sim] redeemed ${key} → ${installId} (${plan})`);
    sendJson(res, 200, { ok: true, plan, installId, redeemedAt });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[license-sim] http://127.0.0.1:${PORT}/`);
  console.log(`[license-sim] entitlement GET http://127.0.0.1:${PORT}/entitlement?installId=…`);
  console.log(`[license-sim] demo key MDS-00000-00000-00000`);
});
