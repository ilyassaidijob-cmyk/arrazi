import type { BuildingSpec } from '../art/buildings';
import type { Mood, SceneState } from '../art/scene';
import { ITEM, MOONS, PROJECT_ICON, SET_ANIMATION, SET_PIECES } from '../core/catalog';
import { monthIndex, monthOf } from '../core/dates';
import { isBloodMoon, isSleepy, missionDone, projectDone } from '../core/game';
import { expProgress } from '../core/ranks';
import type { Player } from '../core/types';
import { store } from '../store';

export function buildingsFor(p: Player): BuildingSpec[] {
  return p.projects
    .map((pr) => {
      const total = pr.missions.length;
      const done = pr.missions.filter(missionDone).length;
      return {
        type: PROJECT_ICON[pr.icon]?.building ?? 'workshop',
        progress: total ? done / total : 0,
        done: projectDone(pr),
        label: pr.name,
      };
    })
    .filter((b) => b.done || b.progress > 0);
}

export function setAnimFor(p: Player): 'lift' | 'guitar' | 'type' | null {
  for (const [setId, anim] of Object.entries(SET_ANIMATION)) {
    if (!p.owned.includes(setId)) continue;
    const pieces = SET_PIECES[setId];
    const worn = Object.values(p.look).filter((v) => typeof v === 'string' && pieces.includes(v)).length;
    if (worn >= 2) return anim;
  }
  return null;
}

export function moodFor(p: Player): Mood {
  if (store.isCelebrating(p.id)) return 'celebrate';
  const t = store.timer;
  if (t && t.playerId === p.id) {
    if (t.status === 'waiting') return t.step === 'work' ? 'break' : 'idle';
    return t.step === 'work' ? 'study' : 'break';
  }
  if (isSleepy(p, store.today(), store.settings.dayStartMinutes)) return 'sleepy';
  return 'idle';
}

export function sceneFor(p: Player | undefined, extra: Partial<SceneState> = {}): SceneState {
  const today = store.today();
  const month = monthIndex(monthOf(today));
  return {
    look: p?.look,
    mood: p ? moodFor(p) : 'idle',
    setAnim: p ? setAnimFor(p) : null,
    moonPhase: p ? expProgress(p.seasonExp).ratio : 1,
    bloodMoon: isBloodMoon(today),
    weather: MOONS[month].weather,
    buildings: p ? buildingsFor(p) : [],
    background: p?.look.background ?? 'bg_night',
    animations: store.settings.animations,
    charX: 0.42,
    prop: p?.look.prop && ITEM[p.look.prop] ? p.look.prop : undefined,
    ...extra,
  };
}
