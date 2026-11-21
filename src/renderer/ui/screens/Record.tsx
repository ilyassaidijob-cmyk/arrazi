import { useMemo, useState } from 'react';
import { leaderBadgeUrl } from '../../art/badges';
import { levelFromExp, lifetimeLevel, rankInfo } from '../../core/ranks';
import { expBetween, focusBetween, periodPredicate, streakInfo, type Period } from '../../core/stats';
import { fmtMinutes, fmtNum } from '../../core/util';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { CharacterView, Pix, RankBadge, SceneView, Seg } from '../kit';
import { ScreenHeader } from './Players';

type SortKey = 'exp' | 'focus' | 'streak' | 'level' | 'rank';

export function Record() {
  const s = useStore();
  const [period, setPeriod] = useState<Period>('week');
  const [sort, setSort] = useState<SortKey>('exp');
  const today = s.today();
  const ds = s.settings.dayStartMinutes;
  const rows = useMemo(() => {
    const pred = periodPredicate(period, today);
    return s.players.map((p) => ({
      p,
      level: levelFromExp(p.seasonExp),
      life: lifetimeLevel(p.lifetimeExp),
      exp: expBetween(p, ds, pred),
      focus: focusBetween(p, ds, pred),
      streak: streakInfo(p, today, ds).current,
      badges: p.leaderBadges.length,
    }));
  }, [s.players, period, today, ds, s.version]);
  const sorted = [...rows].sort((a, b) => {
    const k = (r: (typeof rows)[number]) =>
      sort === 'exp' ? r.exp : sort === 'focus' ? r.focus : sort === 'streak' ? r.streak : sort === 'level' ? r.life : r.level * 1e6 + r.p.prestige * 1e9;
    return k(b) - k(a) || b.exp - a.exp;
  });
  const th = (key: SortKey, label: string) => (
    <th className={sort === key ? 'on' : ''} onClick={() => setSort(key)} title="Sort">
      {label} {sort === key ? '▼' : ''}
    </th>
  );
  return (
    <div className="screen">
      <SceneView className="bg-scene dimmed" state={sceneFor(undefined, { targetHeight: 190 })} />
      <div className="screen-inner" style={{ position: 'relative' }}>
        <ScreenHeader
          title="Record"
          back={() => s.go({ name: 'home' })}
          right={
            <Seg
              value={period}
              onChange={setPeriod}
              options={[
                { v: 'week', label: 'This week' },
                { v: 'month', label: 'This month' },
                { v: 'all', label: 'All time' },
              ]}
            />
          }
        />
        <div className="panel">
          {rows.length === 0 ? (
            <div className="dim">No players yet.</div>
          ) : (
            <table className="board">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  {th('rank', 'Season rank')}
                  {th('level', 'Lifetime level')}
                  {th('exp', 'EXP')}
                  {th('focus', 'Focus')}
                  {th('streak', 'Streak')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.p.id} onClick={() => store.pushOverlay({ kind: 'playerDetails', playerId: r.p.id })} title="Open a read-only summary">
                    <td className="pixel" style={{ fontSize: 20 }}>
                      {i + 1}
                    </td>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <CharacterView look={r.p.look} scale={2} pose="stand" />
                        <span className="pixel" style={{ fontSize: 17 }}>
                          {r.p.name}
                        </span>
                        {r.badges > 0 && <span className="dim" style={{ fontSize: 12 }}>{r.badges} weekly badge{r.badges === 1 ? '' : 's'}</span>}
                      </span>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <RankBadge level={r.level} scale={1} stars={r.p.prestige} />
                        {rankInfo(r.level).full}
                      </span>
                    </td>
                    <td className="num">{r.life}</td>
                    <td className="num">{fmtNum(r.exp)}</td>
                    <td className="num">{fmtMinutes(r.focus)}</td>
                    <td className="num">{r.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="row wrap" style={{ gap: 18 }}>
            <span className="row">
              <Pix src={leaderBadgeUrl('focus')} scale={2} /> <span><b className="pixel">Top focuser</b>: most focus hours in the week</span>
            </span>
            <span className="row">
              <Pix src={leaderBadgeUrl('streak')} scale={2} /> <span><b className="pixel">Streak keeper</b>: longest streak at the end of the week</span>
            </span>
            <span className="muted">Each weekly badge pays 50 coins. Projects, notes and wardrobes stay private.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
