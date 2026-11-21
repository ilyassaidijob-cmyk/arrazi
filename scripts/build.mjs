// Bundles the Electron main process, preload and the React renderer with esbuild.
//   node scripts/build.mjs            -> dist/ (used by `electron .` and electron-builder)
//   node scripts/build.mjs --preview  -> preview/arrazi-preview.html (single-file browser build)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const preview = process.argv.includes('--preview');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const define = {
  'process.env.NODE_ENV': '"production"',
  __APP_VERSION__: JSON.stringify(pkg.version),
  __PREVIEW__: 'false',
};

async function buildElectron() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'renderer'), { recursive: true });
  await esbuild.build({
    entryPoints: { main: 'src/main/main.ts', preload: 'src/main/preload.ts' },
    absWorkingDir: root,
    outdir: dist,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    define,
    logLevel: 'warning',
  });
  await esbuild.build({
    entryPoints: { app: 'src/renderer/main.tsx', mini: 'src/renderer/mini.tsx' },
    absWorkingDir: root,
    outdir: path.join(dist, 'renderer'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome130',
    jsx: 'automatic',
    loader: { '.woff2': 'file', '.woff': 'file', '.svg': 'text' },
    assetNames: 'assets/[name]-[hash]',
    minify: true,
    sourcemap: false,
    define,
    logLevel: 'warning',
  });
  for (const f of ['index.html', 'mini.html']) {
    fs.copyFileSync(path.join(root, 'src/renderer', f), path.join(dist, 'renderer', f));
  }
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  for (const f of ['icon.png', 'tray.png', 'tray@2x.png', 'tray.ico']) {
    fs.copyFileSync(path.join(root, 'assets', f), path.join(dist, 'assets', f));
  }
  fs.copyFileSync(path.join(root, 'build', 'icon.ico'), path.join(dist, 'assets', 'icon.ico'));
  console.log('built dist/');
}

async function buildPreview() {
  const out = path.join(root, 'preview');
  fs.mkdirSync(out, { recursive: true });
  const result = await esbuild.build({
    entryPoints: ['src/renderer/main.tsx'],
    absWorkingDir: root,
    bundle: true,
    write: false,
    outdir: out,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.svg': 'text' },
    minify: true,
    define: { ...define, __PREVIEW__: 'true' },
    logLevel: 'warning',
  });
  const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
  const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const html = fs
    .readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, '')
    .replace('<link rel="stylesheet" href="app.css" />', () => `<style>${css}</style>`)
    .replace('<script src="app.js"></script>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  fs.writeFileSync(path.join(out, 'arrazi-preview.html'), html);
  console.log('built preview/arrazi-preview.html', Math.round(html.length / 1024), 'KB');
}

if (preview) await buildPreview();
else await buildElectron();
