import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import logoSvg from '../../../assets/logo-light.svg';
import { rankBadgeUrl } from '../art/badges';
import { characterCanvas, POSE_FRAMES, type PoseName } from '../art/character';
import { iconUrl } from '../art/icons';
import { urlSize } from '../art/pixels';
import { Scene, type SceneState } from '../art/scene';
import { crowFlyUrl, crowPerchUrl } from '../art/sprites';
import { rankInfo } from '../core/ranks';
import type { Look } from '../core/types';
import { fmtNum } from '../core/util';
import { play } from '../sound';
import { store } from '../store';

export function Pix({ src, scale = 2, className = '', style, alt = '', title }: { src: string; scale?: number; className?: string; style?: CSSProperties; alt?: string; title?: string }) {
  const [w, h] = urlSize(src);
  return <img className={`px ${className}`} src={src} width={w * scale} height={h * scale} style={style} alt={alt} title={title} draggable={false} />;
}

export function Icon({ name, scale = 2, shift = 0, title }: { name: string; scale?: number; shift?: number; title?: string }) {
  return <Pix src={iconUrl(name, shift)} scale={scale} title={title} />;
}

type BtnProps = {
  children?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  kind?: 'primary' | 'ghost' | 'default';
  small?: boolean;
  icon?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
  style?: CSSProperties;
};

export function Btn({ children, onClick, kind = 'default', small, icon, disabled, title, className = '', type = 'button', style }: BtnProps) {
  const cls = ['btn', kind !== 'default' ? kind : '', small ? 'small' : '', icon && !children ? 'icon' : '', className].join(' ');
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled}
      title={title}
      style={style}
      onClick={(e) => {
        if (store.settings.soundsOn) play('click');
        onClick?.(e);
      }}
    >
      {icon && <Icon name={icon} scale={2} shift={kind === 'primary' && !disabled ? -4 : 0} />}
      {children}
    </button>
  );
}

export function Panel({ title, children, className = '', style, right, light }: { title?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties; right?: ReactNode; light?: boolean }) {
  return (
    <section className={`panel ${light ? 'light' : ''} ${className}`} style={style}>
      {title && (
        <h3>
          {title}
          {right && <span className="spacer" />}
          {right}
        </h3>
      )}
      {children}
    </section>
  );
}

