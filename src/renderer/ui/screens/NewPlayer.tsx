import { useState } from 'react';
import { FREE_HAIRSTYLES, ITEM } from '../../core/catalog';
import { defaultLook } from '../../core/game';
import type { Look } from '../../core/types';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Btn, CharacterView, Field, Panel, SceneView, Seg } from '../kit';
import { ScreenHeader } from './Players';

export function NewPlayer() {
  const s = useStore();
  const [name, setName] = useState('');
  const [look, setLook] = useState<Look>(defaultLook('boy'));
  const taken = s.players.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 0 && !taken;
  const create = () => {
    if (!valid) return;
    const p = store.createPlayer(name.trim().slice(0, 24), look);
    store.toast(`Welcome, ${p.name}! Add your first project to start.`, 'level');
    store.openPlayer(p.id, 'projects');
  };
  return (
    <div className="screen">
      <SceneView className="bg-scene dimmed" state={sceneFor(undefined, { targetHeight: 190 })} />
      <div className="screen-inner" style={{ position: 'relative', maxWidth: 860 }}>
        <ScreenHeader title="New player" back={() => s.go({ name: 'players' })} />
        <div className="newplayer">
          <Panel title="1. Name">
            <Field label="Player name" hint={taken ? 'Another player already uses this name.' : 'Shown on the leaderboard.'}>
              <input
                type="text"
                autoFocus
                maxLength={24}
                value={name}
                placeholder="e.g. Yassine"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </Field>
            <div className="hr" />
            <h3 className="panel-title">2. Build your character</h3>
            <div className="col" style={{ gap: 14 }}>
              <Field label="Body">
                <Seg
                  value={look.body}
                  options={[
                    { v: 'boy', label: 'Boy' },
                    { v: 'girl', label: 'Girl' },
                  ]}
                  onChange={(body) => setLook({ ...look, body })}
                />
              </Field>
              <Field label="Hairstyle" hint="3 free styles. More styles and hair shades are in the shop.">
                <div className="row wrap">
                  {FREE_HAIRSTYLES.map((h) => (
                    <button key={h} className={`slot pick ${look.hair === h ? 'on' : ''}`} onClick={() => setLook({ ...look, hair: h })} title={ITEM[h].name}>
                      <CharacterView look={{ ...look, hair: h }} scale={2} pose="stand" />
                      <span className="pixel">{ITEM[h].name}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                You start with the wanderer outfit and a plain night background. Earn coins by ranking up and spend them on new clothes.
              </p>
            </div>
          </Panel>
          <Panel title="Preview" className="center">
            <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0 12px' }}>
              <CharacterView look={look} scale={7} />
            </div>
            <Btn kind="primary" icon="check" disabled={!valid} onClick={create} style={{ width: '100%' }}>
              Create player
            </Btn>
          </Panel>
        </div>
      </div>
    </div>
  );
}
