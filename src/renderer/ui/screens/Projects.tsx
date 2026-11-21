import { useMemo, useState } from 'react';
import { projectIconUrl } from '../../art/icons';
import { PROJECT_ICON } from '../../core/catalog';
import { diffDays, prettyDay } from '../../core/dates';
import { missionDone, missionUnlocked, moveItem, newChapter, newMission, newProject, projectDone, setChapterDifficulty } from '../../core/game';
import { DIFF_EXP, DIFF_LABEL, EXP } from '../../core/ranks';
import { focusByRef } from '../../core/stats';
import { resolveConfig } from '../../core/timer';
import type { Chapter, Difficulty, Mission, Player, Project, ProjectIcon } from '../../core/types';
import { fmtMinutes, isValidUrl } from '../../core/util';
import { platform } from '../../platform';
import { store, useStore } from '../../store';
import { DateField, DifficultyPicker, IconPicker, Modal, PomodoroOverrideEditor, ResourcesEditor } from '../forms';
import { Bar, Btn, Field, Icon, NumberField, Pix, Toggle } from '../kit';

function dueChip(date?: string, done?: boolean) {
  if (!date || done) return null;
  const left = diffDays(store.today(), date);
  return (
    <span className={`chip ${left < 0 ? 'bright' : ''}`} title={`Target date: ${prettyDay(date)}`}>
      <Icon name={left < 0 ? 'warn' : 'calendar'} />
      {left < 0 ? `${-left}d late` : left === 0 ? 'today' : `${left}d left`}
    </span>
  );
}

export function Projects({ p, projectId }: { p: Player; projectId?: string }) {
  const pr = projectId ? p.projects.find((x) => x.id === projectId) : undefined;
  if (pr) return <ProjectDetail p={p} pr={pr} />;
  return <ProjectList p={p} />;
}

// ---------------------------------------------------------------- list

function ProjectList({ p }: { p: Player }) {
  const s = useStore();
  const [editing, setEditing] = useState<Project | null>(null);
  const focus = useMemo(() => focusByRef(p), [p, s.version]);
  const open = (id: string) => store.go({ name: 'player', playerId: p.id, tab: 'projects', projectId: id });
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row">
        <span className="muted">A project is a skill. Split it into missions (topics) and chapters (lessons you finish in a few Pomodoros).</span>
        <span className="spacer" />
        <Btn icon="book" onClick={() => importStarter(p)} title="Add a ready-made Cybersecurity path">
          Starter path
        </Btn>
        <Btn kind="primary" icon="plus" onClick={() => setEditing(newProject({ name: '' }))}>
          New project
        </Btn>
      </div>
      {p.projects.length === 0 && (
        <div className="empty">
          <Pix src={projectIconUrl('shield')} scale={4} />
          <p className="pixel" style={{ fontSize: 18, margin: '10px 0 4px' }}>
            What do you want to learn?
          </p>
          <p style={{ margin: 0 }}>Add a project such as Cybersecurity, or start from the ready-made Cybersecurity path.</p>
        </div>
      )}
      <div className="project-grid">
        {p.projects.map((pr) => {
          const total = pr.missions.length;
          const done = pr.missions.filter(missionDone).length;
          const complete = projectDone(pr);
          return (
            <button key={pr.id} className={`panel project-card ${complete ? 'complete' : ''}`} onClick={() => open(pr.id)}>
              <div className="row" style={{ gap: 12 }}>
                <span className="slot" style={{ padding: 6, display: 'grid' }}>
                  <Pix src={projectIconUrl(pr.icon)} scale={3} />
                </span>
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div className="pixel ellipsis" style={{ fontSize: 20 }}>
                    {pr.name}
                  </div>
                  <div className="muted ellipsis" style={{ fontSize: 13 }}>
                    {pr.goal || 'No goal yet'}
                  </div>
                </div>
                {complete && (
                  <span className="chip solid">
                    <Icon name="check" shift={-4} /> Done
                  </span>
                )}
              </div>
              <Bar value={done} max={Math.max(1, total)} />
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="chip">
                  {done} / {total} missions
                </span>
                <span className="chip">
                  <Icon name="clock" /> {fmtMinutes(focus.project.get(pr.id) ?? 0)}
                </span>
                {pr.lockOrder && (
                  <span className="chip" title="Missions unlock in order">
                    <Icon name="lock" /> In order
                  </span>
                )}
                {dueChip(pr.targetDate, complete)}
              </div>
            </button>
          );
        })}
      </div>
      {editing && (
        <ProjectEditor
          p={p}
          pr={editing}
          isNew
          onClose={() => setEditing(null)}
          onSave={(pr) => {
            p.projects.push(pr);
            store.markDirty(p);
            setEditing(null);
            open(pr.id);
          }}
        />
      )}
    </div>
  );
}

