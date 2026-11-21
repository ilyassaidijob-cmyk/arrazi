import { useMemo, useState } from 'react';
import { challengeBadgeUrl } from '../../art/badges';
import { bossUrl } from '../../art/bosses';
import { BOSS, ITEM, ITEMS, MOONS, SEASON_ITEM_RANK } from '../../core/catalog';
import {
  addDays,
  daysInMonth,
  diffDays,
  monthIndex,
  monthOf,
  monthShort,
  prettyDay,
  weekOf,
  weekdayShort,
} from '../../core/dates';
import { bloodMoonDay, canPrestige, challengeProgress, challengesFor, currentMultiplier, ensureBoss, isBloodMoon } from '../../core/game';
import { expProgress, lifetimeLevel, rankInfo } from '../../core/ranks';
import { dayStats, daysAccessedThisYear, derive, streakInfo, weekDamage } from '../../core/stats';
import type { Player } from '../../core/types';
import { fmtMinutes, fmtNum } from '../../core/util';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Bar, Btn, Coins, Icon, Panel, Pix, RankBadge, SceneView, Seg } from '../kit';

export function Stats({ p }: { p: Player }) {
  const s = useStore();
  const ds = s.settings.dayStartMinutes;
  const today = s.today();
  const prog = expProgress(p.seasonExp);
  const lvl = prog.level;
  const ri = rankInfo(lvl);
  const days = useMemo(() => dayStats(p, ds), [p, ds, s.version]);
  const d = useMemo(() => derive(p, today, ds), [p, today, ds, s.version]);
  const st = streakInfo(p, today, ds);
  const td = days.get(today);
  const [moonTip, setMoonTip] = useState<{ x: number; y: number } | null>(null);
  const expText = prog.need ? `${fmtNum(prog.into)} / ${fmtNum(prog.need)} EXP to ${prog.next!.full}` : 'Legend III reached';
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="panel" style={{ padding: 0 }}>
        <SceneView state={sceneFor(p, { charX: 0.32, targetHeight: 100 })} style={{ height: 300 }} onMoonHover={setMoonTip}>
          {moonTip && (
            <span className="tip" style={{ left: moonTip.x, top: moonTip.y }}>
              Moon = EXP: {expText}
            </span>
          )}
          <div className="scene-badge">
            <Btn small icon="shirt" onClick={() => store.go({ name: 'player', playerId: p.id, tab: 'shop', wardrobe: true })}>
              Wardrobe
            </Btn>
          </div>
        </SceneView>
      </div>

      <div className="stats-top">
        <Panel title="Rank and EXP" className="rank-panel">
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <RankBadge level={lvl} scale={3} stars={p.prestige} />
            <div className="grow col" style={{ gap: 6 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                <span className="pixel" style={{ fontSize: 28, lineHeight: 1 }}>
                  {ri.full}
                </span>
                <span className="chip">Lifetime level {lifetimeLevel(p.lifetimeExp)}</span>
                {p.prestige > 0 && <span className="chip bright">Prestige {'★'.repeat(Math.min(5, p.prestige))}{p.prestige > 5 ? ` x${p.prestige}` : ''}</span>}
                <span className="spacer" />
                <Coins n={p.coins} bright />
              </div>
              <Bar value={prog.into} max={prog.need || 1} />
              <div className="row muted" style={{ fontSize: 13 }}>
                <span className="num">{expText}</span>
                <span className="spacer" />
                <span>{fmtNum(p.lifetimeExp)} EXP ever earned</span>
              </div>
              <ExpMultiplier p={p} />
              <NextRewards p={p} level={lvl} />
              {canPrestige(p) && (
                <div className="row" style={{ marginTop: 6 }}>
                  <Btn
                    kind="primary"
                    icon="star"
                    onClick={() =>
                      store.pushOverlay({
                        kind: 'confirm',
                        title: 'Prestige?',
                        body: 'Go back to Recruit I and earn a star on your badge. Each star gives +10% coins forever and unlocks a rarer outfit. Your lifetime level, items and coins stay.',
                        confirm: 'Prestige',
                        onConfirm: () => store.prestige(p),
                      })
                    }
                  >
                    Prestige
                  </Btn>
                </div>
              )}
            </div>
          </div>
        </Panel>
        <Panel title="Today" className="today-panel">
          <div className="stat-grid two">
            <div className="stat">
              <div className="stat-v num">{td?.chapters ?? 0}</div>
              <div className="stat-l">Chapters</div>
            </div>
            <div className="stat">
              <div className="stat-v num">{fmtMinutes(td?.focusMin ?? 0)}</div>
              <div className="stat-l">Focused</div>
            </div>
            <div className="stat">
              <div className="stat-v num">{td?.pomodoros ?? 0}</div>
              <div className="stat-l">Pomodoros</div>
            </div>
            <div className="stat">
              <div className="stat-v num">{fmtNum(td?.exp ?? 0)}</div>
              <div className="stat-l">EXP</div>
            </div>
          </div>
          <div className="hr" />
          <div className="col muted" style={{ gap: 4, fontSize: 13 }}>
            <span className="row">
              <Icon name="star" /> Best day: {d.bestChaptersDay} chapter{d.bestChaptersDay === 1 ? '' : 's'}
            </span>
            <span className="row">
              <Icon name="clock" /> Longest focus day: {fmtMinutes(d.bestFocusDayMin)}
            </span>
          </div>
        </Panel>
      </div>

      <div className="stats-mid">
        <BossPanel p={p} />
        <SeasonPanel p={p} />
      </div>

      <Panel title="Summary">
        <div className="summary">
          <FocusGraph days={days} today={today} />
          <div className="col" style={{ gap: 12 }}>
            <div className="stat-grid two">
              <div className="stat">
                <div className="stat-v num">{daysAccessedThisYear(p, today)}</div>
                <div className="stat-l">Days accessed this year</div>
              </div>
              <div className="stat">
                <div className="stat-v num">{fmtMinutes(d.totalFocusMin)}</div>
                <div className="stat-l">Focused in total</div>
              </div>
            </div>
            <div className="streak-box">
              <div className="row" style={{ gap: 10 }}>
                <Icon name="flame" scale={4} />
                <div>
                  <div className="pixel" style={{ fontSize: 26, lineHeight: 1 }}>
                    {st.current} day{st.current === 1 ? '' : 's'}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {st.todayDone ? 'Today counts. Keep it going!' : 'Finish a chapter, a side quest or a full work session today.'}
                  </div>
                </div>
              </div>
              <div className="row muted" style={{ gap: 14, fontSize: 13, marginTop: 8 }}>
                <span>Longest: {st.longest}</span>
                <span className="row" style={{ gap: 4 }}>
                  <Icon name="freeze" /> Freezes: {st.freezes} / 2
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="hr" />
        <Heatmap days={days} today={today} />
      </Panel>
    </div>
  );
}

function NextRewards({ p, level }: { p: Player; level: number }) {
  if (level >= 30) return null;
  const next = rankInfo(level + 1);
  const coins = Math.round((next.tier === 1 ? next.rank * 100 : next.rank * 50) * (1 + 0.1 * p.prestige));
  const nextRank = next.tier === 1 ? next : rankInfo(level + (4 - rankInfo(level).tier));
  const item = ITEMS.find((i) => i.unlock.kind === 'rank' && i.unlock.rank === nextRank.rank);
  return (
    <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
      <span className="chip">
        Next: {next.full} · <Icon name="coin" /> +{coins}
      </span>
      {item && !p.owned.includes(item.id) && (
        <span className="chip" title="Each new rank unlocks one exclusive outfit piece">
          {nextRank.name} unlocks the {item.name}
        </span>
      )}
    </div>
  );
}

function ExpMultiplier({ p }: { p: Player }) {
  const m = currentMultiplier(store.ctx(), p);
  const parts: string[] = [];
  if (m.streak >= 3) parts.push(`${m.streak}-day streak x${m.streak >= 30 ? 1.5 : m.streak >= 7 ? 1.25 : 1.1}`);
  if (m.blood) parts.push('Blood Moon x2');
  if (!parts.length) return <span className="dim" style={{ fontSize: 12 }}>Keep a 3-day streak for a x1.1 EXP bonus (x1.25 at 7 days, x1.5 at 30).</span>;
  return (
    <span className="row" style={{ fontSize: 13 }}>
      <Icon name="exp" /> EXP x{+m.mult.toFixed(2)}: {parts.join(' · ')}
    </span>
  );
}

function BossPanel({ p }: { p: Player }) {
  const s = store;
  const rec = ensureBoss(s.ctx(), p);
  const boss = BOSS[rec.bossId];
  const dmg = weekDamage(p, rec.week, s.settings.dayStartMinutes);
  const hp = Math.max(0, rec.hp - dmg);
  const sunday = addDays(rec.week, 6);
  const left = Math.max(0, diffDays(s.today(), sunday)) + 1;
  return (
    <Panel title={<><Icon name="sword" /> Weekly boss</>} className="boss-panel">
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div className={`boss-art ${rec.beaten ? 'beaten' : 'bob'}`}>
          <Pix src={bossUrl(boss.id)} scale={4} />
        </div>
        <div className="grow col" style={{ gap: 6 }}>
          <div className="pixel" style={{ fontSize: 19 }}>
            {boss.name}
          </div>
          {rec.beaten ? (
            <div className="chip solid" style={{ alignSelf: 'flex-start' }}>
              Defeated! It drops {ITEM[boss.item]?.name}.
            </div>
          ) : (
            <div className="muted" style={{ fontStyle: 'italic', fontSize: 13 }}>
              "{boss.taunt}"
            </div>
          )}
          <Bar value={hp} max={rec.hp} dim={rec.beaten} title={`${hp} / ${rec.hp} HP`} />
          <div className="row muted" style={{ fontSize: 13 }}>
            <span className="num">
              HP {fmtNum(hp)} / {fmtNum(rec.hp)}
            </span>
            <span className="spacer" />
            <span>{rec.beaten ? 'Next boss on Monday' : `${left} day${left === 1 ? '' : 's'} left`}</span>
          </div>
          <span className="dim" style={{ fontSize: 12 }}>
            Every focused minute deals 1 damage. Beat it by Sunday for coins, EXP and a rare item.
          </span>
        </div>
      </div>
    </Panel>
  );
}

function SeasonPanel({ p }: { p: Player }) {
  const s = store;
  const today = s.today();
  const month = monthOf(today);
  const moon = MOONS[monthIndex(month)];
  const left = daysInMonth(month) - Number(today.slice(8, 10)) + 1;
  const peak = rankInfo(p.seasonPeakLevel);
  const blood = isBloodMoon(today);
  const bloodPassed = bloodMoonDay(month) < today;
  return (
    <Panel title={<><Icon name="moon" /> {moon.name} season</>} className="season-panel">
      <div className="muted" style={{ fontSize: 13, marginTop: -4 }}>
        {moon.blurb} {left} day{left === 1 ? '' : 's'} left. On the 1st your season rank drops {s.settings.rankedMode ? 6 : 3} tiers.
      </div>
      <div className="row wrap" style={{ gap: 8, margin: '8px 0' }}>
        <span className="chip">Best this season: {peak.full}</span>
        <span className="chip">
          Reward: <Icon name="coin" /> {peak.rank * 50}
        </span>
        <span className={`chip ${peak.rank >= SEASON_ITEM_RANK ? 'bright' : ''}`} title={`Reach ${rankInfo((SEASON_ITEM_RANK - 1) * 3 + 1).name} this month to earn it`}>
          {ITEM[moon.item]?.name} {peak.rank >= SEASON_ITEM_RANK || p.owned.includes(moon.item) ? '✓' : `(reach ${rankInfo((SEASON_ITEM_RANK - 1) * 3 + 1).name})`}
        </span>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {challengesFor(month).map((c) => {
          const v = challengeProgress(p, c, month, today, s.settings.dayStartMinutes);
          const done = p.challengesDone.includes(`${month}:${c.id}`);
          const shown = c.metric === 'focusMin' ? `${Math.floor(Math.min(v, c.target) / 60)} / ${c.target / 60} h` : `${Math.min(v, c.target)} / ${c.target}`;
          return (
            <div key={c.id} className="row" style={{ gap: 10 }}>
              <Pix src={challengeBadgeUrl(monthIndex(month), done)} scale={1} />
              <div className="grow">
                <div className="row" style={{ fontSize: 13 }}>
                  <span className={done ? '' : 'muted'}>{c.label}</span>
                  <span className="spacer" />
                  <span className="num muted">{done ? 'Done' : shown}</span>
                  <span className="chip" style={{ padding: '0 5px' }}>
                    <Icon name="coin" /> {c.coins}
                  </span>
                </div>
                <Bar value={done ? 1 : v} max={done ? 1 : c.target} thin />
              </div>
            </div>
          );
        })}
      </div>
      <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
        {blood
          ? 'Blood Moon tonight! All EXP is doubled.'
          : bloodPassed
            ? `This month's Blood Moon has passed (${prettyDay(bloodMoonDay(month))}).`
            : 'One random night this month is a Blood Moon: all EXP doubled.'}
      </div>
    </Panel>
  );
}

type Range = 'week' | 'month' | 'year';

function FocusGraph({ days, today }: { days: Map<string, { focusMin: number; chapters: number }>; today: string }) {
  const [range, setRange] = useState<Range>('week');
  const bars: { label: string; key: string; min: number; title: string }[] = [];
  if (range === 'week') {
    const mon = weekOf(today);
    for (let i = 0; i < 7; i++) {
      const k = addDays(mon, i);
      const m = days.get(k)?.focusMin ?? 0;
      bars.push({ label: weekdayShort(i), key: k, min: m, title: `${prettyDay(k)}: ${fmtMinutes(m)}` });
    }
  } else if (range === 'month') {
    const month = monthOf(today);
    for (let i = 1; i <= daysInMonth(month); i++) {
      const k = `${month}-${String(i).padStart(2, '0')}`;
      const m = days.get(k)?.focusMin ?? 0;
      bars.push({ label: i % 5 === 1 ? String(i) : '', key: k, min: m, title: `${prettyDay(k)}: ${fmtMinutes(m)}` });
    }
  } else {
    const y = today.slice(0, 4);
    const sums = new Array(12).fill(0);
    for (const [k, v] of days) if (k.startsWith(y)) sums[Number(k.slice(5, 7)) - 1] += v.focusMin;
    sums.forEach((m, i) => bars.push({ label: monthShort(i), key: String(i), min: m, title: `${monthShort(i)} ${y}: ${fmtMinutes(m)}` }));
  }
  const max = Math.max(60, ...bars.map((b) => b.min));
  const total = bars.reduce((a, b) => a + b.min, 0);
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row">
        <span className="pixel muted">Focus hours</span>
        <span className="chip">{fmtMinutes(total)}</span>
        <span className="spacer" />
        <Seg
          value={range}
          onChange={setRange}
          options={[
            { v: 'week', label: 'Week' },
            { v: 'month', label: 'Month' },
            { v: 'year', label: 'Year' },
          ]}
        />
      </div>
      <div className="graph">
        <div className="graph-axis num">
          <span>{(max / 60).toFixed(max >= 600 ? 0 : 1)} h</span>
          <span>0</span>
        </div>
        <div className="graph-bars">
          {bars.map((b) => (
            <div key={b.key} className={`graph-col ${b.key === today ? 'today' : ''}`} title={b.title}>
              <div className="graph-bar" style={{ height: `${(b.min / max) * 100}%` }} />
              <span className="graph-label">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ days, today }: { days: Map<string, { focusMin: number; chapters: number; accessed: boolean }>; today: string }) {
  const year = Number(today.slice(0, 4));
  const jan1 = `${year}-01-01`;
  const start = weekOf(jan1);
  const cells: { key: string; lvl: number; title: string; out: boolean }[][] = [];
  for (let w = 0; w < 53; w++) {
    const col: { key: string; lvl: number; title: string; out: boolean }[] = [];
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const k = addDays(start, w * 7 + dIdx);
      const st = days.get(k);
      const out = !k.startsWith(String(year)) || k > today;
      let lvl = 0;
      if (st?.accessed || (st && st.focusMin > 0)) lvl = 1;
      if (st && st.focusMin > 0) lvl = st.focusMin < 30 ? 2 : st.focusMin < 120 ? 3 : 4;
      const title = out ? '' : `${prettyDay(k)}\nFocus: ${fmtMinutes(st?.focusMin ?? 0)}\nChapters done: ${st?.chapters ?? 0}${lvl === 0 ? '\nApp not opened' : ''}`;
      col.push({ key: k, lvl, title, out });
    }
    cells.push(col);
  }
  const [hover, setHover] = useState<string | null>(null);
  const months: { i: number; w: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const first = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    months.push({ i: m, w: Math.floor(diffDays(start, first) / 7) });
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row">
        <span className="pixel muted">{year} heatmap</span>
        <span className="spacer" />
        <span className="row dim" style={{ fontSize: 12, gap: 4 }}>
          Not opened <i className="hm l0" /> Opened <i className="hm l1" /> More focus <i className="hm l2" />
          <i className="hm l3" />
          <i className="hm l4" />
        </span>
      </div>
      <div className="heatmap-wrap">
        <div className="heatmap-months">
          {months.map((m) => (
            <span key={m.i} style={{ left: m.w * 14 }}>
              {monthShort(m.i)}
            </span>
          ))}
        </div>
        <div className="heatmap">
          {cells.map((col, w) => (
            <div key={w} className="hm-col">
              {col.map((c) => (
                <i
                  key={c.key}
                  className={`hm l${c.lvl} ${c.out ? 'out' : ''} ${c.key === today ? 'today' : ''}`}
                  title={c.title}
                  onMouseEnter={() => setHover(c.out ? null : c.title)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="dim" style={{ fontSize: 12, minHeight: 18, whiteSpace: 'pre-line' }}>
        {hover ? hover.replace(/\n/g, ' · ') : 'Hover a square to see the day.'}
      </div>
    </div>
  );
}

