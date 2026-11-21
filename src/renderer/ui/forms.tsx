import { type ReactNode, useState } from 'react';
import { projectIconUrl } from '../art/icons';
import { BUILT_IN_PRESETS, POMODORO_LIMITS, PROJECT_ICONS } from '../core/catalog';
import { DIFF_EXP, DIFF_LABEL } from '../core/ranks';
import type { Difficulty, PomodoroConfig, PomodoroOverride, ProjectIcon, Resource } from '../core/types';
import { isValidUrl, uid } from '../core/util';
import { store } from '../store';
import { Btn, Card, Field, Icon, NumberField, Pix, Seg, Toggle } from './kit';

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Card onClose={onClose} wide={wide} style={{ textAlign: 'left' }}>
        {children}
      </Card>
    </div>
  );
}

export function DifficultyPicker({ value, onChange, disabled }: { value: Difficulty; onChange: (d: Difficulty) => void; disabled?: boolean }) {
  if (disabled)
    return (
      <span className="chip" title="Difficulty can't be changed after the chapter is finished">
        <Icon name="lock" /> {DIFF_LABEL[value]} · {DIFF_EXP[value]} EXP
      </span>
    );
  return (
    <Seg
      value={value}
      onChange={onChange}
      options={(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => ({ v: d, label: `${DIFF_LABEL[d]} ${DIFF_EXP[d]}` }))}
    />
  );
}

export function IconPicker({ value, onChange }: { value: ProjectIcon; onChange: (i: ProjectIcon) => void }) {
  return (
    <div className="icon-picker">
      {PROJECT_ICONS.map((i) => (
        <button key={i.id} type="button" className={`slot pick ${value === i.id ? 'on' : ''}`} onClick={() => onChange(i.id)} title={`${i.label} · finished project builds a ${i.buildingName.toLowerCase()}`}>
          <Pix src={projectIconUrl(i.id, value === i.id ? 0 : -1)} scale={3} />
          <span>{i.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Optional Pomodoro override for a project, mission or chapter */
export function PomodoroOverrideEditor({ value, onChange, base }: { value: PomodoroOverride | undefined; onChange: (v: PomodoroOverride | undefined) => void; base: PomodoroConfig }) {
  const on = !!value && Object.keys(value).length > 0;
  const cur: PomodoroConfig = { ...base, ...(value ?? {}) };
  const set = (patch: Partial<PomodoroConfig>) => onChange({ ...(value ?? {}), work: cur.work, short: cur.short, long: cur.long, sessions: cur.sessions, ...patch });
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row">
        <Toggle on={on} onChange={(v) => onChange(v ? { work: base.work, short: base.short, long: base.long, sessions: base.sessions } : undefined)} label="Custom Pomodoro" />
        <span className="muted">{on ? 'Custom times' : `Uses the default (${base.work}/${base.short}/${base.long}, ${base.sessions} sessions)`}</span>
      </div>
      {on && (
        <>
          <div className="row wrap" style={{ gap: 6 }}>
            {[...BUILT_IN_PRESETS, ...store.settings.presets].map((p) => (
              <Btn key={p.id} small kind={cur.work === p.work && cur.short === p.short && cur.long === p.long ? 'primary' : 'default'} onClick={() => set({ work: p.work, short: p.short, long: p.long, sessions: p.sessions ?? cur.sessions })}>
                {p.name} {p.work}/{p.short}/{p.long}
              </Btn>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 12 }}>
            <Field label="Work (min)">
              <NumberField value={cur.work} min={POMODORO_LIMITS.work[0]} max={POMODORO_LIMITS.work[1]} onChange={(v) => set({ work: v })} />
            </Field>
            <Field label="Short break">
              <NumberField value={cur.short} min={POMODORO_LIMITS.short[0]} max={POMODORO_LIMITS.short[1]} onChange={(v) => set({ short: v })} />
            </Field>
            <Field label="Long break">
              <NumberField value={cur.long} min={POMODORO_LIMITS.long[0]} max={POMODORO_LIMITS.long[1]} onChange={(v) => set({ long: v })} />
            </Field>
            <Field label="Sessions">
              <NumberField value={cur.sessions} min={POMODORO_LIMITS.sessions[0]} max={POMODORO_LIMITS.sessions[1]} onChange={(v) => set({ sessions: v })} />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

export function ResourcesEditor({ value, onChange }: { value: Resource[]; onChange: (r: Resource[]) => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const add = () => {
    const u = url.trim();
    if (!u && !label.trim()) return;
    const full = u && !/^[a-z]+:/i.test(u) && u.includes('.') ? `https://${u}` : u;
    onChange([...value, { id: uid('r'), label: label.trim() || full, url: full }]);
    setLabel('');
    setUrl('');
  };
  return (
    <div className="col" style={{ gap: 6 }}>
      {value.map((r) => (
        <div key={r.id} className="row slot" style={{ padding: '4px 8px' }}>
          <Icon name={r.url && isValidUrl(r.url) ? 'link' : 'book'} />
          <span className="grow ellipsis">
            {r.label}
            {r.url && r.url !== r.label && <span className="dim"> · {r.url}</span>}
          </span>
          <Btn small icon="trash" kind="ghost" onClick={() => onChange(value.filter((x) => x.id !== r.id))} title="Remove" />
        </div>
      ))}
      <div className="row">
        <input type="text" placeholder="Label (video, article, book pages 40-62)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input type="url" placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Btn small icon="plus" onClick={add} title="Add resource" />
      </div>
    </div>
  );
}

export function DateField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="row">
      <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} style={{ width: 170 }} />
      {value && <Btn small kind="ghost" icon="close" onClick={() => onChange(undefined)} title="Clear date" />}
    </div>
  );
}
