import { useSyncExternalStore } from 'react';
import { BOSS, ITEM } from './core/catalog';
import { dayKey, weekOf } from './core/dates';
import * as G from './core/game';
import { rankInfo } from './core/ranks';
import { migrateApp } from './core/settings';
import { weekDamage } from './core/stats';
import * as Tm from './core/timer';
import type { AppData, Look, Notice, Player, Settings, TimerTarget } from './core/types';
import { fmtClock, hashPin, uid } from './core/util';
import { platform, type MiniState } from './platform';
import { configureSound, play, startAmbience, stopAmbience } from './sound';

export type Tab = 'stats' | 'projects' | 'quests' | 'achievements' | 'shop';

export type Route =
  | { name: 'loading' }
  | { name: 'home' }
  | { name: 'players' }
  | { name: 'newPlayer' }
  | { name: 'player'; playerId: string; tab: Tab; projectId?: string; wardrobe?: boolean }
  | { name: 'focus' }
  | { name: 'record' }
  | { name: 'settings' };

export type Overlay = { id: string } & (
  | { kind: 'stepEnd'; o: Extract<Tm.TimerOutcome, { kind: 'stepEnded' }>; fight?: { bossId: string; before: number; after: number; hp: number } }
  | { kind: 'setComplete'; o: Extract<Tm.TimerOutcome, { kind: 'setComplete' }> }
  | { kind: 'stopped'; o: Extract<Tm.TimerOutcome, { kind: 'stopped' }> }
  | { kind: 'note'; playerId: string; chapterId: string }
  | { kind: 'rankUp'; playerId: string; from: number; to: number; coins: number; items: string[] }
  | { kind: 'achievement'; playerId: string; achId: string; coins: number }
  | { kind: 'challenge'; playerId: string; chId: string; month: string; coins: number }
  | { kind: 'bossBeaten'; playerId: string; bossId: string; coins: number; item?: string }
  | { kind: 'project'; playerId: string; name: string; projectId: string }
  | { kind: 'prestige'; playerId: string; stars: number; item?: string }
  | { kind: 'notice'; playerId: string; notice: Notice }
  | { kind: 'confirm'; title: string; body: string; confirm: string; danger?: boolean; typeToConfirm?: string; onConfirm: () => void }
  | { kind: 'pin'; playerId: string; purpose: 'open' | 'change'; then?: () => void }
  | { kind: 'playerDetails'; playerId: string }
);

export interface Toast {
  id: number;
  text: string;
  kind: 'exp' | 'coins' | 'info' | 'warn' | 'level';
  at: number;
}

type Listener = () => void;
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type OverlayInput = DistOmit<Overlay, 'id'> & { id?: string };

const SAVE_DELAY = 350;

class Store {
  app: AppData = migrateApp(null);
  players: Player[] = [];
  route: Route = { name: 'loading' };
  overlays: Overlay[] = [];
  toasts: Toast[] = [];
  celebrateAt: Record<string, number> = {};
  unlocked = new Set<string>();
  dataDir = '';
  loaded = false;
  version = 0;
  private listeners = new Set<Listener>();
  private dirtyPlayers = new Set<string>();
  private saveTimer: number | null = null;
  private collect: G.GameEvent[] | null = null;
  private toastSeq = 0;
  private lastDay = '';
  private lastMiniPush = 0;

  // ---------------------------------------------------------------- react glue
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  bump() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  get settings(): Settings {
    return this.app.settings;
  }

  ctx(): G.Ctx {
    return {
      settings: this.app.settings,
      now: Date.now(),
      emit: (e) => (this.collect ? this.collect.push(e) : this.handleEvent(e)),
    };
  }

  today() {
    return dayKey(Date.now(), this.settings.dayStartMinutes);
  }

  player(id: string | undefined): Player | undefined {
    return id ? this.players.find((p) => p.id === id) : undefined;
  }

  get currentPlayer(): Player | undefined {
    const r = this.route;
    if (r.name === 'player') return this.player(r.playerId);
    if (r.name === 'focus') return this.player(this.app.timer?.playerId);
    return undefined;
  }

