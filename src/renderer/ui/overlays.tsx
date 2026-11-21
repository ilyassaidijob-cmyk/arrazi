import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { badgeUrl, challengeBadgeUrl, leaderBadgeUrl } from '../art/badges';
import { bossBuf, bossUrl } from '../art/bosses';
import { buildingBuf } from '../art/buildings';
import { characterCanvas } from '../art/character';
import { dataUrl } from '../art/pixels';
import { ACHIEVEMENT } from '../core/achievements';
import { BOSS, CHALLENGE, ITEM, MOONS, PROJECT_ICON } from '../core/catalog';
import { characterBuf } from '../art/character';
import { monthIndex, prettyDay } from '../core/dates';
import { findChapter, isSentence } from '../core/game';
import { EXP, levelFromExp, lifetimeLevel, rankInfo } from '../core/ranks';
import { derive, streakInfo } from '../core/stats';
import { stepMinutes } from '../core/timer';
import type { Look } from '../core/types';
import { fmtMinutes, fmtNum } from '../core/util';
import { play } from '../sound';
import { type Overlay, store, useStore } from '../store';
import { Bar, Btn, Card, CharacterView, Crow, Icon, Logo, Pix, RankBadge } from './kit';

export function Overlays() {
  const s = useStore();
  const o = s.overlays[0];
  if (!o) return null;
  return (
    <div className="overlay" key={o.id}>
      <OverlayCard o={o} />
    </div>
  );
}

function close(o: Overlay) {
  store.closeOverlay(o.id);
}

function ItemLine({ id }: { id: string }) {
  const it = ITEM[id];
  if (!it) return null;
  const s = store;
  const p = s.currentPlayer ?? s.players[0];
  const look: Look | undefined = p && it.slot !== 'background' && it.slot !== 'prop' ? ({ ...p.look, [it.slot]: id } as Look) : undefined;
  return (
    <div className="row slot" style={{ padding: '6px 10px', gap: 10, justifyContent: 'center' }}>
      {look && <Pix src={dataUrl(`prev:${JSON.stringify(look)}`, () => characterBuf(look, 'stand', 0))} scale={2} />}
      <span>
        New item: <b className="pixel">{it.name}</b>
      </span>
    </div>
  );
}

function OverlayCard({ o }: { o: Overlay }) {
  switch (o.kind) {
    case 'stepEnd':
      return <StepEndCard o={o} />;
    case 'setComplete':
      return <SetCompleteCard o={o} />;
    case 'stopped':
      return <StoppedCard o={o} />;
    case 'note':
      return <NoteCard o={o} />;
    case 'rankUp':
      return <RankUpCard o={o} />;
    case 'achievement':
      return <AchievementCard o={o} />;
    case 'challenge':
      return <ChallengeCard o={o} />;
    case 'bossBeaten':
      return <BossBeatenCard o={o} />;
    case 'project':
      return <ProjectCard o={o} />;
    case 'prestige':
      return <PrestigeCard o={o} />;
    case 'notice':
      return <NoticeCard o={o} />;
    case 'confirm':
      return <ConfirmCard o={o} />;
    case 'pin':
      return <PinCard o={o} />;
    case 'playerDetails':
      return <PlayerDetailsCard o={o} />;
  }
}

// ---------------------------------------------------------------- Pomodoro cards

