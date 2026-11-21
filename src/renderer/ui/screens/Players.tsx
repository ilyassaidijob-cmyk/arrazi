import { isSleepy } from '../../core/game';
import { levelFromExp, lifetimeLevel, rankInfo } from '../../core/ranks';
import { streakInfo } from '../../core/stats';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Btn, CharacterView, Icon, RankBadge, SceneView } from '../kit';

export function ScreenHeader({ title, back, right }: { title: string; back?: () => void; right?: React.ReactNode }) {
  return (
    <div className="row" style={{ marginBottom: 18, gap: 12 }}>
      {back && <Btn icon="back" small onClick={back} title="Back" />}
      <h1 style={{ fontSize: 30 }}>{title}</h1>
      <span className="spacer" />
      {right}
    </div>
  );
}

export function Players() {
  const s = useStore();
  const today = s.today();
  return (
    <div className="screen">
      <SceneView className="bg-scene dimmed" state={sceneFor(undefined, { targetHeight: 190 })} />
      <div className="screen-inner" style={{ position: 'relative' }}>
        <ScreenHeader title="Players" back={() => s.go({ name: 'home' })} />
        <div className="player-grid">
          {s.players.map((p) => {
            const lvl = levelFromExp(p.seasonExp);
            const st = streakInfo(p, today, s.settings.dayStartMinutes);
            return (
              <div key={p.id} className="panel player-card" onClick={() => store.openPlayer(p.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && store.openPlayer(p.id)}>
                <div className="player-card-art">
                  <CharacterView look={p.look} scale={4} mood={isSleepy(p, today, s.settings.dayStartMinutes) ? 'sleepy' : 'idle'} />
                </div>
                <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
                  {p.pinHash && <Icon name="lock" title="Protected by a PIN" />}
                  <span className="pixel ellipsis" style={{ fontSize: 20 }}>
                    {p.name}
                  </span>
                </div>
                <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
                  <RankBadge level={lvl} scale={1} stars={p.prestige} />
                  <span className="pixel">{rankInfo(lvl).full}</span>
                </div>
                <div className="row muted" style={{ justifyContent: 'center', gap: 12, fontSize: 13 }}>
                  <span className="row" style={{ gap: 4 }}>
                    <Icon name="flame" /> {st.current} day{st.current === 1 ? '' : 's'}
                  </span>
                  <span>Level {lifetimeLevel(p.lifetimeExp)}</span>
                </div>
                <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                  <Btn small icon="shirt" onClick={() => store.openPlayer(p.id, 'shop')} title="Open the wardrobe">
                    Wardrobe
                  </Btn>
                  <Btn
                    small
                    icon="trash"
                    kind="ghost"
                    title="Delete this player"
                    onClick={() => {
                      const ask = () =>
                        store.pushOverlay({
                          kind: 'confirm',
                          title: `Delete ${p.name}?`,
                          body: 'Deleting erases all of their projects, EXP, coins and stats. Export a backup first if you might want them back.',
                          confirm: 'Delete forever',
                          danger: true,
                          typeToConfirm: p.name,
                          onConfirm: () => void store.deletePlayer(p.id),
                        });
                      if (p.pinHash && !store.unlocked.has(p.id)) store.pushOverlay({ kind: 'pin', playerId: p.id, purpose: 'open', then: ask });
                      else ask();
                    }}
                  />
                </div>
              </div>
            );
          })}
          <button className="panel player-card add-card" onClick={() => s.go({ name: 'newPlayer' })}>
            <Icon name="plus" scale={6} />
            <span className="pixel" style={{ fontSize: 20 }}>
              Add player
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              Starts at Recruit I with the free starter items
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