  // ---------------------------------------------------------------- persistence
  async load() {
    try {
      const data = await platform.loadAll();
      this.dataDir = data.dataDir;
      this.app = migrateApp(data.app ? JSON.parse(data.app) : null);
      const players: Player[] = [];
      for (const raw of data.players) {
        try {
          players.push(G.migratePlayer(JSON.parse(raw)));
        } catch {
          /* skip a damaged file */
        }
      }
      const order = this.app.playerOrder;
      players.sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || a.createdAt - b.createdAt;
      });
      this.players = players;
      this.app.playerOrder = players.map((p) => p.id);
    } catch (e) {
      console.error('load failed', e);
    }
    this.applySettings();
    this.lastDay = this.today();
    const ctx = this.ctx();
    for (const p of this.players) {
      G.reconcile(ctx, p);
      this.dirtyPlayers.add(p.id);
    }
    G.awardLeaderBadges(ctx, this.app, this.players);
    // a timer that ended while the app was closed
    this.tick(true);
    this.loaded = true;
    this.scheduleSave();
    platform.onCommand((cmd) => this.command(cmd));
    platform.onResume(() => this.tick());
    platform.onFlush(() => this.flush());
    window.setInterval(() => this.tick(), 500);
    this.bump();
  }

  markDirty(p?: Player) {
    if (p) this.dirtyPlayers.add(p.id);
    this.scheduleSave();
    this.bump();
  }

  private scheduleSave() {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, SAVE_DELAY);
  }

  async flush() {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const jobs: Promise<void>[] = [];
    for (const id of this.dirtyPlayers) {
      const p = this.player(id);
      if (p) jobs.push(platform.savePlayer(id, JSON.stringify(p)));
    }
    this.dirtyPlayers.clear();
    this.app.playerOrder = this.players.map((p) => p.id);
    jobs.push(platform.saveApp(JSON.stringify(this.app)));
    await Promise.all(jobs);
  }

  // ---------------------------------------------------------------- navigation
  go(route: Route) {
    this.route = route;
    if (route.name === 'player') {
      const p = this.player(route.playerId);
      if (p) {
        this.app.lastPlayerId = p.id;
        this.collect = [];
        G.recordAccess(this.ctx(), p);
        this.showNotices(p);
        this.flushEvents();
        this.markDirty(p);
        this.scheduleSave();
      }
    }
    this.bump();
  }

  openPlayer(id: string, tab: Tab = 'stats') {
    const p = this.player(id);
    if (!p) return;
    if (p.pinHash && !this.unlocked.has(id)) {
      this.pushOverlay({ kind: 'pin', playerId: id, purpose: 'open', then: () => this.go({ name: 'player', playerId: id, tab }) });
      return;
    }
    this.go({ name: 'player', playerId: id, tab });
  }

  private showNotices(p: Player) {
    if (!p.notices.length) return;
    for (const n of p.notices) this.pushOverlay({ kind: 'notice', playerId: p.id, notice: n });
    p.notices = [];
  }

  // ---------------------------------------------------------------- overlays & toasts
  pushOverlay(o: OverlayInput) {
    this.overlays = [...this.overlays, { ...o, id: o.id ?? uid('o') } as Overlay];
    this.bump();
  }

  closeOverlay(id: string) {
    this.overlays = this.overlays.filter((o) => o.id !== id);
    this.bump();
  }

  toast(text: string, kind: Toast['kind'] = 'info') {
    const t: Toast = { id: ++this.toastSeq, text, kind, at: Date.now() };
    this.toasts = [...this.toasts.slice(-4), t];
    window.setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.bump();
    }, 3200);
    this.bump();
  }

  private flushEvents() {
    const evs = this.collect ?? [];
    this.collect = null;
    for (const e of evs) this.handleEvent(e);
  }

  /** Run a game action, then show its events after any primary card it pushed. */
  run<T>(p: Player | undefined, fn: (ctx: G.Ctx) => T, after?: (r: T) => void): T {
    this.collect = [];
    const r = fn(this.ctx());
    const evs = this.collect;
    this.collect = null;
    after?.(r);
    for (const e of evs) this.handleEvent(e);
    this.markDirty(p);
    return r;
  }

  private handleEvent(e: G.GameEvent) {
    const p = this.player(e.playerId);
    const who = p && this.players.length > 1 && this.currentPlayer?.id !== p.id ? `${p.name}: ` : '';
    switch (e.type) {
      case 'exp':
        if (e.amount) this.toast(`${who}${e.amount > 0 ? '+' : ''}${e.amount} EXP · ${e.label}${e.mult > 1 ? ` (x${+e.mult.toFixed(2)})` : ''}`, 'exp');
        break;
      case 'coins':
        this.toast(`${who}+${e.amount} coins · ${e.label}`, 'coins');
        play('coin');
        break;
      case 'level':
        if (e.rankUp) this.pushOverlay({ kind: 'rankUp', playerId: e.playerId, from: e.from, to: e.to, coins: e.coins, items: e.items });
        else {
          this.toast(`${who}Tier up! ${rankInfo(e.to).full}${e.coins ? ` · +${e.coins} coins` : ''}`, 'level');
          play('levelup');
        }
        this.celebrateAt[e.playerId] = Date.now();
        break;
      case 'achievement':
        this.pushOverlay({ kind: 'achievement', playerId: e.playerId, achId: e.id, coins: e.coins });
        break;
      case 'challenge':
        this.pushOverlay({ kind: 'challenge', playerId: e.playerId, chId: e.id, month: e.month, coins: e.coins });
        break;
      case 'boss':
        this.pushOverlay({ kind: 'bossBeaten', playerId: e.playerId, bossId: e.bossId, coins: e.coins, item: e.item });
        break;
      case 'mission':
        this.toast(`${who}Mission complete: ${e.name}`, 'level');
        break;
      case 'project':
        this.pushOverlay({ kind: 'project', playerId: e.playerId, name: e.name, projectId: e.projectId });
        break;
      case 'prestige':
        this.pushOverlay({ kind: 'prestige', playerId: e.playerId, stars: e.stars, item: e.item });
        break;
      case 'celebrate':
        this.celebrateAt[e.playerId] = Date.now();
        break;
    }
  }

  // ---------------------------------------------------------------- settings
  updateSettings(patch: Partial<Settings>) {
    this.app.settings = { ...this.app.settings, ...patch };
    this.applySettings();
    this.markDirty();
  }

  applySettings() {
    const s = this.app.settings;
    configureSound(s.soundsOn, s.volume);
    if (s.soundsOn && s.ambience) startAmbience();
    else stopAmbience();
    platform.applySettings({ startWithWindows: s.startWithWindows, minimizeToTray: s.minimizeToTray });
    platform.setMini(!!(s.miniTimer && this.app.timer));
    document.documentElement.classList.toggle('no-anim', !s.animations);
  }

  // ---------------------------------------------------------------- players
  createPlayer(name: string, look: Look): Player {
    const p = G.createPlayer(this.ctx(), name, look);
    this.players = [...this.players, p];
    this.markDirty(p);
    this.scheduleSave();
    return p;
  }

  async deletePlayer(id: string) {
    this.players = this.players.filter((p) => p.id !== id);
    if (this.app.timer?.playerId === id) this.app.timer = undefined;
    if (this.app.lastPlayerId === id) this.app.lastPlayerId = undefined;
    this.unlocked.delete(id);
    await platform.deletePlayer(id);
    this.markDirty();
  }

  resetPlayer(id: string) {
    const old = this.player(id);
    if (!old) return;
    const fresh = G.createPlayer(this.ctx(), old.name, { ...G.defaultLook(old.look.body), body: old.look.body });
    fresh.id = old.id;
    fresh.pinHash = old.pinHash;
    if (this.app.timer?.playerId === id) this.app.timer = undefined;
    this.players = this.players.map((p) => (p.id === id ? fresh : p));
    this.markDirty(fresh);
  }

  async setPin(id: string, pin: string | null) {
    const p = this.player(id);
    if (!p) return;
    p.pinHash = pin ? await hashPin(p.id, pin) : undefined;
    if (pin) this.unlocked.add(id);
    this.markDirty(p);
  }

  async checkPin(id: string, pin: string): Promise<boolean> {
    const p = this.player(id);
    if (!p?.pinHash) return true;
    const ok = (await hashPin(p.id, pin)) === p.pinHash;
    if (ok) this.unlocked.add(id);
    return ok;
  }

  movePlayer(id: string, to: number) {
    const from = this.players.findIndex((p) => p.id === id);
    const arr = [...this.players];
    G.moveItem(arr, from, to);
    this.players = arr;
    this.markDirty();
  }

  // ---------------------------------------------------------------- backup
  backupJson(players: Player[]) {
    return JSON.stringify(
      { format: 'arrazi-backup', version: 1, exportedAt: new Date().toISOString(), settings: this.app.settings, players },
      null,
      1,
    );
  }

  async exportBackup(playerId?: string) {
    const list = playerId ? this.players.filter((p) => p.id === playerId) : this.players;
    const stamp = new Date().toISOString().slice(0, 10);
    const name = playerId ? `arrazi-${list[0]?.name.replace(/[^\w-]+/g, '_') || 'player'}-${stamp}.json` : `arrazi-backup-${stamp}.json`;
    const r = await platform.exportBackup(this.backupJson(list), name);
    if (r.ok) this.toast(`Backup saved${r.path ? `: ${r.path}` : ''}`);
    return r.ok;
  }

  async importBackup(): Promise<string | null> {
    const r = await platform.importBackup();
    if (!r.ok || !r.json) return r.error ?? null;
    try {
      const data = JSON.parse(r.json);
      if (data?.format !== 'arrazi-backup' || !Array.isArray(data.players)) return 'This is not an Arrazi backup file.';
      let added = 0;
      for (const raw of data.players) {
        if (!raw?.id || !raw?.name) continue;
        const p = G.migratePlayer(raw);
        const i = this.players.findIndex((x) => x.id === p.id);
        if (i >= 0) this.players[i] = p;
        else this.players.push(p);
        this.players = [...this.players];
        G.reconcile(this.ctx(), p);
        this.dirtyPlayers.add(p.id);
        added++;
      }
      this.markDirty();
      this.toast(`Imported ${added} player${added === 1 ? '' : 's'}`);
      return null;
    } catch {
      return 'The backup file is damaged.';
    }
  }

  // ---------------------------------------------------------------- timer
  get timer() {
    return this.app.timer;
  }

  startPomodoro(p: Player, target: TimerTarget) {
    if (this.app.timer) {
      this.toast('A Pomodoro is already running. Stop it first.', 'warn');
      this.go({ name: 'focus' });
      return;
    }
    const cfg = Tm.configForTarget(this.settings.pomodoro, p, target);
    this.run(p, (ctx) => Tm.startSet(ctx, this.app, p, target, cfg));
    this.scheduleSave();
    platform.setMini(this.settings.miniTimer);
    play('click');
    this.go({ name: 'focus' });
  }

  private timerPlayer() {
    return this.player(this.app.timer?.playerId);
  }

  tick(initial = false) {
    const day = this.today();
    if (this.lastDay && day !== this.lastDay) {
      this.lastDay = day;
      const ctx = this.ctx();
      for (const p of this.players) {
        G.reconcile(ctx, p);
        this.dirtyPlayers.add(p.id);
      }
      G.awardLeaderBadges(ctx, this.app, this.players);
      const cur = this.currentPlayer;
      if (cur) {
        G.recordAccess(ctx, cur);
        this.showNotices(cur);
      }
      this.markDirty();
    }
    const t = this.app.timer;
    if (!t) {
      if (Date.now() - this.lastMiniPush > 5000) {
        this.lastMiniPush = Date.now();
        platform.timerState(null);
      }
      return;
    }
    const p = this.timerPlayer();
    if (!p) {
      this.app.timer = undefined;
      this.markDirty();
      return;
    }
    if (t.status === 'running' && Date.now() >= t.endsAt) {
      const before = weekDamage(p, weekOf(this.today()), this.settings.dayStartMinutes);
      this.run(
        p,
        (ctx) => Tm.tickTimer(ctx, this.app, p),
        (outs) => this.handleOutcomes(p, outs, before, !initial),
      );
      this.scheduleSave();
    }
    this.pushTimerState();
  }

  private handleOutcomes(p: Player, outs: Tm.TimerOutcome[], damageBefore: number, alert: boolean) {
    if (!outs.length) return;
    const last = outs[outs.length - 1];
    for (const o of outs) {
      if (o.kind === 'stepEnded') {
        let fight: { bossId: string; before: number; after: number; hp: number } | undefined;
        if (o.finished === 'work') {
          const week = weekOf(this.today());
          const rec = p.bosses.find((b) => b.week === week);
          if (rec) {
            const after = weekDamage(p, week, this.settings.dayStartMinutes);
            fight = { bossId: rec.bossId, before: Math.min(damageBefore, after), after, hp: rec.hp };
          }
        }
        if (o === last) this.pushOverlay({ kind: 'stepEnd', o, fight });
      } else if (o.kind === 'setComplete') {
        this.pushOverlay({ kind: 'setComplete', o });
      }
    }
    if (alert || (last.kind === 'stepEnded' && last.live)) this.alertStep(last);
    platform.setMini(!!(this.settings.miniTimer && this.app.timer));
  }

  /** Notification + pop-up + sound at the end of a step */
  private alertStep(o: Tm.TimerOutcome) {
    const s = this.settings;
    let title = '';
    let body = '';
    let actions: { id: string; label: string }[] = [];
    if (o.kind === 'stepEnded') {
      const mins = Tm.stepMinutes(o.config, o.next);
      if (o.finished === 'work') {
        title = 'Work done!';
        body = o.autoStarted
          ? `${o.next === 'long' ? 'Long break' : 'Break'} started: ${mins} minutes.`
          : `Take a ${mins}-minute ${o.next === 'long' ? 'long break' : 'break'}.`;
        actions = o.autoStarted
          ? [
              { id: 'timer:skip', label: 'Skip' },
              { id: 'timer:extend', label: '+5 min' },
            ]
          : [
              { id: 'timer:start', label: 'Start break' },
              { id: 'timer:skip', label: 'Skip' },
              { id: 'timer:extend', label: '+5 min' },
            ];
      } else {
        title = 'Back to work';
        body = `${o.autoStarted ? 'Work started' : 'Break over'}: session ${o.nextIndex} of ${o.config.sessions} on ${o.target.label}.`;
        actions = o.autoStarted
          ? [
              { id: 'timer:skip', label: 'Skip' },
              { id: 'timer:extend', label: '+5 min' },
            ]
          : [
              { id: 'timer:start', label: 'Start work' },
              { id: 'timer:skip', label: 'Skip' },
              { id: 'timer:extend', label: '+5 min' },
            ];
      }
    } else if (o.kind === 'setComplete') {
      title = o.valid ? `Set complete! +${o.exp} EXP` : 'Set complete!';
      body = `Is "${o.target.label}" finished?`;
    } else return;
    if (s.soundsOn) play(s.timerSound);
    if (s.systemNotifications) platform.notify({ title, body, actions });
    if (s.popUp) platform.popUp();
  }

  pushTimerState() {
    const t = this.app.timer;
    const now = Date.now();
    if (!t) {
      platform.timerState(null);
      return;
    }
    const rem = Tm.remainingAt(t, now);
    const p = this.timerPlayer();
    const state: MiniState = {
      step: t.status === 'waiting' ? (t.step === 'work' ? 'Work done' : 'Break over') : t.step === 'work' ? `Work ${t.index}/${t.config.sessions}` : Tm.stepLabel(t.step),
      label: t.target.label,
      remaining: t.status === 'waiting' ? '00:00' : fmtClock(rem),
      status: t.status,
      progress: t.plannedMs ? 1 - rem / t.plannedMs : 1,
      player: p?.name ?? '',
    };
    this.lastMiniPush = now;
    platform.timerState(state);
  }

  timerAction(action: 'pause' | 'resume' | 'skip' | 'extend' | 'stop' | 'startNext') {
    const t = this.app.timer;
    const p = this.timerPlayer();
    if (!t || !p) return;
    const now = Date.now();
    switch (action) {
      case 'pause':
        Tm.pauseTimer(t, now);
        break;
      case 'resume':
        Tm.resumeTimer(t, now);
        break;
      case 'extend':
        this.run(p, (ctx) => Tm.extendTimer(ctx, this.app));
        this.dismissTimerCards();
        break;
      case 'startNext':
        this.run(p, (ctx) => Tm.startNext(ctx, this.app));
        this.dismissTimerCards();
        break;
      case 'skip':
        this.run(
          p,
          (ctx) => Tm.skipStep(ctx, this.app, p),
          (outs) => {
            for (const o of outs) if (o.kind === 'setComplete') this.pushOverlay({ kind: 'setComplete', o });
          },
        );
        this.dismissTimerCards(true);
        break;
      case 'stop':
        this.run(
          p,
          (ctx) => Tm.stopTimer(ctx, this.app, p),
          (o) => {
            this.dismissTimerCards();
            if (o.kind === 'setComplete') this.pushOverlay({ kind: 'setComplete', o });
            else if (o.kind === 'stopped') this.pushOverlay({ kind: 'stopped', o });
          },
        );
        break;
    }
    play('click');
    this.scheduleSave();
    platform.setMini(!!(this.settings.miniTimer && this.app.timer));
    this.markDirty(p);
    this.pushTimerState();
  }

  private dismissTimerCards(keepSet = false) {
    this.overlays = this.overlays.filter((o) => o.kind !== 'stepEnd' && (keepSet || o.kind !== 'setComplete'));
  }

  command(cmd: string) {
    switch (cmd) {
      case 'timer:start':
        this.timerAction('startNext');
        break;
      case 'timer:skip':
        this.timerAction('skip');
        break;
      case 'timer:extend':
        this.timerAction('extend');
        break;
      case 'timer:pause':
        this.timerAction('pause');
        break;
      case 'timer:resume':
        this.timerAction('resume');
        break;
      case 'timer:toggle': {
        const t = this.app.timer;
        if (t?.status === 'running') this.timerAction('pause');
        else if (t?.status === 'paused') this.timerAction('resume');
        else if (t?.status === 'waiting') this.timerAction('startNext');
        break;
      }
      case 'timer:stop':
        this.timerAction('stop');
        break;
      case 'open-focus':
        if (this.app.timer) this.go({ name: 'focus' });
        break;
    }
  }

  // ---------------------------------------------------------------- learning actions
  completeChapter(p: Player, chapterId: string) {
    const ok = this.run(
      p,
      (ctx) => G.completeChapter(ctx, p, chapterId),
      (done) => {
        if (done) this.pushOverlay({ kind: 'note', playerId: p.id, chapterId });
      },
    );
    if (!ok) this.toast('Finish the mission before this one first.', 'warn');
    else play('levelup');
  }

  untickChapter(p: Player, chapterId: string) {
    this.run(p, (ctx) => G.untickChapter(ctx, p, chapterId));
  }

  saveNote(p: Player, chapterId: string, text: string) {
    return this.run(p, (ctx) => G.saveNote(ctx, p, chapterId, text));
  }

  completeSideQuest(p: Player, id: string) {
    this.run(p, (ctx) => G.completeSideQuest(ctx, p, id));
    play('levelup');
  }

  untickSideQuest(p: Player, id: string) {
    this.run(p, (ctx) => G.untickSideQuest(ctx, p, id));
  }

  buy(p: Player, itemId: string) {
    const r = this.run(p, (ctx) => G.buyItem(ctx, p, itemId));
    if (r.ok) {
      play('coin');
      this.toast(`Bought ${ITEM[itemId]?.name ?? itemId}`, 'coins');
    } else this.toast(r.reason ?? 'Cannot buy this.', 'warn');
    return r.ok;
  }

  prestige(p: Player) {
    this.run(p, (ctx) => G.prestige(ctx, p));
  }

  isCelebrating(playerId: string) {
    return Date.now() - (this.celebrateAt[playerId] ?? 0) < 3200;
  }

  bossName(id: string) {
    return BOSS[id]?.name ?? id;
  }
}


export const store = new Store();

export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}
