import { useEffect, useState } from 'react';
import { Logo } from '../kit';

export function Loading() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setK((v) => Math.min(8, v + 1)), 100);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', background: 'var(--g0)' }}>
      <div className="col" style={{ alignItems: 'center', gap: 18 }}>
        <Logo size={140} />
        <h1 style={{ fontSize: 40, letterSpacing: 10, color: 'var(--g4)' }}>ARRAZI</h1>
        <div className="row" style={{ gap: 4 }} aria-label="Loading">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} style={{ width: 12, height: 12, background: i < k ? 'var(--g4)' : 'var(--g1)', border: '2px solid var(--g2)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