function BossFight({ bossId, before, after, hp }: { bossId: string; before: number; after: number; hp: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const anim = store.settings.animations;
  const [k, setK] = useState(anim ? 0 : 1);
  const p = store.currentPlayer ?? store.player(store.app.lastPlayerId);
  const look = p?.look;
  useEffect(() => {
    if (!anim) return;
    const t0 = performance.now();
    let raf = 0;
    let lastHit = -1;
    const step = (now: number) => {
      const v = Math.min(1, (now - t0) / 2200);
      setK(v);
      const hit = Math.floor(v * 4);
      if (hit !== lastHit && hit < 4 && (now - t0) % 550 < 400) {
        lastHit = hit;
        play('hit');
      }
      if (v < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [anim]);
  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 50, cv.width, 10);
    ctx.fillStyle = '#6c6c6c';
    ctx.fillRect(0, 50, cv.width, 1);
    const swing = Math.floor(k * 16) % 2;
    const hurt = anim && k < 1 && swing === 1;
    if (look) {
      const dash = anim && k < 1 ? Math.round(Math.sin(k * Math.PI * 4) * 6 + 6) : 0;
      ctx.drawImage(characterCanvas(look, k < 1 && anim ? 'attack' : 'stand', swing), 22 + dash, 51 - 30);
    }
    const bb = bossBuf(bossId, hurt).toCanvas();
    const shake = hurt ? 2 : 0;
    ctx.drawImage(bb, 120 - bb.width / 2 + shake, 51 - bb.height);
    if (anim && k > 0.05 && k < 1 && after > before) {
      ctx.fillStyle = '#e6e6e6';
      ctx.font = '10px "Tiny5", monospace';
      ctx.fillText(`-${after - before}`, 112, 18 - Math.round(k * 10));
    }
  });
  const shown = before + (after - before) * k;
  return (
    <div className="col" style={{ gap: 6, margin: '6px 0 4px' }}>
      <canvas ref={ref} width={160} height={60} className="px" style={{ width: 480, maxWidth: '100%', alignSelf: 'center', border: '2px solid var(--g2)' }} />
      <div className="row" style={{ fontSize: 13 }}>
        <span className="pixel">{BOSS[bossId]?.name}</span>
        <span className="spacer" />
        <span className="num muted">
          HP {fmtNum(Math.max(0, hp - shown))} / {fmtNum(hp)}
        </span>
      </div>
      <Bar value={Math.max(0, hp - shown)} max={hp} />
    </div>
  );
}

function StepEndCard({ o }: { o: Extract<Overlay, { kind: 'stepEnd' }> }) {
  const r = o.o;
  const work = r.finished === 'work';
  const mins = stepMinutes(r.config, r.next);
  const title = work ? (r.next === 'long' ? 'Time for a long break' : 'Time for a break') : 'Back to work';
  const timer = store.timer;
  const stale = !timer || (timer.status === 'running' && !r.autoStarted);
  return (
    <Card className="center step-card">
      <Crow mode="land" style={{ top: -6, right: 26 }} />
      <h2>{work ? 'Work done!' : 'Break over!'}</h2>
      <p className="lead">
        {work
          ? `${title}: ${mins} minutes.${r.exp > 0 ? ` +${r.exp} EXP for ${Math.floor(r.minutes)} focused minutes.` : ''}`
          : `${title}: session ${r.nextIndex} of ${r.config.sessions} on ${r.target.label}.`}
      </p>
      {work && o.fight && <BossFight {...o.fight} />}
      {r.autoStarted && <p className="muted">The {r.next === 'work' ? 'work session' : 'break'} has started.</p>}
      <div className="actions">
        {stale ? (
          <Btn kind="primary" onClick={() => close(o)}>
            OK
          </Btn>
        ) : r.autoStarted ? (
          <>
            <Btn kind="primary" icon="check" onClick={() => close(o)}>
              OK
            </Btn>
            <Btn icon="skip" onClick={() => store.timerAction('skip')}>
              Skip
            </Btn>
            <Btn icon="plus" onClick={() => store.timerAction('extend')}>
              5 min
            </Btn>
          </>
        ) : (
          <>
            <Btn kind="primary" icon="play" onClick={() => store.timerAction('startNext')}>
              {work ? 'Start break' : 'Start work'}
            </Btn>
            <Btn icon="skip" onClick={() => store.timerAction('skip')} title={work ? 'Skip the break and keep working' : 'Skip this work session'}>
              Skip
            </Btn>
            <Btn icon="plus" onClick={() => store.timerAction('extend')} title={work ? 'Keep working 5 more minutes' : '5 more minutes of break'}>
              5 min
            </Btn>
          </>
        )}
      </div>
    </Card>
  );
}

function SetCompleteCard({ o }: { o: Extract<Overlay, { kind: 'setComplete' }> }) {
  const r = o.o;
  const [ask, setAsk] = useState<'finished' | 'again'>('finished');
  const p = store.player(r.playerId);
  const isChapter = r.target.kind === 'chapter';
  const doneAlready = isChapter ? findChapter(p!, r.target.id)?.chapter.state === 'done' : !!p?.sideQuests.find((q) => q.id === r.target.id)?.doneAt;
  return (
    <Card className="center step-card">
      <Crow mode="land" style={{ top: -6, right: 26 }} />
      <div className="moon-full" />
      <h2>Set complete!{r.valid && r.exp ? ` +${r.exp} EXP` : ''}</h2>
      {!r.valid && <p className="muted">No set bonus this time: every work session must be 15 minutes or longer.</p>}
      {ask === 'finished' && !doneAlready ? (
        <>
          <p className="lead">Is {isChapter ? 'the chapter' : 'the side quest'} "{r.target.label}" finished?</p>
          <div className="actions">
            <Btn
              kind="primary"
              icon="check"
              onClick={() => {
                close(o);
                if (!p) return;
                if (isChapter) store.completeChapter(p, r.target.id);
                else store.completeSideQuest(p, r.target.id);
              }}
            >
              Yes, it's done
            </Btn>
            <Btn onClick={() => setAsk('again')}>No</Btn>
          </div>
        </>
      ) : (
        <>
          <p className="lead">Start another set on "{r.target.label}"?</p>
          <div className="actions">
            <Btn
              kind="primary"
              icon="play"
              onClick={() => {
                close(o);
                if (p) store.startPomodoro(p, r.target);
              }}
            >
              Start another set
            </Btn>
            <Btn onClick={() => close(o)}>Not now</Btn>
          </div>
        </>
      )}
    </Card>
  );
}

function StoppedCard({ o }: { o: Extract<Overlay, { kind: 'stopped' }> }) {
  const r = o.o;
  const p = store.player(r.playerId);
  const isChapter = r.target.kind === 'chapter';
  const done = isChapter ? findChapter(p!, r.target.id)?.chapter.state === 'done' : !!p?.sideQuests.find((q) => q.id === r.target.id)?.doneAt;
  return (
    <Card className="center">
      <h2>Set stopped</h2>
      <p className="lead">{r.minutes >= 1 ? `+${r.exp} EXP for ${fmtMinutes(r.minutes)} worked.` : 'No full minute was worked, so no EXP this time.'}</p>
      <div className="actions">
        {!done && p && (
          <Btn
            icon="check"
            onClick={() => {
              close(o);
              if (isChapter) store.completeChapter(p, r.target.id);
              else store.completeSideQuest(p, r.target.id);
            }}
          >
            Mark "{r.target.label}" done
          </Btn>
        )}
        <Btn kind="primary" onClick={() => close(o)}>
          OK
        </Btn>
      </div>
    </Card>
  );
}

function NoteCard({ o }: { o: Extract<Overlay, { kind: 'note' }> }) {
  const p = store.player(o.playerId);
  const f = p ? findChapter(p, o.chapterId) : undefined;
  const [text, setText] = useState(f?.chapter.note ?? '');
  if (!p || !f) return null;
  const ok = isSentence(text);
  const already = !!f.chapter.note && isSentence(f.chapter.note);
  return (
    <Card style={{ textAlign: 'left' }}>
      <h2>What I learned</h2>
      <p className="lead">
        "{f.chapter.name}" is done! Write at least one sentence in your own words{already ? '' : ` for +${EXP.note} EXP`}. It stays with the chapter for later revision.
      </p>
      <textarea className="note-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Today I learned that…" rows={6} />
      <div className="row" style={{ marginTop: 6 }}>
        <span className="dim" style={{ fontSize: 12 }}>
          {ok ? 'Looks good.' : 'At least one full sentence (3 or more words).'}
        </span>
      </div>
      <div className="actions">
        <Btn onClick={() => close(o)}>Skip</Btn>
        <Btn
          kind="primary"
          icon="check"
          disabled={!text.trim()}
          onClick={() => {
            store.saveNote(p, f.chapter.id, text);
            close(o);
          }}
        >
          Save note
        </Btn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- rewards

function RankUpCard({ o }: { o: Extract<Overlay, { kind: 'rankUp' }> }) {
  useEffect(() => play('levelup'), []);
  const ri = rankInfo(o.to);
  return (
    <Card className="center rank-card">
      <div className="rankup-sky">
        <div className="rankup-moon" />
        <div className="rankup-carrier">
          <Crow mode="across" scale={4} style={{ position: 'relative' }} />
          <span className="rankup-logo">
            <Logo size={34} />
          </span>
        </div>
      </div>
      <h2>Rank up!</h2>
      <div className="row" style={{ justifyContent: 'center', gap: 14, margin: '8px 0 12px' }}>
        <RankBadge level={o.to} scale={4} />
        <div style={{ textAlign: 'left' }}>
          <div className="pixel" style={{ fontSize: 30 }}>
            {ri.full}
          </div>
          <div className="muted">from {rankInfo(o.from).full}</div>
        </div>
      </div>
      {o.coins > 0 && (
        <span className="chip bright" style={{ fontSize: 16 }}>
          <Icon name="coin" /> +{fmtNum(o.coins)} coins
        </span>
      )}
      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {o.items.map((id) => (
          <ItemLine key={id} id={id} />
        ))}
      </div>
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          Onward
        </Btn>
      </div>
    </Card>
  );
}

function AchievementCard({ o }: { o: Extract<Overlay, { kind: 'achievement' }> }) {
  const a = ACHIEVEMENT[o.achId];
  useEffect(() => play('crow'), []);
  if (!a) return null;
  return (
    <Card className="center">
      <Crow mode="land" style={{ top: -4, right: 30 }} />
      <div className="badge-drop">
        <Pix src={badgeUrl(a.id, a.type, false)} scale={5} />
      </div>
      <div className="pixel muted" style={{ letterSpacing: 1 }}>
        NEW BADGE{a.hidden ? ' · HIDDEN' : ''}
      </div>
      <h2>{a.name}</h2>
      <p className="lead">{a.how}</p>
      <span className="chip bright" style={{ fontSize: 16 }}>
        <Icon name="coin" /> +{fmtNum(o.coins)} coins
      </span>
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          Nice
        </Btn>
      </div>
    </Card>
  );
}

function ChallengeCard({ o }: { o: Extract<Overlay, { kind: 'challenge' }> }) {
  const c = CHALLENGE[o.chId];
  useEffect(() => play('badge'), []);
  return (
    <Card className="center">
      <Pix src={challengeBadgeUrl(monthIndex(o.month), true)} scale={4} />
      <div className="pixel muted" style={{ letterSpacing: 1, marginTop: 8 }}>
        {MOONS[monthIndex(o.month)].name.toUpperCase()} CHALLENGE
      </div>
      <h2>{c?.label}</h2>
      <span className="chip bright" style={{ fontSize: 16 }}>
        <Icon name="coin" /> +{fmtNum(o.coins)} coins
      </span>
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          OK
        </Btn>
      </div>
    </Card>
  );
}

function BossBeatenCard({ o }: { o: Extract<Overlay, { kind: 'bossBeaten' }> }) {
  const b = BOSS[o.bossId];
  useEffect(() => play('levelup'), []);
  return (
    <Card className="center">
      <div className="boss-defeat">
        <Pix src={bossUrl(o.bossId, true)} scale={5} />
      </div>
      <h2>You defeated {b?.name}!</h2>
      <p className="lead">Your focus this week was too much for it.</p>
      <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
        <span className="chip bright">
          <Icon name="coin" /> +{fmtNum(o.coins)} coins
        </span>
        <span className="chip bright">
          <Icon name="exp" /> +{EXP.boss} EXP
        </span>
      </div>
      {o.item && (
        <div style={{ marginTop: 10 }}>
          <ItemLine id={o.item} />
        </div>
      )}
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          Victory
        </Btn>
      </div>
    </Card>
  );
}

function ProjectCard({ o }: { o: Extract<Overlay, { kind: 'project' }> }) {
  const p = store.player(o.playerId);
  const pr = p?.projects.find((x) => x.id === o.projectId);
  const def = pr ? PROJECT_ICON[pr.icon] : undefined;
  useEffect(() => play('levelup'), []);
  return (
    <Card className="center">
      {def && <Pix src={dataUrl(`bld:${def.building}`, () => buildingBuf({ type: def.building, progress: 1, done: true, label: '' }, 0))} scale={4} />}
      <h2>Project complete!</h2>
      <p className="lead">
        You finished every mission of {o.name}. {def ? `A ${def.buildingName.toLowerCase()} now stands in your world.` : ''}
      </p>
      <span className="chip bright" style={{ fontSize: 16 }}>
        <Icon name="exp" /> +{EXP.project} EXP bonus
      </span>
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          Wonderful
        </Btn>
      </div>
    </Card>
  );
}

function PrestigeCard({ o }: { o: Extract<Overlay, { kind: 'prestige' }> }) {
  useEffect(() => play('levelup'), []);
  return (
    <Card className="center">
      <div className="pixel" style={{ fontSize: 40, letterSpacing: 6 }}>
        {'★'.repeat(Math.min(o.stars, 8))}
      </div>
      <h2>Prestige {o.stars}</h2>
      <p className="lead">Back to Recruit I with a new star. Every coin you earn now pays +{o.stars * 10}%.</p>
      {o.item && <ItemLine id={o.item} />}
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          Climb again
        </Btn>
      </div>
    </Card>
  );
}

function NoticeCard({ o }: { o: Extract<Overlay, { kind: 'notice' }> }) {
  const n = o.notice;
  if (n.kind === 'season') {
    const moon = MOONS[monthIndex(n.season)];
    const next = MOONS[monthIndex(n.newSeason)];
    return (
      <Card className="center">
        <Crow mode="land" style={{ top: -4, right: 30 }} />
        <div className="moon-full" />
        <h2>The {moon.name} has set</h2>
        <p className="lead">
          {n.active
            ? `Your best rank this season: ${rankInfo(n.peakLevel).full}. Season reward: ${n.coins} coins${n.item ? ` and the ${ITEM[n.item]?.name}` : ''}.`
            : 'You were away this season, so there is no season reward.'}
        </p>
        {n.item && <ItemLine id={n.item} />}
        <p className="muted" style={{ marginTop: 12 }}>
          A new season begins: the {next.name}. {next.blurb} Your season rank dropped from {rankInfo(n.from).full} to {rankInfo(n.to).full}, and climbing back pays rank coins again. Your lifetime level never drops.
        </p>
        <div className="actions">
          <Btn kind="primary" onClick={() => close(o)}>
            Start the {next.name}
          </Btn>
        </div>
      </Card>
    );
  }
  if (n.kind === 'bossEscaped') {
    const b = BOSS[n.bossId];
    return (
      <Card className="center">
        <Pix src={bossUrl(n.bossId)} scale={4} />
        <h2>{b?.name} laughs and leaves</h2>
        <p className="lead">
          "{b?.laugh}" You dealt {fmtNum(n.damage)} of {fmtNum(n.hp)} damage. A new boss appears this week.
        </p>
        <div className="actions">
          <Btn kind="primary" onClick={() => close(o)}>
            Next time
          </Btn>
        </div>
      </Card>
    );
  }
  if (n.kind === 'freeze') {
    return (
      <Card className="center">
        <Icon name="freeze" scale={6} />
        <h2>Streak saved</h2>
        <p className="lead">
          You missed {prettyDay(n.day)}, so a streak freeze was used. {n.left} left.
        </p>
        <div className="actions">
          <Btn kind="primary" onClick={() => close(o)}>
            Phew
          </Btn>
        </div>
      </Card>
    );
  }
  return (
    <Card className="center">
      <Pix src={leaderBadgeUrl(n.badge)} scale={4} />
      <h2>{n.badge === 'focus' ? 'Top focuser' : 'Streak keeper'}</h2>
      <p className="lead">
        Weekly badge for the week of {prettyDay(n.week)}: {n.badge === 'focus' ? 'the most focus hours on this PC' : 'the longest streak on this PC'}.
      </p>
      <span className="chip bright">
        <Icon name="coin" /> +{n.coins} coins
      </span>
      <div className="actions">
        <Btn kind="primary" onClick={() => close(o)}>
          OK
        </Btn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- dialogs

function ConfirmCard({ o }: { o: Extract<Overlay, { kind: 'confirm' }> }) {
  const [typed, setTyped] = useState('');
  const ok = !o.typeToConfirm || typed.trim() === o.typeToConfirm.trim();
  return (
    <Card className="center" onClose={() => close(o)}>
      <h2>{o.title}</h2>
      <p className="lead">{o.body}</p>
      {o.typeToConfirm && (
        <label className="field" style={{ textAlign: 'left' }}>
          Type "{o.typeToConfirm}" to confirm
          <input type="text" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
      )}
      <div className="actions">
        <Btn onClick={() => close(o)}>Cancel</Btn>
        <Btn
          kind="primary"
          icon={o.danger ? 'trash' : 'check'}
          disabled={!ok}
          onClick={() => {
            close(o);
            o.onConfirm();
          }}
        >
          {o.confirm}
        </Btn>
      </div>
    </Card>
  );
}

function PinCard({ o }: { o: Extract<Overlay, { kind: 'pin' }> }) {
  const p = store.player(o.playerId);
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const submit = async (value: string) => {
    if (!p) return;
    if (o.purpose === 'open') {
      if (await store.checkPin(p.id, value)) {
        close(o);
        o.then?.();
      } else {
        setErr('Wrong PIN');
        setPin('');
      }
    } else if (first === null) {
      setFirst(value);
      setPin('');
      setErr('');
    } else if (first === value) {
      await store.setPin(p.id, value);
      store.toast(`PIN set for ${p.name}`);
      close(o);
      o.then?.();
    } else {
      setErr('The PINs did not match. Try again.');
      setFirst(null);
      setPin('');
    }
  };
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const v = pin + d;
    setPin(v);
    setErr('');
    if (v.length === 4) void submit(v);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((x) => x.slice(0, -1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  if (!p) return null;
  return (
    <Card className="center" onClose={() => close(o)} style={{ width: 340 }}>
      <CharacterView look={p.look} scale={3} />
      <h2>{p.name}</h2>
      <p className="lead">{o.purpose === 'open' ? 'Enter the 4-digit PIN' : first === null ? 'Choose a new 4-digit PIN' : 'Type the new PIN again'}</p>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="dim" style={{ minHeight: 20 }}>
        {err}
      </div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((d, i) =>
          d === '' ? (
            <span key={i} />
          ) : (
            <Btn key={i} onClick={() => (d === '<' ? setPin((x) => x.slice(0, -1)) : press(d))}>
              {d === '<' ? <Icon name="back" /> : d}
            </Btn>
          ),
        )}
      </div>
    </Card>
  );
}

function PlayerDetailsCard({ o }: { o: Extract<Overlay, { kind: 'playerDetails' }> }) {
  const s = store;
  const p = s.player(o.playerId);
  if (!p) return null;
  const ds = s.settings.dayStartMinutes;
  const d = derive(p, s.today(), ds);
  const st = streakInfo(p, s.today(), ds);
  const lvl = levelFromExp(p.seasonExp);
  return (
    <Card className="center" onClose={() => close(o)} wide>
      <div className="row" style={{ gap: 18, justifyContent: 'center' }}>
        <CharacterView look={p.look} scale={5} />
        <div style={{ textAlign: 'left' }}>
          <h2>{p.name}</h2>
          <div className="row" style={{ gap: 8 }}>
            <RankBadge level={lvl} scale={2} stars={p.prestige} />
            <span className="pixel" style={{ fontSize: 20 }}>
              {rankInfo(lvl).full}
            </span>
          </div>
          <div className="muted">Lifetime level {lifetimeLevel(p.lifetimeExp)} · {fmtNum(p.lifetimeExp)} EXP</div>
        </div>
      </div>
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="stat-v num">{fmtMinutes(d.totalFocusMin)}</div>
          <div className="stat-l">Focused</div>
        </div>
        <div className="stat">
          <div className="stat-v num">{d.chaptersDone}</div>
          <div className="stat-l">Chapters</div>
        </div>
        <div className="stat">
          <div className="stat-v num">{st.current}</div>
          <div className="stat-l">Streak (best {st.longest})</div>
        </div>
        <div className="stat">
          <div className="stat-v num">{Object.keys(p.achievements).length}</div>
          <div className="stat-l">Badges</div>
        </div>
        <div className="stat">
          <div className="stat-v num">{p.bosses.filter((b) => b.beaten).length}</div>
          <div className="stat-l">Bosses beaten</div>
        </div>
        <div className="stat">
          <div className="stat-v num">{d.projectsDone}</div>
          <div className="stat-l">Projects done</div>
        </div>
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>
        Read-only summary. Projects, notes and wardrobe stay private.
      </p>
    </Card>
  );
}
