import { findChapter } from '../../core/game';
import { remainingAt, stepLabel, stepMinutes } from '../../core/timer';
import { fmtClock, isValidUrl } from '../../core/util';
import { platform } from '../../platform';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Bar, Btn, Icon, SceneView, Toggle, useNow } from '../kit';

export function Focus() {
  const s = useStore();
  const now = useNow(250);
  const t = s.timer;
  const p = s.player(t?.playerId);
  const back = () => (p ? store.go({ name: 'player', playerId: p.id, tab: 'projects' }) : store.go({ name: 'home' }));
  if (!t || !p) {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <SceneView className="bg-scene dimmed" state={sceneFor(undefined, { targetHeight: 170 })} />
        <div className="panel center" style={{ position: 'relative' }}>
          <h2>No Pomodoro running</h2>
          <p className="muted">Start one from any chapter or side quest.</p>
          <Btn onClick={() => (s.app.lastPlayerId ? store.openPlayer(s.app.lastPlayerId, 'projects') : store.go({ name: 'home' }))}>Back</Btn>
        </div>
      </div>
    );
  }
  const rem = remainingAt(t, now);
  const waiting = t.status === 'waiting';
  const ratio = t.plannedMs ? 1 - rem / t.plannedMs : 1;
  const chapter = t.target.kind === 'chapter' ? findChapter(p, t.target.id) : undefined;
  const nextMin = t.next ? stepMinutes(t.config, t.next) : 0;
  const title = waiting
    ? t.step === 'work'
      ? `Time for a ${t.next === 'long' ? 'long ' : ''}break`
      : 'Back to work'
    : t.step === 'work'
      ? `Work ${t.index} of ${t.config.sessions}`
      : stepLabel(t.step);
  return (
    <div className="screen focus-screen">
      <SceneView className="bg-scene" state={sceneFor(p, { charX: 0.5, targetHeight: 150 })} />
      <div className="focus-top">
        <Btn small icon="back" onClick={back}>
          Back to {p.name}
        </Btn>
        <span className="spacer" />
        <span className="row chip">
          Mini timer <Toggle on={s.settings.miniTimer} onChange={(v) => store.updateSettings({ miniTimer: v })} label="Mini timer" />
        </span>
      </div>
      <div className="focus-card panel">
        <div className="pixel muted" style={{ fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' }}>
          {title}
          {t.extension && !waiting ? ' · +5 min' : ''}
        </div>
        <div className="focus-target ellipsis" title={t.target.label}>
          {t.target.label}
        </div>
        <div className={`focus-clock num ${t.status === 'paused' ? 'blink' : ''}`}>{waiting ? fmtClock(nextMin * 60000) : fmtClock(rem)}</div>
        {!waiting && <Bar value={ratio} max={1} />}
        <div className="set-dots" title="Work sessions in this set">
          {Array.from({ length: t.config.sessions }, (_, i) => {
            const idx = i + 1;
            const doneDot = idx < t.index || (idx === t.index && (t.step !== 'work' || waiting));
            const cur = idx === t.index && t.step === 'work' && !waiting;
            return <i key={i} className={doneDot ? 'done' : cur ? 'cur' : ''} />;
          })}
          <span className="dim" style={{ fontSize: 12 }}>
            {t.config.work}/{t.config.short}/{t.config.long}
          </span>
        </div>
        {waiting ? (
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <Btn kind="primary" icon="play" onClick={() => store.timerAction('startNext')}>
              {t.next === 'work' ? 'Start work' : 'Start break'}
            </Btn>
            <Btn icon="skip" onClick={() => store.timerAction('skip')}>
              Skip
            </Btn>
            <Btn icon="plus" onClick={() => store.timerAction('extend')}>
              5 min
            </Btn>
            <Btn icon="stop" kind="ghost" onClick={() => store.timerAction('stop')}>
              Stop
            </Btn>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            {t.status === 'running' ? (
              <Btn kind="primary" icon="pause" onClick={() => store.timerAction('pause')}>
                Pause
              </Btn>
            ) : (
              <Btn kind="primary" icon="play" onClick={() => store.timerAction('resume')}>
                Resume
              </Btn>
            )}
            <Btn icon="skip" onClick={() => store.timerAction('skip')} title="End this step now and go to the next">
              Skip step
            </Btn>
            <Btn icon="plus" onClick={() => store.timerAction('extend')}>
              5 min
            </Btn>
            <Btn
              icon="stop"
              kind="ghost"
              onClick={() =>
                store.pushOverlay({
                  kind: 'confirm',
                  title: 'Stop this set?',
                  body: 'Minutes you already worked still give EXP.',
                  confirm: 'Stop',
                  onConfirm: () => store.timerAction('stop'),
                })
              }
            >
              Stop
            </Btn>
          </div>
        )}
        <div className="dim" style={{ fontSize: 12 }}>
          Space pauses and resumes. Paused time gives no EXP.
        </div>
        {chapter && chapter.chapter.resources.length > 0 && (
          <div className="focus-res">
            {chapter.chapter.resources.map((r) => (
              <span key={r.id} className="row" style={{ gap: 6 }}>
                <Icon name={isValidUrl(r.url) ? 'link' : 'book'} />
                {isValidUrl(r.url) ? (
                  <button className="linkbtn" onClick={() => platform.openExternal(r.url)}>
                    {r.label}
                  </button>
                ) : (
                  <span>{r.label}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