function importStarter(p: Player) {
  const ch = (name: string, difficulty: Difficulty, est = 1, resources: [string, string][] = []) =>
    newChapter({ name, difficulty, estPomodoros: est, resources: resources.map(([label, url], i) => ({ id: `${Date.now()}${i}${name}`, label, url })) });
  const pr = newProject({
    name: 'Cybersecurity',
    goal: 'Ready for a junior security job',
    icon: 'shield',
    missions: [
      newMission({
        name: 'Networking',
        chapters: [
          ch('OSI model', 'easy', 1),
          ch('IP addresses', 'medium', 2),
          ch('TCP/UDP', 'medium', 2),
          ch('DNS', 'medium', 2),
        ],
      }),
      newMission({
        name: 'Linux basics',
        chapters: [ch('Files and navigation', 'easy', 1), ch('Users and permissions', 'medium', 2), ch('Processes and services', 'medium', 2), ch('Shell scripting', 'hard', 3)],
      }),
      newMission({
        name: 'Web security',
        chapters: [ch('How HTTP works', 'easy', 1), ch('OWASP Top 10', 'medium', 2), ch('SQL injection', 'hard', 3), ch('Cross-site scripting', 'hard', 3)],
      }),
    ],
  });
  p.projects.push(pr);
  store.markDirty(p);
  store.toast('Added the Cybersecurity starter path', 'level');
  store.go({ name: 'player', playerId: p.id, tab: 'projects', projectId: pr.id });
}

// ---------------------------------------------------------------- editors

