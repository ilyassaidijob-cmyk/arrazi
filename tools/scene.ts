import { Scene, type SceneState } from '../src/renderer/art/scene';
import { defaultLook } from '../src/renderer/core/game';

const q = new URLSearchParams(location.search);
document.body.style.cssText = 'margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px';
const variants: Partial<SceneState>[] = [
  { background: 'bg_night', mood: 'idle', moonPhase: 0.62, weather: 'leaves', buildings: [{ type: 'tower', progress: 1, done: true, label: 'Cyber' }, { type: 'library', progress: 0.5, done: false, label: 'Read' }] },
  { background: 'bg_night', mood: 'study', moonPhase: 0.25, weather: 'snow', prop: 'cyber_terminal', bloodMoon: true },
  { background: 'bg_forest', mood: 'sleepy', moonPhase: 1, weather: 'fireflies' },
  { background: 'bg_gym', mood: 'celebrate', moonPhase: 0.9, weather: 'rain', prop: 'gym_kettlebell' },
  { background: 'bg_rooftop', mood: 'idle', moonPhase: 0.4, weather: 'petals', prop: 'music_keyboard' },
  { background: 'bg_server', mood: 'break', moonPhase: 0.7, weather: 'none' },
  { background: 'moon_wolf', mood: 'idle', moonPhase: 0.05, weather: 'snow', buildings: [{ type: 'observatory', progress: 1, done: true, label: 'x' }, { type: 'stage', progress: 1, done: true, label: 'x' }, { type: 'alchemy', progress: 0.3, done: false, label: 'x' }] },
  { background: 'bg_night', mood: 'idle', moonPhase: 0.5, weather: 'none', buildings: ['yard','atelier','clocktower','greenhouse','workshop'].map(type => ({ type, progress: 1, done: true, label: type })) },
];
const t = Number(q.get('t') ?? '3');
for (const v of variants) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:690px;height:330px;overflow:hidden;background:#000';
  const cv = document.createElement('canvas');
  cv.style.imageRendering = 'pixelated';
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
  const sc = new Scene(cv, { look: { ...defaultLook('girl'), hair: 'hair_long', top: 'cyber_hoodie' }, mood: 'idle', moonPhase: 0.5, bloodMoon: false, weather: 'none', buildings: [], background: 'bg_night', animations: true, charX: 0.42, targetHeight: 110, ...v } as SceneState);
  sc.resize(690, 330);
  (sc as any).t = t; (sc as any).moodSince = 0;
  for (let i = 0; i < 40; i++) { (sc as any).t = t + i / 30; sc.draw(); }
}
