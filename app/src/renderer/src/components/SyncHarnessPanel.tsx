/**
 * Sync screen — add remote harness workflow (SPEC peer-harness-coop CAP-1..5).
 * Boss MQTT address ↔ peer paste ↔ share/follow agent checklists ↔ tinted remotes + send.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

type SyncState = Awaited<ReturnType<typeof window.cth.network.getSyncState>>;

const labelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--cth-ink-500)',
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'var(--cth-font-mono, ui-monospace, monospace)',
  border: '1px solid var(--cth-ink-300)',
  borderRadius: 4,
  background: 'var(--cth-paper-100)',
  color: 'var(--cth-ink-900)',
};

const btnStyle: CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
  border: '1px solid var(--cth-ink-400)',
  borderRadius: 4,
  background: 'var(--cth-paper-100)',
  color: 'var(--cth-ink-900)',
};

function tintBar(hue: number): CSSProperties {
  return {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    background: `hsl(${hue} 55% 42%)`,
    flexShrink: 0,
  };
}

export function SyncHarnessPanel() {
  const [state, setState] = useState<SyncState | null>(null);
  const [peerPaste, setPeerPaste] = useState('');
  const [envDraft, setEnvDraft] = useState('');
  const [note, setNote] = useState('');
  const [sendTo, setSendTo] = useState<{ deviceId: string; agentId: string; pub: string; name: string } | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await window.cth.network.sync();
      const s = await window.cth.network.getSyncState();
      setState(s);
      setEnvDraft(s.envLabel || '');
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const off = window.cth.network.onSyncState((s) => {
      setState(s as SyncState);
    });
    return off;
  }, [refresh]);

  const cardJson = state?.addressCard ? JSON.stringify(state.addressCard, null, 2) : '';

  const copyCard = async () => {
    if (!cardJson) return;
    try {
      await navigator.clipboard.writeText(cardJson);
      setNote('Boss address card copied');
    } catch {
      setNote('Could not copy — select the card text manually');
    }
  };

  const importPeer = async () => {
    setBusy(true);
    setNote('');
    try {
      const r = await window.cth.network.importPeer(peerPaste.trim());
      if (!r.ok) setNote(r.error || 'import failed');
      else {
        setPeerPaste('');
        setNote('Peer imported');
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (agentId: string) => {
    if (!state) return;
    const set = new Set(state.publishAgentIds);
    if (set.has(agentId)) set.delete(agentId);
    else set.add(agentId);
    await window.cth.network.setPublishAgentIds([...set]);
    await refresh();
  };

  const toggleFollow = async (peerDeviceId: string, agentId: string) => {
    if (!state) return;
    const peer = state.peers.find((p) => p.deviceId === peerDeviceId);
    if (!peer) return;
    const set = new Set(peer.followAgentIds);
    if (set.has(agentId)) set.delete(agentId);
    else set.add(agentId);
    await window.cth.network.setFollowAgentIds(peerDeviceId, [...set]);
    await refresh();
  };

  const saveEnv = async () => {
    await window.cth.network.setEnvLabel(envDraft.trim());
    await refresh();
    setNote('Env label saved');
  };

  const sendMail = async () => {
    if (!sendTo) return;
    setBusy(true);
    setNote('');
    try {
      const id = `remote-${Date.now()}`;
      const r = await window.cth.network.sendRemote({
        peerDeviceId: sendTo.deviceId,
        peerX25519PublicKey: sendTo.pub,
        agentId: sendTo.agentId,
        message: {
          id,
          to: sendTo.agentId,
          from: 'operator',
          act: 'request',
          subject: subject || '(remote order)',
          body: body || '',
          conversation: `coop-${id}`,
        },
      });
      if (!r.ok) setNote(r.error || 'send failed');
      else {
        setNote(`Sent to ${sendTo.name} on ${sendTo.deviceId.slice(0, 8)}…`);
        setSubject('');
        setBody('');
        setSendTo(null);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return <div style={{ fontSize: 13, color: 'var(--cth-ink-600)' }}>Loading sync…</div>;
  }

  if (!state.canNetwork) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--cth-ink-800)', lineHeight: 1.45 }}>
          Harness Sync needs Teams network entitlement (<code>canNetwork</code>). Unlock Teams /
          networkEnabled to pair remote harnesses.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--cth-ink-700)', lineHeight: 1.45 }}>
        Add a remote harness: share your boss MQTT address, paste theirs, mark which agents to
        publish and follow. Orders land in the agent’s inbox on that machine — files stay local.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 12,
          padding: '2px 8px',
          borderRadius: 4,
          background: state.connected ? 'var(--cth-ok-100, #d8f3dc)' : 'var(--cth-ink-200)',
          color: 'var(--cth-ink-900)',
        }}>
          MQTT {state.connected ? 'connected' : 'disconnected'}
        </span>
        <button type="button" style={btnStyle} onClick={() => void refresh()} disabled={busy}>
          Refresh
        </button>
      </div>

      <div>
        <div style={labelStyle}>This harness env label</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={envDraft}
            placeholder="e.g. dev-laptop / prod-vps"
            onChange={(e) => setEnvDraft(e.target.value)}
          />
          <button type="button" style={btnStyle} onClick={() => void saveEnv()}>Save</button>
        </div>
      </div>

      <div>
        <div style={labelStyle}>Boss MQTT address (copy to peer)</div>
        <textarea
          readOnly
          value={cardJson}
          rows={7}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <div style={{ marginTop: 6 }}>
          <button type="button" style={btnStyle} onClick={() => void copyCard()}>Copy card</button>
        </div>
      </div>

      <div>
        <div style={labelStyle}>Peer harness address (paste card)</div>
        <textarea
          value={peerPaste}
          onChange={(e) => setPeerPaste(e.target.value)}
          rows={5}
          placeholder='{ "v": 1, "mqttUrl": "mqtt://…", "deviceId": "…", … }'
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <div style={{ marginTop: 6 }}>
          <button type="button" style={btnStyle} disabled={busy || !peerPaste.trim()} onClick={() => void importPeer()}>
            Import peer
          </button>
        </div>
      </div>

      <div>
        <div style={labelStyle}>Share my agents (publish knowhow)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.localAgents.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--cth-ink-500)' }}>No local agents yet</span>
          )}
          {state.localAgents.map((a) => (
            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={state.publishAgentIds.includes(a.id)}
                onChange={() => void togglePublish(a.id)}
              />
              <span>
                {a.name}
                {a.isGod ? ' (god)' : ''}
                <span style={{ color: 'var(--cth-ink-500)' }}> · {a.id}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {state.peers.map((peer) => {
        const roster = state.peerRosters[peer.deviceId];
        const hue = state.followed.find((f) => f.deviceId === peer.deviceId)?.tintHue
          ?? (peer.deviceId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360);
        return (
          <div key={peer.deviceId} style={{ display: 'flex', gap: 10 }}>
            <div style={tintBar(hue)} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Peer {peer.envLabel || roster?.envLabel || peer.deviceId.slice(0, 12)}
                </div>
                <button
                  type="button"
                  style={{ ...btnStyle, fontSize: 12 }}
                  onClick={() => void window.cth.network.removePeer(peer.deviceId).then(refresh)}
                >
                  Remove
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-mono, monospace)' }}>
                {peer.deviceId}
              </div>
              <div style={labelStyle}>Follow peer agents</div>
              {!roster && (
                <span style={{ fontSize: 13, color: 'var(--cth-ink-500)' }}>
                  Waiting for roster… (peer must be online with network)
                </span>
              )}
              {roster?.agents.map((a) => (
                <label key={a.agentId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={peer.followAgentIds.includes(a.agentId)}
                    onChange={() => void toggleFollow(peer.deviceId, a.agentId)}
                  />
                  <span>
                    {a.name}
                    {a.isGod ? ' (god)' : ''}
                    <span style={{ color: 'var(--cth-ink-500)' }}> · {a.agentId}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {state.followed.length > 0 && (
        <div>
          <div style={labelStyle}>Followed remotes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.followed.map((f) => (
              <div
                key={`${f.deviceId}:${f.agentId}`}
                style={{ display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <div style={{ ...tintBar(f.tintHue), height: 28 }} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  {f.name}
                  <span style={{ color: 'var(--cth-ink-500)' }}>
                    {' '}· {f.peerLabel || f.deviceId.slice(0, 8)}
                  </span>
                </div>
                <button
                  type="button"
                  style={btnStyle}
                  onClick={() => setSendTo({
                    deviceId: f.deviceId,
                    agentId: f.agentId,
                    pub: f.x25519PublicKey,
                    name: f.name,
                  })}
                >
                  Send mail
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sendTo && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          border: '1px solid var(--cth-ink-300)',
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Mail → {sendTo.name}
          </div>
          <input
            style={inputStyle}
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={4}
            placeholder="Body — paths refer to the remote machine"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btnStyle} disabled={busy} onClick={() => void sendMail()}>
              Send
            </button>
            <button type="button" style={btnStyle} onClick={() => setSendTo(null)}>Cancel</button>
          </div>
        </div>
      )}

      {note && (
        <div style={{ fontSize: 12, color: 'var(--cth-ink-700)' }}>{note}</div>
      )}
    </div>
  );
}