export function Bar({ value, max, thin, dim, title }: { value: number; max: number; thin?: boolean; dim?: boolean; title?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar ${thin ? 'thin' : ''} ${dim ? 'dim' : ''}`} title={title}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => {
        if (store.settings.soundsOn) play('click');
        onChange(!on);
      }}
    />
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} type="button" className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Coins({ n, bright }: { n: number; bright?: boolean }) {
  return (
    <span className={`chip ${bright ? 'bright' : ''}`} title="Coins">
      <Icon name="coin" scale={2} />
      <span className="num">{fmtNum(n)}</span>
    </span>
  );
}

export function RankBadge({ level, scale = 2, stars = 0 }: { level: number; scale?: number; stars?: number }) {
  const ri = rankInfo(level);
  return (
    <span className="col" style={{ alignItems: 'center', gap: 2 }} title={ri.full}>
      {stars > 0 && (
        <span className="pixel" style={{ fontSize: 10 + scale * 2, lineHeight: 1, letterSpacing: 1 }}>
          {stars > 5 ? `★×${stars}` : '★'.repeat(stars)}
        </span>
      )}
      <Pix src={rankBadgeUrl(ri.rank, ri.tier)} scale={scale} />
    </span>
  );
}

export function Logo({ size = 64, className = '', style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-block', width: size, height: size * (456 / 472), ...style }}
      dangerouslySetInnerHTML={{ __html: logoSvg.replace('<svg ', `<svg width="${size}" height="${Math.round(size * (456 / 472))}" `) }}
    />
  );
}

/** Animated character sprite (idle breathing and blinking, or a fixed pose). */
export function CharacterView({ look, scale = 4, pose, mood, flip, className = '', style }: { look: Look; scale?: number; pose?: PoseName; mood?: 'idle' | 'celebrate' | 'sleepy'; flip?: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  const anim = store.settings.animations;
  useEffect(() => {
    if (!anim) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 110);
    return () => window.clearInterval(id);
  }, [anim]);
  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const t = (tick * 110) / 1000;
    let p: PoseName = pose ?? 'stand';
    let f = 0;
    let blink = false;
    if (!pose) {
      if (mood === 'celebrate') {
        p = 'jump';
        f = Math.floor(t / 0.22) % 3;
      } else if (mood === 'sleepy') {
        p = 'sleepy';
        f = Math.floor(t / 1.3) % 2;
      } else {
        f = Math.floor(t / 0.75) % 2;
        blink = t % 4.3 < 0.15;
      }
    } else f = anim ? Math.floor(t / 0.3) % POSE_FRAMES[p] : 0;
    const src = characterCanvas(look, p, f, blink);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    if (flip) {
      ctx.translate(cv.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  });
  return <canvas ref={ref} width={32} height={32} className={`px ${className}`} style={{ width: 32 * scale, height: 32 * scale, ...style }} />;
}

/** The night scene in a resizable container. */
export function SceneView({ state, className = '', style, children, onMoonHover }: { state: SceneState; className?: string; style?: CSSProperties; children?: ReactNode; onMoonHover?: (hover: { x: number; y: number } | null) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  useEffect(() => {
    const sc = new Scene(canvas.current!, state, 7);
    scene.current = sc;
    const ro = new ResizeObserver(() => {
      const r = wrap.current!.getBoundingClientRect();
      sc.resize(r.width, r.height);
    });
    ro.observe(wrap.current!);
    sc.start();
    return () => {
      ro.disconnect();
      sc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    scene.current?.setState(state);
  });
  return (
    <div
      ref={wrap}
      className={`scene-view ${className}`}
      style={style}
      onMouseMove={(e) => {
        if (!onMoonHover || !scene.current) return;
        const r = wrap.current!.getBoundingClientRect();
        const m = scene.current.moonCss();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        onMoonHover(Math.hypot(x - m.x, y - m.y) < m.r + 6 ? { x: m.x, y: m.y - m.r - 8 } : null);
      }}
      onMouseLeave={() => onMoonHover?.(null)}
    >
      <canvas ref={canvas} className="px" style={{ display: 'block' }} />
      {children}
    </div>
  );
}

/** The crow mascot: flies in and lands, or flies across. */
export function Crow({ mode = 'land', style, scale = 3, delay = 0 }: { mode?: 'land' | 'across' | 'perch'; style?: CSSProperties; scale?: number; delay?: number }) {
  const anim = store.settings.animations;
  const [phase, setPhase] = useState<'fly' | 'perch'>(anim && mode !== 'perch' ? 'fly' : 'perch');
  const [frame, setFrame] = useState(0);
  const [pos, setPos] = useState(anim && mode !== 'perch' ? 0 : 1);
  useEffect(() => {
    if (!anim || mode === 'perch') return;
    const start = performance.now() + delay;
    const dur = mode === 'across' ? 2600 : 900;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / dur));
      setPos(k);
      setFrame(Math.floor(now / 90) % 3);
      if (k < 1) raf = requestAnimationFrame(step);
      else if (mode === 'land') setPhase('perch');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [anim, mode, delay]);
  const [perchFrame, setPerchFrame] = useState(0);
  useEffect(() => {
    if (phase !== 'perch' || !anim) return;
    const id = window.setInterval(() => setPerchFrame((f) => (f + 1) % 6), 700);
    return () => window.clearInterval(id);
  }, [phase, anim]);
  const ease = 1 - Math.pow(1 - pos, 3);
  let transform = '';
  if (mode === 'land') transform = `translate(${(1 - ease) * 260}px, ${-(1 - ease) * 180}px)`;
  if (mode === 'across') transform = `translateX(${(1 - pos) * 110 - 10}vw)`;
  const src = phase === 'perch' ? crowPerchUrl(perchFrame === 5 ? 2 : perchFrame === 3 ? 1 : 0) : crowFlyUrl(frame);
  return <Pix src={src} scale={scale} className="crow" style={{ transform, ...style }} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumberField({ value, min, max, onChange, width = 80 }: { value: number; min: number; max: number; onChange: (v: number) => void; width?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      style={{ width }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Math.round(Number(text));
        const v = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
        setText(String(v));
        if (v !== value) onChange(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Card({ children, onClose, wide, className = '', style }: { children: ReactNode; onClose?: () => void; wide?: boolean; className?: string; style?: CSSProperties }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className={`card ${wide ? 'wide' : ''} ${className}`} style={style} role="dialog" aria-modal="true">
      {onClose && (
        <span className="card-x">
          <Btn small icon="close" kind="ghost" onClick={onClose} title="Close" />
        </span>
      )}
      {children}
    </div>
  );
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-v num">{value}</div>
      <div className="stat-l">{label}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}
