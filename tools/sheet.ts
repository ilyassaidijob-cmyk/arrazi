import { characterCanvas, POSE_FRAMES, type PoseName } from '../src/renderer/art/character';
import { defaultLook } from '../src/renderer/core/game';
import type { Look } from '../src/renderer/core/types';

const S = 5;
const root = document.body;
root.style.background = '#1e1e1e';
root.style.margin = '8px';
function row(label: string, look: Look, poses: PoseName[]) {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:4px;align-items:flex-end;margin-bottom:6px;font:12px monospace;color:#ccc';
  const l = document.createElement('div');
  l.textContent = label;
  l.style.width = '110px';
  div.appendChild(l);
  for (const p of poses)
    for (let f = 0; f < POSE_FRAMES[p]; f++) {
      const src = characterCanvas(look, p, f);
      const c = document.createElement('canvas');
      c.width = src.width * S;
      c.height = src.height * S;
      const x = c.getContext('2d')!;
      x.imageSmoothingEnabled = false;
      x.fillStyle = '#6c6c6c';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, 0, 0, c.width, c.height);
      div.appendChild(c);
    }
  root.appendChild(div);
}
const all: PoseName[] = ['stand', 'walk', 'sit', 'stretch', 'jump', 'sleepy', 'attack'];
const boy = defaultLook('boy');
const girl = defaultLook('girl');
row('boy', boy, all);
row('girl', girl, all);
const params = new URLSearchParams(location.search);
if (params.get('items')) {
  const looks: [string, Partial<Look>][] = [
    ['gym', { top: 'gym_hoodie', bottom: 'gym_joggers', shoes: 'gym_shoes', head: 'gym_headband', wrist: 'gym_wraps', held: 'gym_dumbbell', hair: 'hair_short', hairShade: 'shade_moon' }],
    ['gym tank', { top: 'gym_tank', bottom: 'gym_joggers', shoes: 'gym_shoes', hair: 'hair_buzz', hairShade: 'shade_raven' }],
    ['music', { top: 'music_jacket', head: 'music_headphones', back: 'music_guitar', hair: 'hair_long', hairShade: 'shade_ink' }],
    ['music tee', { top: 'music_tee', head: 'music_beanie', hair: 'hair_curly', hairShade: 'shade_silver' }],
    ['cyber', { top: 'cyber_hoodie', face: 'cyber_glasses', neck: 'cyber_usb', held: 'cyber_laptop', hair: 'hair_tied' }],
    ['cyber mask', { top: 'cyber_hoodie', face: 'cyber_mask', hair: 'hair_sidepart' }],
    ['rank', { top: 'rank_coat', head: 'rank_crown', back: 'rank_cape', shoes: 'rank_boots', wrist: 'rank_bracers', neck: 'rank_scarf' }],
    ['robe', { top: 'rank_robe', head: 'rank_circlet', back: 'rank_satchel' }],
    ['prestige', { top: 'prestige_armor', head: 'prestige_halo', back: 'prestige_cloak', face: 'prestige_visor' }],
    ['mantle', { top: 'prestige_mantle' }],
    ['hunter', { top: 'moon_hunter', back: 'moon_sturgeon' }],
    ['cold', { top: 'moon_cold', neck: 'moon_snow', head: 'moon_beaver', shoes: 'moon_worm' }],
    ['harvest', { head: 'moon_harvest', held: 'moon_berry', back: 'moon_flower' }],
    ['antlers', { head: 'moon_buck' }],
    ['petals', { head: 'moon_pink', body: 'girl', hair: 'hair_long' }],
    ['boss1', { head: 'boss_crow', back: 'boss_shadow', held: 'boss_fog', face: 'boss_thief' }],
    ['boss2', { head: 'boss_scarecrow', top: 'boss_owl', held: 'boss_willow', back: 'boss_moth' }],
  ];
  for (const [n, l] of looks) row(n, { ...boy, ...l } as Look, ['stand', 'walk', 'sit', 'jump']);
  row('sets', { ...boy, top: 'gym_tank' }, ['lift', 'guitar', 'type']);
}
