/**
 * The hero card at the top of Settings → General.
 *
 * Shows live entitlement plan (community / trial / pro / teams) plus Upgrade /
 * Manage / Start trial / Teams actions. Marketing copy still comes from docs/hero.json.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';
import { DEFAULT_HERO, type HeroPayload } from '@shared/heroPayload';
import { manualDownloadUrl, pendingVersion, reduceStatus, type UpdateStatus } from '@shared/updateState';
import type { PlanId } from '@shared/entitlements';

const GITHUB_REPO_URL = 'https://github.com/chaitanyagiri/munder-difflin';
const FOUNDERS_WALL_URL = 'https://munderdiffl.in/wall.html';
const DISCORD_URL = 'https://discord.gg/SEDzP5ZPk5';

function planBadgeLabel(plan: PlanId, fallback: string): string {
  if (plan === 'teams') return 'Teams';
  if (plan === 'pro') return 'Pro';
  if (plan === 'trial') return 'Pro trial';
  return fallback || 'Community';
}

export function SettingsHeroCard() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [hero, setHero] = useState<HeroPayload>(DEFAULT_HERO);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [plan, setPlan] = useState<PlanId>('community');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [canPro, setCanPro] = useState(false);
  const [seatLabel, setSeatLabel] = useState<string | null>(null);
  const [staplerOn, setStaplerOn] = useState(false);

  const refreshEntitlements = () => {
    void window.cth.entitlements?.get?.().then((snap) => {
      setPlan(snap.plan);
      setTrialEndsAt(snap.state.trialEndsAt);
      setCanPro(snap.canPro);
      setSeatLabel(snap.state.seatLabel);
      setStaplerOn(!!snap.state.staplerEnabled && snap.canPro);
    }).catch(() => { /* keep defaults */ });
  };

  useEffect(() => {
    const off = window.cth.onUpdateStatus?.((next) => setStatus((prev) => reduceStatus(prev, next)));
    void window.cth.updateCurrent?.().then((cur) => {
      if (cur) setStatus((prev) => reduceStatus(prev, cur));
    }).catch(() => { /* push channel still works */ });
    return off;
  }, []);
  const pending = version ? pendingVersion(status, version) : null;
  const downloadManually = () => {
    if (!status) return;
    const url = manualDownloadUrl(status, window.cth.platform, window.cth.arch);
    if (url) void window.cth.updateOpenRelease(url);
  };

  useEffect(() => {
    let alive = true;
    window.cth.appInfo()
      .then((i) => { if (alive) setVersion(i.version); })
      .catch(() => { /* the card is still useful without it */ });
    window.cth.heroPayload()
      .then((r) => { if (alive) setHero(r.hero); })
      .catch(() => { /* defaults already rendered */ });
    refreshEntitlements();
    return () => { alive = false; };
  }, []);

  const PLAN = hero.plan;
  const SPONSOR = hero.sponsor;
  const liveLabel = planBadgeLabel(plan, PLAN.label);

  const showReleaseNotes = () => {
    window.dispatchEvent(new CustomEvent('cth:show-release-notes'));
  };

  const startTrial = () => {
    void window.cth.entitlements?.beginTrial?.().then(() => refreshEntitlements());
  };

  const INK = 'var(--cth-ink-900)';
  const MONO = 'var(--cth-font-mono, monospace)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--cth-paper-100)',
      border: `2px solid ${INK}`
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--cth-font-display)', fontSize: 13, lineHeight: '20px', color: INK
            }}>MUNDER DIFFLIN</span>
            {version && (
              <span style={{
                fontFamily: MONO, fontSize: 15, fontWeight: 700, color: INK
              }}>v{version}</span>
            )}
            <span style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
              padding: '2px 7px',
              background: canPro ? 'var(--cth-lilac-light)' : 'var(--cth-mint-light)',
              boxShadow: canPro ? 'inset 0 0 0 1px var(--cth-lilac)' : 'inset 0 0 0 1px var(--cth-mint)',
              color: INK
            }}>{liveLabel}</span>
            {pending && (
              <>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--cth-ink-700)' }}>
                  v{pending} is out
                </span>
                <PixelButton variant="primary" size="sm" onClick={downloadManually}
                  title="Download the installer and replace the app yourself. Auto-update is in Updates below.">
                  download v{pending}
                </PixelButton>
              </>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: 'var(--cth-ink-700)', maxWidth: '64ch' }}>
            {plan === 'trial' && trialEndsAt
              ? t('settingsHero.trialUntil', {
                  date: new Date(trialEndsAt).toLocaleDateString(),
                  blurb: PLAN.blurb,
                })
              : plan === 'teams'
                ? t('settingsHero.teamsUnlocked', {
                    seat: seatLabel || t('settingsHero.teamsSeatFallback'),
                    blurb: PLAN.blurb,
                  })
                : plan === 'pro'
                  ? t('settingsHero.proUnlocked', { blurb: PLAN.blurb })
                  : PLAN.blurb}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!canPro && (
              <PixelButton variant="primary" size="sm" onClick={startTrial}>
                {t('settingsHero.startTrial')}
              </PixelButton>
            )}
            <PixelButton variant="secondary" size="sm" onClick={() => void window.cth.entitlements?.upgrade?.()}>
              {t('settingsHero.upgrade')}
            </PixelButton>
            {canPro && plan !== 'teams' && (
              <PixelButton variant="ghost" size="sm" onClick={() => void window.cth.entitlements?.manage?.()}>
                {t('settingsHero.managePlan')}
              </PixelButton>
            )}
            <PixelButton
              variant="ghost"
              size="sm"
              onClick={() => void window.cth.entitlements?.openTeams?.()}
            >
              {plan === 'teams' ? t('settingsHero.manageSeats') : t('settingsHero.startTeam')}
            </PixelButton>
            <PixelButton variant="ghost" size="sm" onClick={() => void window.cth.entitlements?.refresh?.().then(() => refreshEntitlements())}>
              {t('settingsHero.refreshPlan')}
            </PixelButton>
            <PixelButton
              variant={staplerOn ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                void window.cth.stapler.setEnabled(!staplerOn).then((r) => {
                  setStaplerOn(!!r.state.staplerEnabled && r.canUse);
                  refreshEntitlements();
                });
              }}
              title={canPro ? t('settingsHero.staplerTitle') : t('settingsHero.staplerNeedsPro')}
            >
              {staplerOn ? t('settingsHero.staplerOn') : t('settingsHero.enableStapler')}
            </PixelButton>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, color: 'var(--cth-ink-500)', maxWidth: '64ch' }}>
            {t('settingsHero.screenRecordingHint')}
          </div>
        </div>

        {hero.notice && (
          <div style={{
            padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: INK,
            background: 'var(--cth-lemon-light)', border: `2px solid ${INK}`
          }}>{hero.notice}</div>
        )}

        <div style={{
          padding: '12px 14px',
          background: 'var(--cth-lilac-light)',
          border: `2px solid ${INK}`
        }}>
          <span style={{
            display: 'inline-block', fontFamily: MONO, fontSize: 9, letterSpacing: '.18em',
            textTransform: 'uppercase', padding: '2px 7px',
            background: INK, color: 'var(--cth-paper-100)'
          }}>{t('settingsHero.announcement')}</span>
          <div style={{
            marginTop: 8, fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK
          }}>{t('settingsHero.proLaunch')}</div>
          <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: 'var(--cth-ink-700)', maxWidth: '64ch' }}>
            <b style={{ color: INK }}>{t('settingsHero.proCommunityFree')}</b>{' '}
            {t('settingsHero.proParagraph')}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          padding: '12px 14px',
          background: INK, color: 'var(--cth-paper-100)',
          marginTop: 2
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 30, fontWeight: 700, lineHeight: 0.9,
            letterSpacing: '-.05em', color: 'var(--cth-lemon)', textAlign: 'center', flexShrink: 0
          }}>
            50<span style={{
              display: 'block', fontSize: 8, letterSpacing: '.2em', fontWeight: 500,
              color: 'var(--cth-paper-100)', opacity: 0.7, marginTop: 5
            }}>% OFF</span>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600 }}>{t('settingsHero.foundersWallTitle')}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.85, marginTop: 2 }}>
              {t('settingsHero.foundersWallBody')}
            </div>
          </div>
          <PixelButton variant="primary" size="sm" onClick={() => void window.cth.openExternal(FOUNDERS_WALL_URL)}>
            {t('settingsHero.seeTheWall')}
          </PixelButton>
          {PLAN.upgrade && (
            <PixelButton variant="secondary" size="sm" onClick={() => void window.cth.entitlements?.upgrade?.()}>
              {PLAN.upgrade.label}
            </PixelButton>
          )}
        </div>

        {SPONSOR && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: 10,
            background: 'var(--cth-cream-100)',
            border: `2px solid ${INK}`
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '.18em',
              textTransform: 'uppercase', color: 'var(--cth-ink-500)', flexShrink: 0
            }}>{t('settingsHero.sponsoredBy')}</span>
            <span style={{ fontSize: 13, color: INK, flexShrink: 0 }}>{SPONSOR.name}</span>
            <span style={{ flex: 1, minWidth: 120, fontSize: 12, color: 'var(--cth-ink-700)' }}>{SPONSOR.blurb}</span>
            <PixelButton variant="ghost" size="sm" onClick={() => void window.cth.openExternal(SPONSOR.url)}>
              {t('settingsHero.visit')}
            </PixelButton>
          </div>
        )}

        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          paddingTop: 12, borderTop: `2px solid ${INK}`
        }}>
          <PixelButton variant="secondary" size="sm" onClick={showReleaseNotes}>
            <span title={t('settingsHero.whatsNewTitle')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="sparkle" /> {t('settingsHero.whatsNew')}
            </span>
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => void window.cth.openExternal(GITHUB_REPO_URL)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              ⭐ {t('settingsHero.starOnGitHub')}
            </span>
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => void window.cth.openExternal(DISCORD_URL)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              💬 {t('settingsHero.joinDiscord')}
            </span>
          </PixelButton>
          <PixelButton
            variant="ghost"
            size="sm"
            onClick={() => void window.cth.openExternal(`${GITHUB_REPO_URL}/issues/new`)}
          >{t('settingsHero.reportProblem')}</PixelButton>
          <span style={{ flex: 1 }} />
          <a
            href={`${GITHUB_REPO_URL}/blob/main/CHANGELOG.md`}
            onClick={(e) => { e.preventDefault(); void window.cth.openExternal(`${GITHUB_REPO_URL}/blob/main/CHANGELOG.md`); }}
            style={{ fontSize: 12, color: 'var(--cth-ink-500)' }}
          >{t('settingsHero.fullChangelog')}</a>
        </div>
      </div>
    </div>
  );
}
