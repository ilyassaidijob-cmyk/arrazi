// The mini timer: a small always-on-top window with the countdown and the current step.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { iconUrl } from './art/icons';
import { platform, type MiniState } from './platform';
import './styles.css';

function Mini() {
  const [s, setS] = useState<MiniState | null>(null);
  useEffect(() => platform.onMiniState(setS), []);
  const cmd = (c: string) => platform.miniCommand(c);
  return (
    <div className="mini" onDoubleClick={() => cmd('open-focus')}>
      <div className="mini-drag">
        <span className="pixel muted ellipsis" style={{ fontSize: 12 }}>
          {s ? s.step : 'Arrazi'}
        </span>
        <span className="spacer" />
        <button className="mini-x" onClick={() => cmd('mini:close')} title="Hide the mini timer">
          <img className="px" src={iconUrl('close', -1)} width={14} height={14} alt="" />
        </button>
      </div>
      <div className="row" style={{ gap: 8, padding: '0 10px' }}>
        <span className={`num mini-clock ${s?.status === 'paused' || s?.status === 'waiting' ? 'blink' : ''}`}>{s ? s.remaining : '--:--'}</span>
        <span className="spacer" />
        {s && (
          <button className="btn small icon" onClick={() => cmd(s.status === 'running' ? 'timer:pause' : s.status === 'paused' ? 'timer:resume' : 'timer:start')} title={s.status === 'running' ? 'Pause' : 'Start'}>
            <img className="px" src={iconUrl(s.status === 'running' ? 'pause' : 'play')} width={14} height={14} alt="" />
          </button>
        )}
        <button className="btn small icon" onClick={() => cmd('open-focus')} title="Open Arrazi">
          <img className="px" src={iconUrl('next')} width={14} height={14} alt="" />
        </button>
      </div>
      <div className="mini-label ellipsis">{s ? s.label : 'No Pomodoro running'}</div>
      <div className="mini-bar">
        <i style={{ width: `${Math.round((s?.progress ?? 0) * 100)}%` }} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Mini />);
