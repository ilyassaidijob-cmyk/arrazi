import { iconUrl } from '../../art/icons';
import { currentMultiplier } from '../../core/game';
import { levelFromExp, rankInfo } from '../../core/ranks';
import { streakInfo } from '../../core/stats';
import { store, useStore, type Tab } from '../../store';
import { Btn, Coins, Icon, Pix, RankBadge } from '../kit';
import { Achievements } from './Achievements';
import { Projects } from './Projects';
import { Quests } from './Quests';
import { Shop } from './Shop';
import { Stats } from './Stats';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stats', label: 'Stats', icon: 'star' },
  { id: 'projects', label: 'Projects', icon: 'book' },
  { id: 'quests', label: 'Side quests', icon: 'scroll' },
  { id: 'achievements', label: 'Achievements', icon: 'badge' },
  { id: 'shop', label: 'Shop', icon: 'chest' },
];

export function PlayerView() {
  const s = useStore();
  const r = s.route;
  if (r.name !== 'player') return null;
  const p = s.player(r.playerId);
  if (!p) {
    return (
      <div className="screen">
        <div className="screen-inner">
          <p>This player no longer exists.</p>
          <Btn onClick={() => s.go({ name: 'players' })}>Back to players</Btn>
        </div>
      </div>
    );
  }
  const lvl = levelFromExp(p.seasonExp);
  const st = streakInfo(p, s.today(), s.settings.dayStartMinutes);
  const mult = currentMultiplier(s.ctx(), p);
  const setTab = (tab: Tab) => store.go({ name: 'player', playerId: p.id, tab });
  return (
    <div className="screen" id="player-screen">
      <div className="screen-inner" style={{ paddingTop: 14 }}>
        <div className="player-head">
          <Btn icon="back" small onClick={() => s.go({ name: 'players' })} title="All players" />
          <h1 className="ellipsis" style={{ fontSize: 26, maxWidth: 320 }}>
            {p.name}
          </h1>
          <span className="chip bright" title="Season rank">
            <RankBadge level={lvl} scale={1} />
            {rankInfo(lvl).full}
            {p.prestige > 0 && <span>{'★'.repeat(Math.min(p.prestige, 5))}</span>}
          </span>
          <span className="chip" title="Current streak">
            <Icon name="flame" /> <span className="num">{st.current}</span>
          </span>
          {mult.mult > 1 && (
            <span className="chip solid" title={`${mult.blood ? 'Blood Moon x2. ' : ''}Streak bonus for ${mult.streak} days.`}>
              EXP x{+mult.mult.toFixed(2)}
            </span>
          )}
          <span className="spacer" />
          <Coins n={p.coins} bright />
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={r.tab === t.id} className={`tab ${r.tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              <Pix src={iconUrl(t.icon, r.tab === t.id ? 0 : -1)} scale={2} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="tab-body">
          {r.tab === 'stats' && <Stats p={p} />}
          {r.tab === 'projects' && <Projects p={p} projectId={r.projectId} />}
          {r.tab === 'quests' && <Quests p={p} />}
          {r.tab === 'achievements' && <Achievements p={p} />}
          {r.tab === 'shop' && <Shop p={p} />}
        </div>
      </div>
    </div>
  );
}
