import { useEffect } from 'react';
import { remainingAt, stepLabel } from '../core/timer';
import { fmtClock } from '../core/util';
import { isElectron, platform } from '../platform';
import { store, useStore } from '../store';
import { Icon, Logo, useNow } from './kit';
import { Overlays } from './overlays';
import { Focus } from './screens/Focus';
import { Home } from './screens/Home';
import { Loading } from './screens/Loading';
import { NewPlayer } from './screens/NewPlayer';
import { PlayerView } from './screens/PlayerView';
import { Players } from './screens/Players';
import { Record } from './screens/Record';
import { SettingsScreen } from './screens/Settings';

function TimerPill() {
  const s = useStore();
  const now = useNow(500);
  const t = s.timer;
  if (!t || s.route.name === 'focus') return null;
  const label = t.status === 'waiting' ? (t.step === 'work' ? 'Work done' : 'Break over') : t.step === 'work' ? `Work ${t.index}/${t.config.sessions}` : stepLabel(t.step);
  return (
    <button className="chip bright no-drag" style={{ cursor: 'pointer' }} onClick={() => s.go({ name: 'focus' })} title="Open the focus timer">
      <Icon name={t.status === 'paused' ? 'pause' : t.step === 'work' ? 'clock' : 'moon'} />
      <span>{label}</span>
      <span className={`num ${t.status === 'waiting' ? 'blink' : ''}`}>{t.status === 'waiting' ? '00:00' : fmtClock(remainingAt(t, now))}</span>
    </button>
  );
}

function TitleBar() {
  const win = isElectron && platform.platform === 'win32';
  return (
    <header className={`titlebar ${win ? 'win' : ''}`}>
      <Logo size={18} />
      <span className="brand">ARRAZI</span>
      <span className="spacer" />
      <TimerPill />
      {isElectron && platform.platform !== 'win32' && (
        <span className="row no-drag" style={{ gap: 4 }}>
          <button className="btn small ghost icon" onClick={() => platform.winControl('minimize')} title="Minimize">
            <Icon name="minus" />
          </button>
          <button className="btn small ghost icon" onClick={() => platform.winControl('close')} title="Close">
            <Icon name="close" />
          </button>
        </span>
      )}
    </header>
  );
}

function Toasts() {
  const s = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={t.kind === 'coins' ? 'coin' : t.kind === 'exp' ? 'exp' : t.kind === 'level' ? 'star' : t.kind === 'warn' ? 'warn' : 'moon'} shift={t.kind === 'level' ? -4 : 0} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const s = useStore();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && store.timer && store.overlays.length === 0) {
        e.preventDefault();
        store.command('timer:toggle');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const r = s.route;
  let screen = null;
  switch (r.name) {
    case 'loading':
      screen = <Loading />;
      break;
    case 'home':
      screen = <Home />;
      break;
    case 'players':
      screen = <Players />;
      break;
    case 'newPlayer':
      screen = <NewPlayer />;
      break;
    case 'player':
      screen = <PlayerView key={r.playerId} />;
      break;
    case 'focus':
      screen = <Focus />;
      break;
    case 'record':
      screen = <Record />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
  }
  return (
    <div className="app">
      <TitleBar />
      <main className="main">{screen}</main>
      <Overlays />
      <Toasts />
    </div>
  );
}