function ProjectEditor({ p, pr, isNew, onClose, onSave }: { p: Player; pr: Project; isNew?: boolean; onClose: () => void; onSave: (pr: Project) => void }) {
  const [name, setName] = useState(pr.name);
  const [goal, setGoal] = useState(pr.goal);
  const [icon, setIcon] = useState<ProjectIcon>(pr.icon);
  const [target, setTarget] = useState(pr.targetDate);
  const [lock, setLock] = useState(pr.lockOrder);
  const [pomo, setPomo] = useState(pr.pomodoro);
  void p;
  return (
    <Modal onClose={onClose} wide>
      <h2>{isNew ? 'New project' : 'Edit project'}</h2>
      <p className="lead">A skill or subject to learn. Finishing every mission gives +{EXP.project} EXP and adds a building to your world.</p>
      <div className="col" style={{ gap: 14 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <Field label="Name">
            <input type="text" autoFocus value={name} maxLength={60} placeholder="e.g. Cybersecurity" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Target date (optional)">
            <DateField value={target} onChange={setTarget} />
          </Field>
        </div>
        <Field label="Short goal">
          <input type="text" value={goal} maxLength={120} placeholder="e.g. Ready for a junior security job" onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <Field label="Pixel icon">
          <IconPicker value={icon} onChange={setIcon} />
        </Field>
        <div className="row">
          <Toggle on={lock} onChange={setLock} label="Lock missions in order" />
          <span>Lock each mission until the one before it is done, like levels in a game</span>
        </div>
        <Field label="Pomodoro for this project">
          <PomodoroOverrideEditor value={pomo} onChange={setPomo} base={store.settings.pomodoro} />
        </Field>
      </div>
      <div className="actions">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          kind="primary"
          icon="check"
          disabled={!name.trim()}
          onClick={() => {
            Object.assign(pr, { name: name.trim(), goal: goal.trim(), icon, targetDate: target, lockOrder: lock, pomodoro: pomo });
            onSave(pr);
          }}
        >
          {isNew ? 'Create project' : 'Save'}
        </Btn>
      </div>
    </Modal>
  );
}

function MissionEditor({ m, pr, isNew, onClose, onSave }: { m: Mission; pr: Project; isNew?: boolean; onClose: () => void; onSave: (m: Mission, index: number) => void }) {
  const [name, setName] = useState(m.name);
  const [target, setTarget] = useState(m.targetDate);
  const [pomo, setPomo] = useState(m.pomodoro);
  const cur = pr.missions.indexOf(m);
  const [pos, setPos] = useState(cur >= 0 ? cur + 1 : pr.missions.length + 1);
  const max = isNew ? pr.missions.length + 1 : pr.missions.length;
  return (
    <Modal onClose={onClose}>
      <h2>{isNew ? 'New mission' : 'Edit mission'}</h2>
      <p className="lead">A topic inside {pr.name}. Finishing all its chapters gives +{EXP.mission} EXP.</p>
      <div className="col" style={{ gap: 14 }}>
        <Field label="Name">
          <input type="text" autoFocus value={name} maxLength={60} placeholder="e.g. Networking" onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Field label="Place in the project">
            <NumberField value={pos} min={1} max={max} onChange={setPos} />
          </Field>
          <Field label="Target date (optional)">
            <DateField value={target} onChange={setTarget} />
          </Field>
        </div>
        <Field label="Pomodoro for this mission">
          <PomodoroOverrideEditor value={pomo} onChange={setPomo} base={resolveConfig(store.settings.pomodoro, pr.pomodoro)} />
        </Field>
      </div>
      <div className="actions">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          kind="primary"
          icon="check"
          disabled={!name.trim()}
          onClick={() => {
            Object.assign(m, { name: name.trim(), targetDate: target, pomodoro: pomo });
            onSave(m, Math.max(0, Math.min(max - 1, pos - 1)));
          }}
        >
          Save
        </Btn>
      </div>
    </Modal>
  );
}

function ChapterEditor({ ch, pr, m, isNew, onClose, onSave }: { ch: Chapter; pr: Project; m: Mission; isNew?: boolean; onClose: () => void; onSave: (c: Chapter) => void }) {
  const [name, setName] = useState(ch.name);
  const [diff, setDiff] = useState<Difficulty>(ch.difficulty);
  const [res, setRes] = useState(ch.resources);
  const [est, setEst] = useState(ch.estPomodoros);
  const [pomo, setPomo] = useState(ch.pomodoro);
  return (
    <Modal onClose={onClose} wide>
      <h2>{isNew ? 'New chapter' : 'Edit chapter'}</h2>
      <p className="lead">One lesson in {m.name} that you can finish in one or a few Pomodoros.</p>
      <div className="col" style={{ gap: 14 }}>
        <Field label="Name">
          <input type="text" autoFocus value={name} maxLength={80} placeholder="e.g. TCP/UDP" onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
          <Field label="Difficulty (EXP when done)">
            <DifficultyPicker value={diff} onChange={setDiff} disabled={ch.state === 'done'} />
          </Field>
          <Field label="Estimated Pomodoros">
            <NumberField value={est} min={1} max={30} onChange={setEst} />
          </Field>
        </div>
        <Field label="Resources: videos, articles or book pages">
          <ResourcesEditor value={res} onChange={setRes} />
        </Field>
        <Field label="Pomodoro for this chapter">
          <PomodoroOverrideEditor value={pomo} onChange={setPomo} base={resolveConfig(store.settings.pomodoro, pr.pomodoro, m.pomodoro)} />
        </Field>
      </div>
      <div className="actions">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          kind="primary"
          icon="check"
          disabled={!name.trim()}
          onClick={() => {
            ch.name = name.trim();
            setChapterDifficulty(ch, diff);
            ch.resources = res;
            ch.estPomodoros = est;
            ch.pomodoro = pomo;
            onSave(ch);
          }}
        >
          Save
        </Btn>
      </div>
    </Modal>
  );
}

function NoteViewer({ p, ch, onClose }: { p: Player; ch: Chapter; onClose: () => void }) {
  const [text, setText] = useState(ch.note ?? '');
  return (
    <Modal onClose={onClose}>
      <h2>What I learned</h2>
      <p className="lead">
        {ch.name}
        {ch.noteAt ? ` · written ${prettyDay(new Date(ch.noteAt).toISOString().slice(0, 10))}` : ''}
      </p>
      <textarea className="note-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="A few sentences in your own words." rows={7} />
      <div className="actions">
        <Btn onClick={onClose}>Close</Btn>
        <Btn
          kind="primary"
          icon="check"
          onClick={() => {
            store.saveNote(p, ch.id, text);
            onClose();
          }}
        >
          Save note
        </Btn>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- detail

type Drag = { kind: 'mission'; id: string } | { kind: 'chapter'; id: string; missionId: string } | null;

function ProjectDetail({ p, pr }: { p: Player; pr: Project }) {
  const s = useStore();
  const focus = useMemo(() => focusByRef(p), [p, s.version]);
  const [editProject, setEditProject] = useState(false);
  const [editMission, setEditMission] = useState<{ m: Mission; isNew?: boolean } | null>(null);
  const [editChapter, setEditChapter] = useState<{ ch: Chapter; m: Mission; isNew?: boolean } | null>(null);
  const [note, setNote] = useState<Chapter | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const first = pr.missions.find((m) => !missionDone(m));
    return first ? { [first.id]: true } : {};
  });
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<string | null>(null);
  const total = pr.missions.length;
  const done = pr.missions.filter(missionDone).length;
  const complete = projectDone(pr);
  const back = () => store.go({ name: 'player', playerId: p.id, tab: 'projects' });
  const save = () => store.markDirty(p);

  const dropOnMission = (targetId: string) => {
    if (!drag) return;
    if (drag.kind === 'mission') {
      const from = pr.missions.findIndex((m) => m.id === drag.id);
      const to = pr.missions.findIndex((m) => m.id === targetId);
      moveItem(pr.missions, from, to);
    } else {
      const src = pr.missions.find((m) => m.id === drag.missionId)!;
      const dst = pr.missions.find((m) => m.id === targetId)!;
      const i = src.chapters.findIndex((c) => c.id === drag.id);
      const [c] = src.chapters.splice(i, 1);
      dst.chapters.push(c);
      setOpen({ ...open, [dst.id]: true });
    }
    setDrag(null);
    setOver(null);
    save();
  };
  const dropOnChapter = (m: Mission, targetId: string) => {
    if (!drag || drag.kind !== 'chapter') return;
    const src = pr.missions.find((x) => x.id === drag.missionId)!;
    const from = src.chapters.findIndex((c) => c.id === drag.id);
    if (src === m) moveItem(m.chapters, from, m.chapters.findIndex((c) => c.id === targetId));
    else {
      const [c] = src.chapters.splice(from, 1);
      m.chapters.splice(m.chapters.findIndex((c2) => c2.id === targetId), 0, c);
    }
    setDrag(null);
    setOver(null);
    save();
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="panel">
        <div className="row" style={{ gap: 14 }}>
          <Btn icon="back" small onClick={back} title="All projects" />
          <span className="slot" style={{ padding: 6, display: 'grid' }}>
            <Pix src={projectIconUrl(pr.icon)} scale={3} />
          </span>
          <div className="grow">
            <div className="row" style={{ gap: 8 }}>
              <h2 style={{ fontSize: 26 }} className="ellipsis">
                {pr.name}
              </h2>
              {complete && <span className="chip solid">Complete</span>}
            </div>
            <div className="muted">{pr.goal}</div>
          </div>
          <Btn small icon="edit" onClick={() => setEditProject(true)}>
            Edit
          </Btn>
          <Btn
            small
            icon="trash"
            kind="ghost"
            title="Delete project"
            onClick={() =>
              store.pushOverlay({
                kind: 'confirm',
                title: `Delete ${pr.name}?`,
                body: 'Its missions, chapters and notes are deleted. EXP you already earned and your focus history stay.',
                confirm: 'Delete project',
                danger: true,
                onConfirm: () => {
                  p.projects = p.projects.filter((x) => x.id !== pr.id);
                  save();
                  back();
                },
              })
            }
          />
        </div>
        <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
          <div className="grow" style={{ minWidth: 200 }}>
            <Bar value={done} max={Math.max(1, total)} />
          </div>
          <span className="chip">
            {done} / {total} missions
          </span>
          <span className="chip">
            <Icon name="clock" /> {pr.name}: {fmtMinutes(focus.project.get(pr.id) ?? 0)}
          </span>
          {dueChip(pr.targetDate, complete)}
          {complete && <span className="chip bright">{PROJECT_ICON[pr.icon]?.buildingName} built in your world</span>}
        </div>
      </div>

      <div className="mission-path">
        {pr.missions.map((m, i) => {
          const unlocked = missionUnlocked(pr, i);
          const mDone = missionDone(m);
          const cDone = m.chapters.filter((c) => c.state === 'done').length;
          const isOpen = open[m.id];
          return (
            <div
              key={m.id}
              className={`mission ${mDone ? 'done' : ''} ${!unlocked ? 'locked' : ''} ${over === m.id ? 'over' : ''}`}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOver(m.id);
              }}
              onDragLeave={() => setOver((o) => (o === m.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                dropOnMission(m.id);
              }}
            >
              <div className="mission-node pixel">{mDone ? <Icon name="check" /> : !unlocked ? <Icon name="lock" /> : i + 1}</div>
              <div className="panel mission-card">
                <div className="row" style={{ gap: 10 }}>
                  <span
                    className="drag-handle"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', m.id);
                      setDrag({ kind: 'mission', id: m.id });
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    title="Drag to reorder"
                  >
                    <Icon name="drag" />
                  </span>
                  <button className="mission-title grow" onClick={() => setOpen({ ...open, [m.id]: !isOpen })}>
                    <span className="pixel" style={{ fontSize: 19 }}>
                      {m.name}
                    </span>
                    <Icon name={isOpen ? 'up' : 'down'} />
                  </button>
                  <span className="chip">
                    {cDone} / {m.chapters.length}
                  </span>
                  <span className="chip" title={`Focus time on ${m.name}`}>
                    <Icon name="clock" /> {fmtMinutes(focus.mission.get(m.id) ?? 0)}
                  </span>
                  {dueChip(m.targetDate, mDone)}
                  <Btn small icon="edit" kind="ghost" onClick={() => setEditMission({ m })} title="Edit mission" />
                  <Btn
                    small
                    icon="trash"
                    kind="ghost"
                    title="Delete mission"
                    onClick={() =>
                      store.pushOverlay({
                        kind: 'confirm',
                        title: `Delete ${m.name}?`,
                        body: `Its ${m.chapters.length} chapters and their notes are deleted. Earned EXP stays.`,
                        confirm: 'Delete mission',
                        danger: true,
                        onConfirm: () => {
                          pr.missions = pr.missions.filter((x) => x.id !== m.id);
                          save();
                        },
                      })
                    }
                  />
                </div>
                <Bar value={cDone} max={Math.max(1, m.chapters.length)} thin />
                {!unlocked && <div className="dim" style={{ fontSize: 13 }}>Locked until "{pr.missions[i - 1]?.name}" is done.</div>}
                {isOpen && (
                  <div className="chapters">
                    {m.chapters.length === 0 && <div className="dim" style={{ padding: '6px 2px' }}>No chapters yet. Add the lessons for this topic.</div>}
                    {m.chapters.map((ch) => (
                      <ChapterRow
                        key={ch.id}
                        p={p}
                        pr={pr}
                        m={m}
                        ch={ch}
                        locked={!unlocked}
                        minutes={focus.chapter.get(ch.id) ?? 0}
                        dragging={drag?.kind === 'chapter' && drag.id === ch.id}
                        over={over === ch.id}
                        onDragStart={() => setDrag({ kind: 'chapter', id: ch.id, missionId: m.id })}
                        onDragEnd={() => {
                          setDrag(null);
                          setOver(null);
                        }}
                        onDragOver={() => setOver(ch.id)}
                        onDrop={() => dropOnChapter(m, ch.id)}
                        onEdit={() => setEditChapter({ ch, m })}
                        onNote={() => setNote(ch)}
                      />
                    ))}
                    <div className="row" style={{ marginTop: 6 }}>
                      <Btn small icon="plus" onClick={() => setEditChapter({ ch: newChapter({ name: '' }), m, isNew: true })}>
                        Add chapter
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="mission add">
          <div className="mission-node pixel">+</div>
          <Btn icon="plus" onClick={() => setEditMission({ m: newMission({ name: '' }), isNew: true })}>
            Add mission
          </Btn>
        </div>
      </div>

      {editProject && (
        <ProjectEditor
          p={p}
          pr={pr}
          onClose={() => setEditProject(false)}
          onSave={() => {
            save();
            setEditProject(false);
          }}
        />
      )}
      {editMission && (
        <MissionEditor
          m={editMission.m}
          pr={pr}
          isNew={editMission.isNew}
          onClose={() => setEditMission(null)}
          onSave={(m, index) => {
            const cur = pr.missions.indexOf(m);
            if (cur >= 0) moveItem(pr.missions, cur, index);
            else {
              pr.missions.splice(index, 0, m);
              setOpen({ ...open, [m.id]: true });
            }
            save();
            setEditMission(null);
          }}
        />
      )}
      {editChapter && (
        <ChapterEditor
          ch={editChapter.ch}
          pr={pr}
          m={editChapter.m}
          isNew={editChapter.isNew}
          onClose={() => setEditChapter(null)}
          onSave={(c) => {
            if (!editChapter.m.chapters.includes(c)) editChapter.m.chapters.push(c);
            save();
            setEditChapter(null);
          }}
        />
      )}
      {note && <NoteViewer p={p} ch={note} onClose={() => setNote(null)} />}
    </div>
  );
}

function ChapterRow(props: {
  p: Player;
  pr: Project;
  m: Mission;
  ch: Chapter;
  locked: boolean;
  minutes: number;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onEdit: () => void;
  onNote: () => void;
}) {
  const { p, pr, m, ch, locked, minutes } = props;
  const [expand, setExpand] = useState(false);
  const done = ch.state === 'done';
  const timer = store.timer;
  const running = timer?.target.id === ch.id;
  const cfg = resolveConfig(store.settings.pomodoro, pr.pomodoro, m.pomodoro, ch.pomodoro);
  return (
    <div
      className={`chapter ${done ? 'done' : ''} ${props.dragging ? 'dragging' : ''} ${props.over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onDrop();
      }}
    >
      <div className="row" style={{ gap: 8 }}>
        <span className="drag-handle" draggable onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', ch.id);
          props.onDragStart();
        }} onDragEnd={props.onDragEnd} title="Drag to reorder">
          <Icon name="drag" />
        </span>
        <button
          className={`check ${done ? 'on' : ''}`}
          disabled={locked && !done}
          title={done ? 'Untick (takes the EXP back)' : locked ? 'This mission is locked' : 'Mark as done'}
          onClick={() => {
            if (done)
              store.pushOverlay({
                kind: 'confirm',
                title: 'Untick this chapter?',
                body: `"${ch.name}" goes back to In progress and its EXP is taken back. Your note stays.`,
                confirm: 'Untick',
                onConfirm: () => store.untickChapter(p, ch.id),
              });
            else store.completeChapter(p, ch.id);
          }}
        >
          {done && <Icon name="check" shift={-4} />}
        </button>
        <button className="chapter-name grow" onClick={() => setExpand(!expand)}>
          <span className={`ellipsis ${done ? 'muted' : ''}`}>{ch.name}</span>
        </button>
        <span className="chip" title={`${DIFF_LABEL[ch.difficulty]}: ${DIFF_EXP[ch.difficulty]} EXP when done`}>
          {DIFF_LABEL[ch.difficulty]} · {DIFF_EXP[ch.difficulty]}
        </span>
        <span className={`chip state-${ch.state}`}>{ch.state === 'todo' ? 'To do' : ch.state === 'progress' ? 'In progress' : 'Done'}</span>
        <span className="chip" title={`Estimated ${ch.estPomodoros} Pomodoro${ch.estPomodoros > 1 ? 's' : ''} of ${cfg.work} min · focused ${fmtMinutes(minutes)}`}>
          <Icon name="clock" /> {fmtMinutes(minutes)} / {ch.estPomodoros}×{cfg.work}
        </span>
        {ch.resources.length > 0 && (
          <span className="chip" title="Resources">
            <Icon name="link" /> {ch.resources.length}
          </span>
        )}
        {ch.note && (
          <Btn small icon="note" kind="ghost" onClick={props.onNote} title="What I learned" />
        )}
        <Btn
          small
          kind={done ? 'default' : 'primary'}
          icon={running ? 'clock' : 'play'}
          disabled={locked || (!!timer && !running)}
          title={timer && !running ? 'Another Pomodoro is running' : 'Start a Pomodoro on this chapter'}
          onClick={() => (running ? store.go({ name: 'focus' }) : store.startPomodoro(p, { kind: 'chapter', id: ch.id, label: ch.name, projectId: pr.id, missionId: m.id }))}
        >
          {running ? 'Running' : 'Start Pomodoro'}
        </Btn>
      </div>
      {expand && (
        <div className="chapter-more">
          {ch.resources.length > 0 ? (
            <div className="col" style={{ gap: 4 }}>
              {ch.resources.map((r) => (
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
          ) : (
            <span className="dim">No resources. Edit the chapter to add videos, articles or book pages.</span>
          )}
          {ch.note ? (
            <div className="note-preview" onClick={props.onNote}>
              <span className="pixel muted">What I learned</span>
              <p>{ch.note}</p>
            </div>
          ) : done ? (
            <Btn small icon="note" onClick={props.onNote}>
              Write "What I learned" (+{EXP.note} EXP)
            </Btn>
          ) : null}
          <div className="row" style={{ gap: 6 }}>
            <Btn small icon="edit" onClick={props.onEdit}>
              Edit chapter
            </Btn>
            <Btn
              small
              icon="trash"
              kind="ghost"
              onClick={() =>
                store.pushOverlay({
                  kind: 'confirm',
                  title: `Delete "${ch.name}"?`,
                  body: 'The chapter and its note are deleted. EXP you earned stays.',
                  confirm: 'Delete chapter',
                  danger: true,
                  onConfirm: () => {
                    m.chapters = m.chapters.filter((c) => c.id !== ch.id);
                    store.markDirty(p);
                  },
                })
              }
            >
              Delete
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
