import { useMemo } from 'react';
import { badgeUrl, challengeBadgeUrl, leaderBadgeUrl } from '../../art/badges';
import { bossUrl } from '../../art/bosses';
import { ACH_TYPES, ACHIEVEMENTS } from '../../core/achievements';
import { BOSS, BOSSES, CHALLENGE, MOONS } from '../../core/catalog';
import { dayKey, monthIndex, prettyDay } from '../../core/dates';
import { derive } from '../../core/stats';
import type { Player } from '../../core/types';
import { fmtNum } from '../../core/util';
import { useStore } from '../../store';
import { Bar, Icon, Panel, Pix } from '../kit';

export function Achievements({ p }: { p: Player }) {
  const s = useStore();
  const ds = s.settings.dayStartMinutes;
  const d = useMemo(() => derive(p, s.today(), ds), [p, s.version, ds]);
  const earned = ACHIEVEMENTS.filter((a) => p.achievements[a.id]);
  const coins = earned.reduce((a, b) => a + b.coins, 0);
  const beaten = p.bosses.filter((b) => b.beaten);
  const months = Array.from(new Set(p.challengesDone.map((k) => k.slice(0, 7)))).sort().reverse();
  const focusBadges = p.leaderBadges.filter((b) => b.kind === 'focus').length;
  const streakBadges = p.leaderBadges.filter((b) => b.kind === 'streak').length;
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="chip bright">
          <Icon name="badge" /> {earned.length} / {ACHIEVEMENTS.length} badges
        </span>
        <span className="chip">
          <Icon name="coin" /> {fmtNum(coins)} / 8,210 coins from badges
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          The crow brings each new badge. Hidden ones show as ??? until you earn them.
        </span>
      </div>
      {ACH_TYPES.map((type) => (
        <Panel key={type} title={type}>
          <div className="badge-grid">
            {ACHIEVEMENTS.filter((a) => a.type === type).map((a) => {
              const got = p.achievements[a.id];
              const hidden = a.hidden && !got;
              const [cur, target] = a.progress(d);
              return (
                <div key={a.id} className={`badge-tile ${got ? 'got' : ''}`} title={hidden ? 'Hidden achievement' : a.how}>
                  <Pix src={badgeUrl(a.id, a.type, !got, hidden)} scale={3} />
                  <div className="pixel" style={{ fontSize: 15 }}>
                    {hidden ? '???' : a.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12, minHeight: 32 }}>
                    {hidden ? 'Keep playing to find out.' : a.how}
                  </div>
                  {got ? (
                    <div className="row" style={{ gap: 6, justifyContent: 'center', fontSize: 12 }}>
                      <span className="chip solid">
                        <Icon name="coin" shift={-4} /> {a.coins}
                      </span>
                      <span className="dim">{prettyDay(dayKey(got, ds)).slice(4)}</span>
                    </div>
                  ) : (
                    <div className="col" style={{ gap: 3 }}>
                      {!hidden && target > 1 && <Bar value={Math.min(cur, target)} max={target} thin />}
                      <div className="row" style={{ justifyContent: 'center', gap: 6, fontSize: 12 }}>
                        {!hidden && target > 1 && (
                          <span className="num dim">
                            {fmtNum(Math.min(cur, target))} / {fmtNum(target)}
                          </span>
                        )}
                        <span className="chip">
                          <Icon name="coin" /> {a.coins}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
      <div className="stats-mid">
        <Panel title="Moon challenge badges">
          {months.length === 0 ? (
            <div className="dim">Finish this month's challenges (Stats tab) to collect moon badges.</div>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {months.map((m) => (
                <div key={m}>
                  <div className="pixel muted" style={{ marginBottom: 4 }}>
                    {MOONS[monthIndex(m)].name} {m.slice(0, 4)}
                  </div>
                  <div className="row wrap" style={{ gap: 10 }}>
                    {p.challengesDone
                      .filter((k) => k.startsWith(m))
                      .map((k) => (
                        <span key={k} className="row" style={{ gap: 6 }} title={CHALLENGE[k.slice(8)]?.label}>
                          <Pix src={challengeBadgeUrl(monthIndex(m), true)} scale={2} />
                          <span style={{ fontSize: 13 }}>{CHALLENGE[k.slice(8)]?.label}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Weekly leaderboard badges">
          <div className="row" style={{ gap: 18 }}>
            <span className="row">
              <Pix src={leaderBadgeUrl('focus')} scale={2} />
              <span>
                <span className="pixel">Top focuser</span> <span className="num">x{focusBadges}</span>
              </span>
            </span>
            <span className="row">
              <Pix src={leaderBadgeUrl('streak')} scale={2} />
              <span>
                <span className="pixel">Streak keeper</span> <span className="num">x{streakBadges}</span>
              </span>
            </span>
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
            Each week the player with the most focus hours and the longest streak on this PC earn a badge and 50 coins.
          </div>
        </Panel>
      </div>
      <Panel title={`Bosses defeated · ${beaten.length}`}>
        <div className="row wrap" style={{ gap: 14 }}>
          {BOSSES.map((b) => {
            const n = beaten.filter((x) => x.bossId === b.id).length;
            return (
              <div key={b.id} className="col center" style={{ alignItems: 'center', gap: 2, width: 110 }} title={b.name}>
                <Pix src={bossUrl(b.id, false, !n)} scale={2} />
                <span style={{ fontSize: 12 }} className={n ? '' : 'dim'}>
                  {BOSS[b.id].name.replace('The ', '')}
                </span>
                <span className="num dim" style={{ fontSize: 12 }}>
                  {n ? `x${n}` : 'not yet'}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
