import { useState } from 'react';
import { projectIconUrl } from '../../art/icons';
import { dayKey, diffDays, prettyDay } from '../../core/dates';
import { newSideQuest } from '../../core/game';
import { DIFF_EXP, DIFF_LABEL } from '../../core/ranks';
import type { Difficulty, Player, SideQuest } from '../../core/types';
import { store, useStore } from '../../store';
import { DateField, DifficultyPicker, Modal } from '../forms';
import { Btn, Field, Icon, Panel, Pix } from '../kit';

function sortQuests(a: SideQuest, b: SideQuest) {
  if (!!a.doneAt !== !!b.doneAt) return a.doneAt ? 1 : -1;
  if (a.doneAt && b.doneAt) return b.doneAt - a.doneAt;
  if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.createdAt - b.createdAt;
}

export function Quests({ p }: { p: Player }) {
  const s = useStore();
  const [name, setName] = useState('');
  const [diff, setDiff] = useState<Difficulty>('easy');
  const [projectId, setProjectId] = useState('');
  const [due, setDue] = useState<string | undefined>();
  const [edit, setEdit] = useState<SideQuest | null>(null);
  const [showDone, setShowDone] = useState(false);
  const today = s.today();
  const list = [...p.sideQuests].sort(sortQuests);
  const open = list.filter((q) => !q.doneAt);
  const done = list.filter((q) => q.doneAt);
  const add = () => {
    if (!name.trim()) return;
    p.sideQuests.push(newSideQuest({ name: name.trim(), difficulty: diff, projectId: projectId || undefined, dueDate: due }));
    store.markDirty(p);
    setName('');
    setDue(undefined);
  };
  const row = (q: SideQuest) => {
    const pr = p.projects.find((x) => x.id === q.projectId);
    const left = q.dueDate ? diffDays(today, q.dueDate) : null;
    const overdue = left !== null && left < 0 && !q.doneAt;
    const running = s.timer?.target.id === q.id;
    return (
      <div key={q.id} className={`chapter quest ${q.doneAt ? 'done' : ''}`}>
        <div className="row" style={{ gap: 8 }}>
          <button
            className={`check ${q.doneAt ? 'on' : ''}`}
            title={q.doneAt ? 'Untick (takes the EXP back)' : 'Mark as done'}
            onClick={() => (q.doneAt ? store.untickSideQuest(p, q.id) : store.completeSideQuest(p, q.id))}
          >
            {q.doneAt && <Icon name="check" shift={-4} />}
          </button>
          <span className={`grow ellipsis ${q.doneAt ? 'muted' : ''}`}>{q.name}</span>
          {overdue && (
            <span className="chip bright" title="Overdue. No EXP is taken away.">
              <Icon name="warn" /> Overdue
            </span>
          )}
          <span className="chip">
            {DIFF_LABEL[q.difficulty]} · {DIFF_EXP[q.difficulty]}
          </span>
          {pr && (
            <span className="chip" title={`Linked to ${pr.name}`}>
              <Pix src={projectIconUrl(pr.icon)} scale={1} /> {pr.name}
            </span>
          )}
          {q.dueDate && !q.doneAt && (
            <span className="chip" title={prettyDay(q.dueDate)}>
              <Icon name="calendar" /> {left === 0 ? 'Today' : left! > 0 ? `${left}d` : prettyDay(q.dueDate).slice(4)}
            </span>
          )}
          {q.doneAt && <span className="dim" style={{ fontSize: 12 }}>{prettyDay(dayKey(q.doneAt, s.settings.dayStartMinutes))}</span>}
          {!q.doneAt && (
            <Btn
              small
              kind="primary"
              icon={running ? 'clock' : 'play'}
              disabled={!!s.timer && !running}
              onClick={() => (running ? store.go({ name: 'focus' }) : store.startPomodoro(p, { kind: 'sidequest', id: q.id, label: q.name, projectId: q.projectId }))}
            >
              {running ? 'Running' : 'Start Pomodoro'}
            </Btn>
          )}
          <Btn small icon="edit" kind="ghost" onClick={() => setEdit(q)} title="Edit" />
          <Btn
            small
            icon="trash"
            kind="ghost"
            title="Delete"
            onClick={() => {
              p.sideQuests = p.sideQuests.filter((x) => x.id !== q.id);
              store.markDirty(p);
            }}
          />
        </div>
      </div>
    );
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel title="New side quest">
        <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
          <Field label="Small one-time task">
            <input type="text" value={name} maxLength={80} placeholder="e.g. Install Wireshark" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ minWidth: 260 }} />
          </Field>
          <Field label="Difficulty">
            <DifficultyPicker value={diff} onChange={setDiff} />
          </Field>
          <Field label="Project (optional)">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: 180 }}>
              <option value="">None</option>
              {p.projects.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date (optional)">
            <DateField value={due} onChange={setDue} />
          </Field>
          <Btn kind="primary" icon="plus" disabled={!name.trim()} onClick={add}>
            Add
          </Btn>
        </div>
      </Panel>
      <Panel title={`Side quests · ${open.length} open`}>
        {open.length === 0 ? <div className="dim">Nothing waiting. Side quests are small tasks such as "Install Wireshark" or "Set up a lab VM".</div> : <div className="col" style={{ gap: 6 }}>{open.map(row)}</div>}
        {done.length > 0 && (
          <>
            <div className="hr" />
            <button className="linkbtn" onClick={() => setShowDone(!showDone)}>
              {showDone ? 'Hide' : 'Show'} {done.length} finished
            </button>
            {showDone && <div className="col" style={{ gap: 6, marginTop: 8 }}>{done.map(row)}</div>}
          </>
        )}
      </Panel>
      {edit && <QuestEditor p={p} q={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function QuestEditor({ p, q, onClose }: { p: Player; q: SideQuest; onClose: () => void }) {
  const [name, setName] = useState(q.name);
  const [diff, setDiff] = useState(q.difficulty);
  const [projectId, setProjectId] = useState(q.projectId ?? '');
  const [due, setDue] = useState(q.dueDate);
  return (
    <Modal onClose={onClose}>
      <h2>Edit side quest</h2>
      <div className="col" style={{ gap: 14, marginTop: 10 }}>
        <Field label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Difficulty">
          <DifficultyPicker value={diff} onChange={setDiff} disabled={!!q.doneAt} />
        </Field>
        <Field label="Project">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {p.projects.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <DateField value={due} onChange={setDue} />
        </Field>
      </div>
      <div className="actions">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          kind="primary"
          icon="check"
          disabled={!name.trim()}
          onClick={() => {
            q.name = name.trim();
            if (!q.doneAt) q.difficulty = diff;
            q.projectId = projectId || undefined;
            q.dueDate = due;
            store.markDirty(p);
            onClose();
          }}
        >
          Save
        </Btn>
      </div>
    </Modal>
  );
}
