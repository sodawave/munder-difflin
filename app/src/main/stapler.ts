/**
 * Stapler — Pro floating puck window (screenshot → note → send path to god).
 */
import { BrowserWindow, desktopCapturer, screen, ipcMain, type WebContents } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canUse, getEntitlementSnapshot, setStaplerEnabled } from './entitlements';
import { readConfig } from './config';
import type { HiveManager, HiveMessage } from './hive';

let staplerWin: BrowserWindow | null = null;
let selectionWin: BrowserWindow | null = null;
let invisible = false;
let hiveRef: HiveManager | null = null;
let preloadPath = '';
let isDev = false;
let rendererDevUrl = '';

export function initStapler(opts: {
  hive: HiveManager;
  preload: string;
  isDev: boolean;
  rendererDevUrl: string;
}): void {
  hiveRef = opts.hive;
  preloadPath = opts.preload;
  isDev = opts.isDev;
  rendererDevUrl = opts.rendererDevUrl;

  ipcMain.handle('stapler:getState', () => {
    const snap = getEntitlementSnapshot();
    return {
      enabled: snap.state.staplerEnabled,
      canUse: canUse('stapler'),
      invisible,
      open: !!(staplerWin && !staplerWin.isDestroyed()),
    };
  });

  ipcMain.handle('stapler:setEnabled', (_evt, on: unknown) => {
    const state = setStaplerEnabled(on === true);
    const allowed = canUse('stapler') && state.staplerEnabled;
    if (allowed) openStaplerWindow();
    else closeStaplerWindow();
    return { ok: allowed || !on, state, canUse: canUse('stapler') };
  });

  ipcMain.handle('stapler:setInvisible', (_evt, on: unknown) => {
    invisible = on === true;
    applyInvisible();
    return { ok: true, invisible };
  });

  ipcMain.handle('stapler:beginCapture', async () => {
    if (!canUse('stapler')) return { ok: false as const, error: 'Pro or trial required' };
    return beginRegionCapture();
  });

  ipcMain.handle('stapler:finishCapture', async (_evt, payload: unknown) => {
    const p = (payload ?? {}) as { x?: number; y?: number; width?: number; height?: number };
    if (typeof p.x !== 'number' || typeof p.y !== 'number'
      || typeof p.width !== 'number' || typeof p.height !== 'number'
      || p.width < 4 || p.height < 4) {
      closeSelectionWindow();
      showPuck();
      return { ok: false as const, error: 'invalid region' };
    }
    try {
      const path = await captureRegion(p.x, p.y, p.width, p.height);
      closeSelectionWindow();
      showNoteCard(path);
      return { ok: true as const, path };
    } catch (e) {
      closeSelectionWindow();
      showPuck();
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('stapler:resizeNote', () => {
    if (staplerWin && !staplerWin.isDestroyed()) {
      staplerWin.setSize(320, 240);
      staplerWin.show();
    }
    return { ok: true };
  });

  ipcMain.handle('stapler:resizePuck', () => {
    showPuck();
    return { ok: true };
  });

  ipcMain.handle('stapler:cancelCapture', () => {
    closeSelectionWindow();
    showPuck();
    return { ok: true };
  });

  ipcMain.handle('stapler:sendToOrchestrator', (_evt, payload: unknown) => {
    const p = (payload ?? {}) as { path?: unknown; note?: unknown };
    if (typeof p.path !== 'string' || !p.path) return { ok: false, error: 'missing path' };
    if (!hiveRef || !hiveRef.enabled()) return { ok: false, error: 'hive disabled (no harnessHome)' };
    const note = typeof p.note === 'string' ? p.note.trim() : '';
    const body = [
      'Stapler capture for the orchestrator.',
      `Path: ${p.path}`,
      note ? `Note: ${note}` : 'Note: (none)',
    ].join('\n');
    const msg: HiveMessage = hiveRef.send({
      to: 'god',
      act: 'inform',
      subject: 'Stapler capture',
      body,
    }, 'human');
    showPuck();
    return { ok: true, message: msg };
  });
}

export function syncStaplerFromEntitlements(): void {
  const snap = getEntitlementSnapshot();
  if (snap.state.staplerEnabled && canUse('stapler')) openStaplerWindow();
  else closeStaplerWindow();
}

function capturesDir(): string | null {
  const home = readConfig().harnessHome;
  if (!home) return null;
  const dir = join(home, 'stapler', 'captures');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function openStaplerWindow(): void {
  if (staplerWin && !staplerWin.isDestroyed()) {
    staplerWin.show();
    return;
  }
  if (!canUse('stapler')) return;

  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  const size = 72;
  staplerWin = new BrowserWindow({
    width: size,
    height: size,
    x: Math.round(sw - size - 24),
    y: Math.round(sh - size - 24),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  staplerWin.setAlwaysOnTop(true, 'screen-saver');
  applyInvisible();
  staplerWin.on('closed', () => { staplerWin = null; });

  if (isDev && rendererDevUrl) {
    void staplerWin.loadURL(`${rendererDevUrl}/stapler.html`);
  } else {
    void staplerWin.loadFile(join(__dirname, '../renderer/stapler.html'));
  }
  staplerWin.once('ready-to-show', () => staplerWin?.show());
}

function closeStaplerWindow(): void {
  closeSelectionWindow();
  if (staplerWin && !staplerWin.isDestroyed()) {
    staplerWin.close();
  }
  staplerWin = null;
}

function showPuck(): void {
  if (staplerWin && !staplerWin.isDestroyed()) {
    staplerWin.setSize(72, 72);
    staplerWin.show();
  }
}

function showNoteCard(path: string): void {
  if (!staplerWin || staplerWin.isDestroyed()) openStaplerWindow();
  if (!staplerWin || staplerWin.isDestroyed()) return;
  staplerWin.setSize(320, 240);
  staplerWin.show();
  staplerWin.webContents.send('stapler:captureReady', { path });
}

function applyInvisible(): void {
  if (staplerWin && !staplerWin.isDestroyed()) {
    try { staplerWin.setContentProtection(invisible); } catch { /* platform may not support */ }
  }
  if (selectionWin && !selectionWin.isDestroyed()) {
    try { selectionWin.setContentProtection(invisible); } catch { /* ignore */ }
  }
}

async function beginRegionCapture(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!staplerWin || staplerWin.isDestroyed()) return { ok: false, error: 'stapler closed' };
  staplerWin.hide();
  closeSelectionWindow();

  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;
  selectionWin = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  selectionWin.setAlwaysOnTop(true, 'screen-saver');
  applyInvisible();
  selectionWin.on('closed', () => { selectionWin = null; });

  if (isDev && rendererDevUrl) {
    await selectionWin.loadURL(`${rendererDevUrl}/stapler.html?mode=select`);
  } else {
    await selectionWin.loadFile(join(__dirname, '../renderer/stapler.html'), { search: 'mode=select' });
  }
  selectionWin.show();
  selectionWin.focus();
  return { ok: true };
}

function closeSelectionWindow(): void {
  if (selectionWin && !selectionWin.isDestroyed()) selectionWin.close();
  selectionWin = null;
}

async function captureRegion(x: number, y: number, width: number, height: number): Promise<string> {
  const dir = capturesDir();
  if (!dir) throw new Error('harness home not set');

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: screen.getPrimaryDisplay().size,
  });
  if (!sources.length) {
    throw new Error('Screen capture unavailable. On macOS, grant Screen Recording permission for Munder Difflin in System Settings.');
  }
  const primary = sources[0];
  const img = primary.thumbnail;
  if (img.isEmpty()) {
    throw new Error('Empty capture — check Screen Recording permission.');
  }

  const display = screen.getPrimaryDisplay();
  const scale = display.scaleFactor || 1;
  const sx = Math.max(0, Math.round(x * scale));
  const sy = Math.max(0, Math.round(y * scale));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const cropped = img.crop({ x: sx, y: sy, width: Math.min(sw, img.getSize().width - sx), height: Math.min(sh, img.getSize().height - sy) });
  const name = `capture-${Date.now()}.png`;
  const dest = join(dir, name);
  writeFileSync(dest, cropped.toPNG());
  return dest;
}

/** Used by AV epic / tests — path under harness home. */
export function staplerHomeExists(): boolean {
  const home = readConfig().harnessHome;
  return !!(home && existsSync(join(home, 'stapler')));
}

export function staplerWebContents(): WebContents | null {
  if (staplerWin && !staplerWin.isDestroyed()) return staplerWin.webContents;
  return null;
}
