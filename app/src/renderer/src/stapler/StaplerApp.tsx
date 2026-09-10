/**
 * Stapler puck UI + region-select + note card + voice (message / meeting / dictation).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Mode = 'puck' | 'select' | 'note' | 'menu';
type RecKind = 'message' | 'meeting' | null;

const MESSAGE_MAX_MS = 5 * 60 * 1000;
const MEETING_CHUNK_MS = 10 * 60 * 1000;

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
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recKind, setRecKind] = useState<RecKind>(null);
  const [recMs, setRecMs] = useState(0);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const meetingPartsRef = useRef<string[]>([]);
  const meetingLiveRef = useRef(false);
  const recTimerRef = useRef<number | null>(null);
  const chunkTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

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

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearRecTimers = () => {
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    if (chunkTimerRef.current) window.clearTimeout(chunkTimerRef.current);
    recTimerRef.current = null;
    chunkTimerRef.current = null;
  };

  const blobToBuffer = async (blob: Blob): Promise<ArrayBuffer> => blob.arrayBuffer();

  const transcribeBlob = async (blob: Blob): Promise<string> => {
    const audio = await blobToBuffer(blob);
    const r = await window.cth.stapler.transcribe({
      audio,
      mimeType: blob.type || 'audio/webm',
      filename: 'stapler.webm',
    });
    if (!r.ok) throw new Error(r.error || 'transcription failed');
    return (r.text || '').trim();
  };

  const finalizeMessage = async (blob: Blob) => {
    setBusy(true);
    setStatus('Transcribing…');
    try {
      await window.cth.stapler.saveAudio({ audio: await blobToBuffer(blob), ext: 'webm' });
      const text = await transcribeBlob(blob);
      setTranscript(text);
      setNote(text);
      setCapturePath(null);
      setMode('note');
      void window.cth.stapler.resizeNote();
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setRecKind(null);
      clearRecTimers();
      stopTracks();
    }
  };

  const flushMeetingChunk = async (final: boolean) => {
    const rec = mediaRef.current;
    if (!rec) return;
    const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
    chunksRef.current = [];
    if (blob.size < 64) {
      if (final) await finishMeeting();
      return;
    }
    setStatus('Transcribing chunk…');
    try {
      await window.cth.stapler.saveAudio({ audio: await blobToBuffer(blob), ext: 'webm' });
      const text = await transcribeBlob(blob);
      if (text) meetingPartsRef.current.push(text);
      setStatus(final ? null : `Meeting… ${meetingPartsRef.current.length} chunk(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
    if (final) await finishMeeting();
  };

  const finishMeeting = async () => {
    const full = meetingPartsRef.current.join('\n\n').trim();
    meetingPartsRef.current = [];
    setTranscript(full);
    setNote(full);
    setCapturePath(null);
    setMode('note');
    void window.cth.stapler.resizeNote();
    setRecKind(null);
    clearRecTimers();
    stopTracks();
    mediaRef.current = null;
    setBusy(false);
  };

  const startRecording = async (kind: 'message' | 'meeting') => {
    setStatus(null);
    setMode('puck');
    void window.cth.stapler.resizePuck();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      meetingPartsRef.current = [];
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (kind === 'message') void finalizeMessage(blob);
        else void flushMeetingChunk(true);
      };
      startedAtRef.current = Date.now();
      setRecKind(kind);
      setRecMs(0);
      rec.start(1000);
      recTimerRef.current = window.setInterval(() => {
        setRecMs(Date.now() - startedAtRef.current);
      }, 250);
      if (kind === 'message') {
        chunkTimerRef.current = window.setTimeout(() => {
          if (mediaRef.current && mediaRef.current.state === 'recording') mediaRef.current.stop();
        }, MESSAGE_MAX_MS);
      } else {
        meetingLiveRef.current = true;
        const scheduleChunk = () => {
          chunkTimerRef.current = window.setTimeout(() => {
            const r = mediaRef.current;
            if (!r || r.state !== 'recording' || !meetingLiveRef.current) return;
            r.onstop = () => {
              void (async () => {
                await flushMeetingChunk(false);
                if (!meetingLiveRef.current || !streamRef.current) return;
                const next = new MediaRecorder(streamRef.current);
                mediaRef.current = next;
                chunksRef.current = [];
                next.ondataavailable = (ev) => {
                  if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
                };
                next.onstop = () => {
                  void flushMeetingChunk(true);
                };
                next.start(1000);
                scheduleChunk();
              })();
            };
            r.stop();
          }, MEETING_CHUNK_MS);
        };
        scheduleChunk();
      }
      setStatus(kind === 'message' ? 'Recording message…' : 'Recording meeting…');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Microphone permission denied');
      setRecKind(null);
      stopTracks();
    }
  };

  const stopRecording = () => {
    clearRecTimers();
    meetingLiveRef.current = false;
    const rec = mediaRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    else {
      setRecKind(null);
      stopTracks();
    }
  };

  const dictateOntoNote = async () => {
    setBusy(true);
    setStatus('Listening…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      await new Promise<void>((resolve, reject) => {
        rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
        rec.onerror = () => reject(new Error('recorder error'));
        rec.onstop = () => resolve();
        rec.start();
        window.setTimeout(() => rec.stop(), 8000);
      });
      stopTracks();
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      setStatus('Transcribing…');
      const text = await transcribeBlob(blob);
      setNote((n) => (n ? `${n} ${text}` : text).trim());
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      stopTracks();
    } finally {
      setBusy(false);
    }
  };

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
    if (!capturePath && !transcript && !note) return;
    setBusy(true);
    const r = await window.cth.stapler.sendToOrchestrator({
      path: capturePath ?? undefined,
      note,
      transcript: transcript || undefined,
    });
    setBusy(false);
    if (r.ok) {
      setStatus('Sent to orchestrator');
      setCapturePath(null);
      setTranscript('');
      setNote('');
      setMode('puck');
      void window.cth.stapler.resizePuck();
    } else {
      setStatus(r.error ?? 'Send failed');
    }
  };

  const discard = () => {
    setCapturePath(null);
    setTranscript('');
    setNote('');
    setMode('puck');
    void window.cth.stapler.resizePuck();
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
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

  if (mode === 'note') {
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
        {capturePath && (
          <div style={{ fontSize: 11, color: 'var(--cth-ink-500)', wordBreak: 'break-all' }}>{capturePath}</div>
        )}
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => void send()} style={btnPrimary}>Send</button>
          <button type="button" disabled={busy} onClick={() => void dictateOntoNote()} style={btnGhost}>Mic</button>
          <button type="button" onClick={discard} style={btnGhost}>Discard</button>
        </div>
        {status && <div style={{ color: 'var(--cth-ink-500)' }}>{status}</div>}
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div style={{
        width: '100%', height: '100%', padding: 8, boxSizing: 'border-box',
        background: 'var(--cth-paper-100)', border: '2px solid var(--cth-ink-900)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <button type="button" style={btnPrimary} onClick={() => { setMode('puck'); void startCapture(); }}>Screenshot</button>
        <button type="button" style={btnGhost} onClick={() => void startRecording('message')}>Record message (≤5m)</button>
        <button type="button" style={btnGhost} onClick={() => void startRecording('meeting')}>Record meeting</button>
        <button type="button" style={btnGhost} onClick={() => { setMode('puck'); void window.cth.stapler.resizePuck(); }}>Close</button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', position: 'relative',
    }}>
      {recKind ? (
        <button
          type="button"
          title="Stop recording"
          onClick={stopRecording}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '3px solid var(--cth-ink-900)',
            background: 'var(--cth-coral, #c44)',
            boxShadow: '3px 3px 0 rgba(26,19,32,0.25)',
            cursor: 'pointer',
            fontFamily: 'var(--cth-font-mono, monospace)',
            fontSize: 10, fontWeight: 700, color: 'var(--cth-paper-100)',
          }}
        >
          {fmt(recMs)}
        </button>
      ) : (
        <button
          type="button"
          title={invisible ? 'Invisible on — right-click to toggle' : 'Click capture · double-click menu · right-click invisible'}
          onClick={() => void startCapture()}
          onDoubleClick={(e) => {
            e.preventDefault();
            setMode('menu');
            void window.cth.stapler.resizeNote();
          }}
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
      )}
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
