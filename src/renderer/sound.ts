// Soft night sounds, synthesised with WebAudio so the app ships no audio files.
import type { SoundId } from './core/types';

let ac: AudioContext | null = null;
let master = 0.7;
let enabled = true;

function audio(): AudioContext | null {
  try {
    if (!ac) ac = new AudioContext();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

export function configureSound(on: boolean, volume: number) {
  enabled = on;
  master = Math.max(0, Math.min(1, volume / 100));
  if (!on) stopAmbience();
}

function env(a: AudioContext, g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(a: AudioContext, freq: number, t: number, peak: number, decay: number, type: OscillatorType = 'sine', attack = 0.005) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  env(a, g, t, peak * master, attack, decay);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
  return o;
}

function noise(a: AudioContext, t: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1) {
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  env(a, g, t, peak * master, 0.004, dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function bell(a: AudioContext, t: number, f0: number, decay: number, peak = 0.35) {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.0, 0.35, 0.6],
    [2.76, 0.45, 0.55],
    [5.4, 0.18, 0.3],
    [8.93, 0.08, 0.18],
  ];
  for (const [m, amp, dk] of partials) tone(a, f0 * m, t, peak * amp, decay * dk);
}

function caw(a: AudioContext, t: number) {
  for (let i = 0; i < 2; i++) {
    const s = t + i * 0.32;
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, s);
    o.frequency.exponentialRampToValueAtTime(330, s + 0.2);
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1300;
    f.Q.value = 2.5;
    const g = a.createGain();
    env(a, g, s, 0.32 * master, 0.02, 0.2);
    o.connect(f).connect(g).connect(a.destination);
    o.start(s);
    o.stop(s + 0.3);
    noise(a, s, 0.18, 0.12, 'bandpass', 1700, 3);
  }
}

export type Sfx = SoundId | 'click' | 'coin' | 'levelup' | 'hit' | 'badge';

export function play(s: Sfx) {
  if (!enabled || master <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.02;
  switch (s) {
    case 'bell':
      bell(a, t, 196, 3.6);
      break;
    case 'chime':
      bell(a, t, 784, 1.6, 0.2);
      bell(a, t + 0.18, 988, 1.6, 0.16);
      break;
    case 'gong':
      bell(a, t, 98, 5.5, 0.45);
      noise(a, t, 0.5, 0.08, 'lowpass', 400);
      break;
    case 'crow':
      caw(a, t);
      break;
    case 'wood':
      tone(a, 820, t, 0.4, 0.09);
      tone(a, 820, t + 0.22, 0.4, 0.09);
      noise(a, t, 0.03, 0.2, 'highpass', 2000);
      break;
    case 'click':
      tone(a, 520, t, 0.08, 0.04, 'square');
      break;
    case 'coin':
      tone(a, 988, t, 0.12, 0.08, 'square');
      tone(a, 1319, t + 0.07, 0.12, 0.18, 'square');
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => tone(a, f, t + i * 0.09, 0.16, 0.5, 'triangle'));
      break;
    case 'badge':
      [659, 988].forEach((f, i) => tone(a, f, t + i * 0.12, 0.14, 0.6, 'triangle'));
      break;
    case 'hit':
      noise(a, t, 0.12, 0.35, 'lowpass', 900);
      tone(a, 140, t, 0.3, 0.12, 'square');
      break;
  }
}

// ---------------------------------------------------------------- night ambience (crickets)

let ambTimer: number | null = null;

export function startAmbience() {
  if (ambTimer !== null || !enabled) return;
  const chirp = () => {
    const a = audio();
    if (!a || !enabled) return;
    const t = a.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.06;
      const o = a.createOscillator();
      o.frequency.value = 4300 + Math.random() * 300;
      const g = a.createGain();
      env(a, g, s, 0.018 * master, 0.005, 0.035);
      o.connect(g).connect(a.destination);
      o.start(s);
      o.stop(s + 0.06);
    }
  };
  ambTimer = window.setInterval(() => {
    if (Math.random() < 0.7) chirp();
  }, 900);
}

export function stopAmbience() {
  if (ambTimer !== null) window.clearInterval(ambTimer);
  ambTimer = null;
}
