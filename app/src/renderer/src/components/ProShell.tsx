/**
 * Compact Pro sidebar shell — one Command Center surface at a time.
 * Community users see an upgrade CTA instead of an empty shell.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, selectedAgent } from '@/store/store';
import type { HarnessConfig } from '@/store/config';
import { CommandCenterPanel } from './CommandCenterPanel';
import { AgentDetailPanel } from './AgentDetailPanel';
import { TasksKanban } from './TasksKanban';
import { AskMeTab } from './AskMeTab';
import { TriggersTab } from './triggers/TriggersTab';
import { MemoryGraphPanel } from './MemoryGraphPanel';
import { PixelButton } from './PixelButton';
import { PixelPanel } from './PixelPanel';
import { Icon } from './Icon';

export type ProSurface = 'orchestrator' | 'agents' | 'tasks' | 'inbox' | 'automations' | 'memory';

const SURFACES: { id: ProSurface; labelKey: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'orchestrator', labelKey: 'proShell.orchestrator', icon: 'terminal' },
  { id: 'agents', labelKey: 'proShell.agents', icon: 'mcp' },
  { id: 'tasks', labelKey: 'proShell.tasks', icon: 'check' },
  { id: 'inbox', labelKey: 'proShell.inbox', icon: 'bell' },
  { id: 'automations', labelKey: 'proShell.automations', icon: 'clock' },
  { id: 'memory', labelKey: 'proShell.memory', icon: 'sparkle' },
];

export function ProShell(props: {
  config: HarnessConfig;
  canPro: boolean;
  onUseClassic: () => void;
  onEntitlementChange?: () => void;
}) {
  const { t } = useTranslation();
  const { canPro, onUseClassic, onEntitlementChange } = props;
  const [surface, setSurface] = useState<ProSurface>('orchestrator');
  const agents = useStore((s) => s.agents);
  const agent = useStore(selectedAgent);
  const select = useStore((s) => s.select);
  const requestCommandCenterTab = useStore((s) => s.requestCommandCenterTab);
  const god = agents.find((a) => a.isGod) ?? null;

  useEffect(() => {
    if (surface === 'orchestrator' && god && agent?.id !== god.id) {
      select(god.id);
    }
  }, [surface, god, agent?.id, select]);

  useEffect(() => {
    if (surface !== 'automations' || !god) return;
    if (agent?.id !== god.id) select(god.id);
    requestCommandCenterTab('triggers');
  }, [surface, god, agent?.id, select, requestCommandCenterTab]);

  if (!canPro) {
    return (
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: 'var(--cth-cream-100)',
      }}>
        <PixelPanel variant="dialog" title={t('proShell.title')} noPadding style={{ width: 420, maxWidth: '100%' }}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--cth-ink-700)' }}>
              {t('proShell.needsPro')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PixelButton variant="primary" size="sm" onClick={() => {
                void window.cth.entitlements.beginTrial().then(() => onEntitlementChange?.());
              }}>
                {t('proShell.startTrial')}
              </PixelButton>
              <PixelButton variant="secondary" size="sm" onClick={() => void window.cth.entitlements.upgrade()}>
                {t('proShell.upgrade')}
              </PixelButton>
              <PixelButton variant="ghost" size="sm" onClick={onUseClassic}>
                {t('proShell.backClassic')}
              </PixelButton>
            </div>
          </div>
        </PixelPanel>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', gap: 0,
      background: 'var(--cth-cream-100)',
    }}>
      <nav style={{
        width: 56, flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 6px',
        borderRight: '2px solid var(--cth-ink-900)',
        background: 'var(--cth-paper-100)',
      }} aria-label="Pro surfaces">
        {SURFACES.map((s) => {
          const active = surface === s.id;
          const label = t(s.labelKey);
          return (
            <button
              key={s.id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => setSurface(s.id)}
              style={{
                width: 44, height: 44, padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: 2, cursor: 'pointer',
                background: active ? 'var(--cth-lilac-light)' : 'transparent',
                boxShadow: active ? 'inset 0 0 0 2px var(--cth-ink-900)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                color: 'var(--cth-ink-900)',
              }}
            >
              <Icon name={s.icon} />
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          title={t('proShell.backClassic')}
          aria-label={t('proShell.backClassic')}
          onClick={onUseClassic}
          style={{
            width: 44, height: 44, padding: 0, fontSize: 10, fontFamily: 'var(--cth-font-mono, monospace)',
            border: 'none', borderRadius: 2, cursor: 'pointer',
            background: 'var(--cth-paper-100)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
            color: 'var(--cth-ink-700)',
          }}
        >
          {t('proShell.classicShort')}
        </button>
      </nav>

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--cth-ink-300)',
          fontFamily: 'var(--cth-font-mono, monospace)',
          fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
          color: 'var(--cth-ink-700)',
        }}>
          {t(SURFACES.find((s) => s.id === surface)?.labelKey ?? 'proShell.orchestrator')}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {surface === 'orchestrator' && (
            god
              ? <CommandCenterPanel agent={god} />
              : <EmptyPro msg="Orchestrator is still clocking in." />
          )}
          {surface === 'agents' && (
            <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
              <div style={{
                width: 200, flexShrink: 0, overflow: 'auto',
                borderRight: '1px solid var(--cth-ink-300)', padding: 8,
              }}>
                {agents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => select(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '6px 8px', marginBottom: 4, border: 'none', borderRadius: 2,
                      cursor: 'pointer', textAlign: 'left',
                      background: agent?.id === a.id ? 'var(--cth-mint-light)' : 'transparent',
                      boxShadow: agent?.id === a.id ? 'inset 0 0 0 1px var(--cth-mint)' : undefined,
                      color: 'var(--cth-ink-900)', fontSize: 12,
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--cth-font-mono, monospace)', fontSize: 10,
                      background: 'var(--cth-cream-200)',
                      boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                    }}>
                      {(a.name || a.id).slice(0, 1).toUpperCase()}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name || a.id}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                {agent ? <AgentDetailPanel agent={agent} /> : <EmptyPro msg="Select an agent." />}
              </div>
            </div>
          )}
          {surface === 'tasks' && <div style={{ padding: 12 }}><TasksKanban /></div>}
          {surface === 'inbox' && <div style={{ padding: 12 }}><AskMeTab /></div>}
          {surface === 'automations' && (
            god
              ? <CommandCenterPanel agent={god} />
              : <div style={{ padding: 12 }}><TriggersTab /></div>
          )}
          {surface === 'memory' && god && (
            <div style={{ padding: 12, height: '100%' }}>
              <MemoryGraphPanel
                godId={god.id}
                onJumpToMemory={(id) => {
                  select(id);
                  setSurface('agents');
                }}
              />
            </div>
          )}
          {surface === 'memory' && !god && <EmptyPro msg="Memory graph needs the orchestrator online." />}
        </div>
      </div>
    </div>
  );
}

function EmptyPro({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: 24, fontSize: 13, color: 'var(--cth-ink-500)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
    }}>
      {msg}
    </div>
  );
}
