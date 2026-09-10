/**
 * Stapler puck UI + region-select overlay + capture note card.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Mode = 'puck' | 'select' | 'note';

function queryMode(): Mode {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('mode') === 'select') return 'select';
  } catch { /* ignore */ }
  return 'puck';
}

export function StaplerApp() {
  const [mode, setMode] = useState<Mode>(queryMode);
  const [invisible, setInvisible] = useState(false);
  const [capturePath, setCapturePath] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const drag = useRef<{ x0: number; y0: number; x1: number; y1: number; down: boolean }>({
    x0: 0, y0: 0, x1: 0, y1: 0, down: false,
  });
  const [, tick] = useState(0);

  useEffect(() => {
    void window.cth.stapler.getState().then((s) => setInvisible(s.invisible));
  }, []);

  useEffect(() => {
    if (mode === 'select') return undefined;
    return window.cth.stapler.onCaptureReady((info) => {
      setCapturePath(info.path);
      setNote('');
      setMode('note');
      void window.cth.stapler.resizeNote();
    });
  }, [mode]);

  const startCapture = useCallback(async () => {
    setStatus(null);
    const r = await window.cth.stapler.beginCapture();
    if (!r.ok) setStatus(r.error);
  }, []);

  const toggleInvisible = useCallback(async () => {
    const next = !invisible;
    await window.cth.stapler.setInvisible(next);
    setInvisible(next);
  }, [invisible]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, down: true };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    tick((n) => n + 1);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.down) return;
    drag.current.x1 = e.clientX;
    drag.current.y1 = e.clientY;
    tick((n) => n + 1);
  };
  const onPointerUp = async () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    const { x0, y0, x1, y1 } = drag.current;
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const width = Math.abs(x1 - x0);
    const height = Math.abs(y1 - y0);
    if (width < 8 || height < 8) {
      await window.cth.stapler.cancelCapture();
      return;
    }
    setBusy(true);
    const r = await window.cth.stapler.finishCapture({ x, y, width, height });
    setBusy(false);
    if (!r.ok) setStatus(r.error);
  };

  const send = async () => {
    if (!capturePath) return;
    setBusy(true);
    const r = await window.cth.stapler.sendToOrchestrator({ path: capturePath, note });
    setBusy(false);
    if (r.ok) {
      setStatus('Sent to orchestrator');
      setCapturePath(null);
      setNote('');
      setMode('puck');
      void window.cth.stapler.resizePuck();
    } else {
      setStatus(r.error ?? 'Send failed');
    }
  };

  const discard = () => {
    setCapturePath(null);
    setNote('');
    setMode('puck');
    void window.cth.stapler.resizePuck();
  };

  if (mode === 'select') {
    const { x0, y0, x1, y1, down } = drag.current;
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    return (
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => void onPointerUp()}
        style={{
          width: '100vw', height: '100vh', cursor: 'crosshair',
          background: 'rgba(26,19,32,0.25)',
          position: 'relative', userSelect: 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 12px', background: 'var(--cth-ink-900)', color: 'var(--cth-paper-100)',
          fontFamily: 'var(--cth-font-mono, monospace)', fontSize: 11,
        }}>
          Drag a box · Esc cancels · {busy ? 'capturing…' : 'release to capture'}
        </div>
        {down && (
          <div style={{
            position: 'absolute', left, top, width: w, height: h,
            border: '2px solid #F4F1EA', background: 'rgba(244,241,234,0.08)',
            boxShadow: '0 0 0 9999px rgba(26,19,32,0.35)',
          }} />
        )}
        <EscCancel />
      </div>
    );
  }

  if (mode === 'note' && capturePath) {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--cth-paper-100)',
        border: '2px solid var(--cth-ink-900)',
        padding: 10, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 8,
        fontSize: 12, color: 'var(--cth-ink-900)',
      }}>
        <div style={{ fontFamily: 'var(--cth-font-mono, monospace)', fontSize: 10, letterSpacing: '.1em' }}>
          STAPLER CAPTURE
        </div>
        <div style={{ fontSize: 11, color: 'var(--cth-ink-500)', wordBreak: 'break-all' }}>{capturePath}</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the orchestrator…"
          rows={4}
          style={{
            flex: 1, resize: 'none', fontFamily: 'inherit', fontSize: 12,
            border: '1px solid var(--cth-ink-300)', padding: 6, background: 'var(--cth-cream-100)',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" disabled={busy} onClick={() => void send()} style={btnPrimary}>Send</button>
          <button type="button" onClick={discard} style={btnGhost}>Discard</button>
        </div>
        {status && <div style={{ color: 'var(--cth-ink-500)' }}>{status}</div>}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', position: 'relative',
    }}>
      <button
        type="button"
        title={invisible ? 'Invisible on — right-click to toggle' : 'Click to capture · right-click invisible'}
        onClick={() => void startCapture()}
        onContextMenu={(e) => { e.preventDefault(); void toggleInvisible(); }}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '3px solid var(--cth-ink-900)',
          background: invisible ? 'var(--cth-ink-700)' : 'var(--cth-lilac)',
          boxShadow: '3px 3px 0 rgba(26,19,32,0.25)',
          cursor: 'pointer',
          fontFamily: 'var(--cth-font-mono, monospace)',
          fontSize: 10, fontWeight: 700, color: 'var(--cth-paper-100)',
          letterSpacing: '.04em',
        }}
      >
        STAP
      </button>
      {status && (
        <div style={{
          position: 'absolute', bottom: 2, left: 2, right: 2,
          fontSize: 9, textAlign: 'center', color: 'var(--cth-ink-900)',
          background: 'var(--cth-lemon-light)',
        }}>{status}</div>
      )}
    </div>
  );
}

function EscCancel() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void window.cth.stapler.cancelCapture();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '6px 8px', border: 'none', cursor: 'pointer',
  background: 'var(--cth-ink-900)', color: 'var(--cth-paper-100)',
  fontFamily: 'var(--cth-font-mono, monospace)', fontSize: 11,
};
const btnGhost: React.CSSProperties = {
  padding: '6px 8px', border: '1px solid var(--cth-ink-300)', cursor: 'pointer',
  background: 'transparent', color: 'var(--cth-ink-700)',
  fontFamily: 'var(--cth-font-mono, monospace)', fontSize: 11,
};
