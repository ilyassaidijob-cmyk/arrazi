import { gearUrl, homeIconUrl } from '../../art/icons';
import { isBloodMoon } from '../../core/game';
import { levelFromExp, rankInfo } from '../../core/ranks';
import { streakInfo } from '../../core/stats';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Btn, CharacterView, Icon, Logo, Pix, RankBadge, SceneView } from '../kit';

function BigIcon({ label, sub, onClick, children }: { label: string; sub: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="home-icon" onClick={onClick}>
      <span className="home-icon-art">{children}</span>
      <span className="home-icon-label">{label}</span>
      <span className="home-icon-sub">{sub}</span>
    </button>
  );
}

export function Home() {
  const s = useStore();
  const last = s.player(s.app.lastPlayerId) ?? s.players[0];
  const today = s.today();
  const blood = isBloodMoon(today);
  return (
    <div className="screen" style={{ overflow: 'hidden' }}>
      <SceneView className="bg-scene" state={sceneFor(last, { charX: 0.2, targetHeight: 190, mood: last ? sceneFor(last).mood : 'idle' })} />
      <div className="home">
        <div className="home-head">
          <Logo size={96} />
          <h1>ARRAZI</h1>
          <p className="muted">Learn new skills, played like a game.</p>
          {blood && (
            <span className="chip bright" style={{ marginTop: 6 }}>
              <Icon name="moon" /> Blood Moon tonight: all EXP is doubled
            </span>
          )}
        </div>
        <div className="home-icons">
          <BigIcon label="Player" sub={`${s.players.length} on this PC`} onClick={() => s.go({ name: 'players' })}>
            <CharacterView look={last?.look ?? { body: 'boy', hair: 'hair_messy', hairShade: 'shade_ash', top: 'top_tunic', bottom: 'bottom_trousers', shoes: 'shoes_boots', background: 'bg_night' }} scale={3} />
          </BigIcon>
          <BigIcon label="Record" sub="Leaderboard" onClick={() => s.go({ name: 'record' })}>
            <Pix src={homeIconUrl('trophy')} scale={4} />
          </BigIcon>
          <BigIcon label="Settings" sub="Sound, timer, backup" onClick={() => s.go({ name: 'settings' })}>
            <Pix src={gearUrl()} scale={4} />
          </BigIcon>
        </div>
        {last ? (
          <div className="panel home-last">
            <CharacterView look={last.look} scale={2} />
            <div className="grow">
              <div className="pixel" style={{ fontSize: 18 }}>
                {last.name}
              </div>
              <div className="row muted" style={{ gap: 10, fontSize: 13 }}>
                <span className="row" style={{ gap: 5 }}>
                  <RankBadge level={levelFromExp(last.seasonExp)} scale={1} />
                  {rankInfo(levelFromExp(last.seasonExp)).full}
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <Icon name="flame" /> {streakInfo(last, today, s.settings.dayStartMinutes).current} day streak
                </span>
              </div>
            </div>
            <Btn kind="primary" icon="play" onClick={() => store.openPlayer(last.id)}>
              Continue
            </Btn>
          </div>
        ) : (
          <div className="panel home-last">
            <div className="grow muted">No players yet. Add one to start learning.</div>
            <Btn kind="primary" icon="plus" onClick={() => s.go({ name: 'newPlayer' })}>
              Add player
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
