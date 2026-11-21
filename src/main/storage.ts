// Everything is saved on this computer: one JSON file per player plus app.json.
// Writes are atomic (temp file + rename) and the previous version is kept as .bak.
import fs from 'node:fs';
import path from 'node:path';

export class Storage {
  readonly dir: string;
  readonly playersDir: string;

  constructor(root: string) {
    this.dir = path.join(root, 'data');
    this.playersDir = path.join(this.dir, 'players');
    fs.mkdirSync(this.playersDir, { recursive: true });
  }

  private write(file: string, data: string) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, data, 'utf8');
    if (fs.existsSync(file)) {
      try {
        fs.copyFileSync(file, `${file}.bak`);
      } catch {
        /* backup copy is best effort */
      }
    }
    fs.renameSync(tmp, file);
  }

  private read(file: string): string | null {
    for (const f of [file, `${file}.bak`]) {
      try {
        const s = fs.readFileSync(f, 'utf8');
        JSON.parse(s);
        return s;
      } catch {
        /* try the backup */
      }
    }
    return null;
  }

  static safeId(id: string) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  }

  loadAll() {
    const app = this.read(path.join(this.dir, 'app.json'));
    const players: string[] = [];
    for (const f of fs.readdirSync(this.playersDir)) {
      if (!f.endsWith('.json')) continue;
      const s = this.read(path.join(this.playersDir, f));
      if (s) players.push(s);
    }
    return { app, players, dataDir: this.dir };
  }

  saveApp(json: string) {
    JSON.parse(json);
    this.write(path.join(this.dir, 'app.json'), json);
  }

  savePlayer(id: string, json: string) {
    const safe = Storage.safeId(id);
    if (!safe) throw new Error('bad player id');
    JSON.parse(json);
    this.write(path.join(this.playersDir, `${safe}.json`), json);
  }

  deletePlayer(id: string) {
    const safe = Storage.safeId(id);
    if (!safe) return;
    const file = path.join(this.playersDir, `${safe}.json`);
    for (const f of [file, `${file}.bak`, `${file}.tmp`]) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
}
