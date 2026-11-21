import { useState } from 'react';
import { BUILT_IN_PRESETS, POMODORO_LIMITS } from '../../core/catalog';
import { setLength } from '../../core/timer';
import type { SoundId } from '../../core/types';
import { fmtMinutes, uid } from '../../core/util';
import { isElectron, platform } from '../../platform';
import { play } from '../../sound';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Btn, Field, Icon, NumberField, Panel, SceneView, Toggle } from '../kit';
import { ScreenHeader } from './Players';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="dim" style={{ fontSize: 12 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

const SOUNDS: { id: SoundId; label: string }[] = [
  { id: 'bell', label: 'Low bell' },
  { id: 'chime', label: 'Chime' },
  { id: 'gong', label: 'Gong' },
  { id: 'crow', label: 'Crow call' },
  { id: 'wood', label: 'Wood block' },
];

export function SettingsScreen() {
  const s = useStore();
  const st = s.settings;
  const pc = st.pomodoro;
  const [presetName, setPresetName] = useState('');
  const [resetId, setResetId] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const setPomo = (patch: Partial<typeof pc>) => store.updateSettings({ pomodoro: { ...pc, ...patch } });
  const presets = [...BUILT_IN_PRESETS, ...st.presets];
  return (
    <div className="screen">
      <SceneView className="bg-scene dimmed" state={sceneFor(undefined, { targetHeight: 190 })} />
      <div className="screen-inner" style={{ position: 'relative', maxWidth: 900 }}>
        <ScreenHeader title="Settings" back={() => s.go({ name: 'home' })} />
        <div className="col" style={{ gap: 14 }}>
          <Panel title="Appearance">
            <Row label="Animations" hint="Twinkling stars, moving grass, the crow. Turn off for slower PCs.">
              <Toggle on={st.animations} onChange={(v) => store.updateSettings({ animations: v })} label="Animations" />
            </Row>
            <Row label="Language" hint="More languages later.">
              <select value="en" disabled style={{ width: 160 }}>
                <option value="en">English</option>
              </select>
            </Row>
          </Panel>

          <Panel title="Sound">
            <Row label="Sounds on" hint="Crow call for cards, low bell at the end of a step.">
              <Toggle on={st.soundsOn} onChange={(v) => store.updateSettings({ soundsOn: v })} label="Sounds" />
            </Row>
            <Row label="Timer sound">
              <div className="row">
                <select value={st.timerSound} onChange={(e) => store.updateSettings({ timerSound: e.target.value as SoundId })} style={{ width: 160 }}>
                  {SOUNDS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <Btn small icon="sound" onClick={() => play(st.timerSound)}>
                  Test
                </Btn>
              </div>
            </Row>
            <Row label={`Volume ${st.volume}%`}>
              <input type="range" min={0} max={100} value={st.volume} onChange={(e) => store.updateSettings({ volume: Number(e.target.value) })} />
            </Row>
            <Row label="Night ambience" hint="Soft crickets in the background.">
              <Toggle on={st.ambience} onChange={(v) => store.updateSettings({ ambience: v })} label="Night ambience" />
            </Row>
          </Panel>

          <Panel title="Notifications">
            <Row label="System notifications" hint='At the end of every work session and break, with "Start", "Skip" and "+5 min" buttons.'>
              <Toggle on={st.systemNotifications} onChange={(v) => store.updateSettings({ systemNotifications: v })} label="System notifications" />
            </Row>
            <Row label="Pop up the app when a step ends" hint="Brings Arrazi to the front, even when Focus Assist hides notifications.">
              <Toggle on={st.popUp} onChange={(v) => store.updateSettings({ popUp: v })} label="Pop up" />
            </Row>
            <Row label="Mini timer" hint="A small window that stays on top of other apps while a Pomodoro runs.">
              <Toggle on={st.miniTimer} onChange={(v) => store.updateSettings({ miniTimer: v })} label="Mini timer" />
            </Row>
          </Panel>

          <Panel title="Pomodoro defaults">
            <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
              {presets.map((p) => {
                const on = pc.work === p.work && pc.short === p.short && pc.long === p.long && (p.sessions ?? pc.sessions) === pc.sessions;
                return (
                  <span key={p.id} className="row" style={{ gap: 2 }}>
                    <Btn small kind={on ? 'primary' : 'default'} onClick={() => setPomo({ work: p.work, short: p.short, long: p.long, sessions: p.sessions ?? pc.sessions })}>
                      {p.name} {p.work}/{p.short}/{p.long}
                    </Btn>
                    {!p.builtIn && (
                      <Btn small kind="ghost" icon="close" title="Delete preset" onClick={() => store.updateSettings({ presets: st.presets.filter((x) => x.id !== p.id) })} />
                    )}
                  </span>
                );
              })}
            </div>
            <div className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
              <Field label="Work session (min)">
                <NumberField value={pc.work} min={POMODORO_LIMITS.work[0]} max={POMODORO_LIMITS.work[1]} onChange={(v) => setPomo({ work: v })} />
              </Field>
              <Field label="Short break">
                <NumberField value={pc.short} min={POMODORO_LIMITS.short[0]} max={POMODORO_LIMITS.short[1]} onChange={(v) => setPomo({ short: v })} />
              </Field>
              <Field label="Long break">
                <NumberField value={pc.long} min={POMODORO_LIMITS.long[0]} max={POMODORO_LIMITS.long[1]} onChange={(v) => setPomo({ long: v })} />
              </Field>
              <Field label="Sessions before long break">
                <NumberField value={pc.sessions} min={POMODORO_LIMITS.sessions[0]} max={POMODORO_LIMITS.sessions[1]} onChange={(v) => setPomo({ sessions: v })} />
              </Field>
            </div>
            <div className="dim" style={{ fontSize: 12, margin: '8px 0' }}>
              One full set lasts {fmtMinutes(setLength(pc))}, sends {pc.sessions * 2} notifications and earns {pc.work * pc.sessions + 20} EXP. Each project, mission or chapter can override these.
            </div>
            <Row label="Auto-start the next step">
              <Toggle on={pc.autoStart} onChange={(v) => setPomo({ autoStart: v })} label="Auto-start" />
            </Row>
            <div className="row" style={{ marginTop: 10 }}>
              <input type="text" placeholder="Preset name" value={presetName} maxLength={20} onChange={(e) => setPresetName(e.target.value)} style={{ width: 200 }} />
              <Btn
                small
                icon="plus"
                disabled={!presetName.trim()}
                onClick={() => {
                  store.updateSettings({ presets: [...st.presets, { id: uid('pre'), name: presetName.trim(), work: pc.work, short: pc.short, long: pc.long, sessions: pc.sessions }] });
                  setPresetName('');
                }}
              >
                Save my own preset
              </Btn>
            </div>
          </Panel>

          <Panel title="Day and game">
            <Row label="New day starts at" hint="Move it later (for example 4:00) if you study past midnight.">
              <select value={st.dayStartMinutes} onChange={(e) => store.updateSettings({ dayStartMinutes: Number(e.target.value) })} style={{ width: 160 }}>
                {[0, 60, 120, 180, 240, 300, 360].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? 'Midnight' : `${m / 60}:00`}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Weekly boss HP" hint="The weekly focus goal in minutes. Every focused minute deals 1 damage.">
              <NumberField value={st.weeklyBossHp} min={60} max={6000} onChange={(v) => store.updateSettings({ weeklyBossHp: v })} />
            </Row>
            <Row label="Ranked mode" hint="Harder: the monthly drop is 6 tiers instead of 3.">
              <Toggle on={st.rankedMode} onChange={(v) => store.updateSettings({ rankedMode: v })} label="Ranked mode" />
            </Row>
          </Panel>

          <Panel title="Startup">
            <Row label="Start with Windows" hint={isElectron ? undefined : 'Available in the desktop app.'}>
              <Toggle on={st.startWithWindows} onChange={(v) => store.updateSettings({ startWithWindows: v })} label="Start with Windows" />
            </Row>
            <Row label="Minimize to the system tray" hint="The tray icon shows the current step and the time left.">
              <Toggle on={st.minimizeToTray} onChange={(v) => store.updateSettings({ minimizeToTray: v })} label="Minimize to tray" />
            </Row>
          </Panel>

          <Panel title="Players">
            {s.players.length === 0 && <div className="dim">No players yet.</div>}
            {s.players.map((p) => (
              <Row key={p.id} label={p.name} hint={p.pinHash ? 'Protected by a 4-digit PIN' : 'No PIN'}>
                <div className="row">
                  <Btn
                    small
                    icon="lock"
                    onClick={() => {
                      const change = () => store.pushOverlay({ kind: 'pin', playerId: p.id, purpose: 'change' });
                      if (p.pinHash && !store.unlocked.has(p.id)) store.pushOverlay({ kind: 'pin', playerId: p.id, purpose: 'open', then: change });
                      else change();
                    }}
                  >
                    {p.pinHash ? 'Change PIN' : 'Set PIN'}
                  </Btn>
                  {p.pinHash && (
                    <Btn
                      small
                      kind="ghost"
                      onClick={() => {
                        const remove = () => void store.setPin(p.id, null).then(() => store.toast(`PIN removed for ${p.name}`));
                        if (!store.unlocked.has(p.id)) store.pushOverlay({ kind: 'pin', playerId: p.id, purpose: 'open', then: remove });
                        else remove();
                      }}
                    >
                      Remove PIN
                    </Btn>
                  )}
                </div>
              </Row>
            ))}
          </Panel>

          <Panel title="Data">
            <Row label="Backup" hint={`Saved automatically after every change${s.dataDir ? ` in ${s.dataDir}` : ''}.`}>
              <div className="row">
                <Btn small icon="down" onClick={() => void store.exportBackup()} disabled={!s.players.length}>
                  Export all players
                </Btn>
                <Btn small icon="up" onClick={() => void store.importBackup().then(setImportError)}>
                  Import a backup
                </Btn>
              </div>
            </Row>
            {importError && <div className="chip bright">{importError}</div>}
            <Row label="Reset a player" hint="Clears one player's progress after a typed confirmation.">
              <div className="row">
                <select value={resetId} onChange={(e) => setResetId(e.target.value)} style={{ width: 160 }}>
                  <option value="">Choose…</option>
                  {s.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Btn
                  small
                  icon="trash"
                  disabled={!resetId}
                  onClick={() => {
                    const p = store.player(resetId);
                    if (!p) return;
                    const ask = () =>
                      store.pushOverlay({
                        kind: 'confirm',
                        title: `Reset ${p.name}?`,
                        body: 'All projects, EXP, coins, items and stats are cleared. The name, body and PIN stay.',
                        confirm: 'Reset player',
                        danger: true,
                        typeToConfirm: p.name,
                        onConfirm: () => {
                          store.resetPlayer(p.id);
                          setResetId('');
                        },
                      });
                    if (p.pinHash && !store.unlocked.has(p.id)) store.pushOverlay({ kind: 'pin', playerId: p.id, purpose: 'open', then: ask });
                    else ask();
                  }}
                >
                  Reset
                </Btn>
              </div>
            </Row>
          </Panel>

          <Panel title="About">
            <div className="row" style={{ gap: 12 }}>
              <Icon name="star" scale={3} />
              <div>
                <div className="pixel" style={{ fontSize: 18 }}>
                  Arrazi {platform.version}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Learn new skills, played like a game. All pixel art, sounds and characters are original and made for Arrazi. Pixel fonts: Tiny5 and Jersey 10 (SIL Open Font License).
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
