import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';
import { store } from './store';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
const started = Date.now();
void store.load().then(() => {
  // keep the loading screen up briefly so the logo is seen, then go home
  window.setTimeout(() => {
    if (store.route.name === 'loading') store.go(store.app.timer ? { name: 'focus' } : { name: 'home' });
  }, Math.max(0, 900 - (Date.now() - started)));
});

// expose the store to automated tests of the browser preview build
if (__PREVIEW__) (window as unknown as { __arrazi: typeof store }).__arrazi = store;
