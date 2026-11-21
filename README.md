# Arrazi

Learn new skills, played like a game. A Windows desktop app (Electron) where you add what you want
to learn as a **project**, split it into **missions** and **chapters**, study each chapter with a
**Pomodoro timer**, and earn **EXP**, **ranks** and **coins** for your pixel-art character.

Everything is drawn in code in the five grays of the reference picture
(`#0b0b0b #1e1e1e #6c6c6c #a8a8a8 #e6e6e6`): the night scene, moon, crows, character, items,
badges, bosses and buildings. The logo is traced from the design document.

## Run it

Download one of the builds:

- `Arrazi-1.0.0-portable.exe`: one file, nothing to install. Double-click to start.
- `Arrazi-1.0.0-win-x64.zip`: extract anywhere and run `Arrazi.exe` (starts faster than the portable exe).

The builds are not code-signed, so Windows SmartScreen may say "Windows protected your PC".
Click **More info → Run anyway**.

Data is saved in `%APPDATA%\Arrazi\data` (one JSON file per player plus `app.json`), automatically
after every change. Settings → Data exports and imports backups.

## Build from source

Requires Node.js 22+.

```bash
npm install
npm start            # build and run the app
npm test             # unit tests for the game rules (EXP, ranks, coins, streaks, seasons, timer)
npm run typecheck
npm run dist         # on Windows: installer (NSIS) + portable exe + zip in release/
npm run dist:portable  # portable exe + zip only (also works on Linux without Wine)
npm run preview      # single-file browser build in preview/ (saves to localStorage)
npm run icons        # regenerate build/icon.ico (16-256 px) and tray icons from the logo
```

## What is in it

| Area | Status |
| --- | --- |
| Home: logo, Player / Record / Settings icons, last-player card | ✓ |
| Several players per PC, add / delete (typed confirmation, backup first), optional 4-digit PIN | ✓ |
| Character builder and wardrobe: body, 8 hairstyles, 5 hair shades, top, bottom, shoes, head, face, neck, wrists, held item, back item, prop, background | ✓ |
| Stats: rank + tier badge, lifetime level, prestige stars, EXP bar, coins, animated character (idle, studying, stretching, celebrating, sleepy), Today, personal bests, focus graph (week / month / year), days accessed, 53×7 year heatmap with hover, streak + freezes | ✓ |
| Projects → missions → chapters, difficulty, resources, estimated Pomodoros, per-project / mission / chapter Pomodoro overrides, drag to reorder, lock missions in order, focus time per level, "What I learned" notes (+5 EXP), untick takes EXP back | ✓ |
| Side quests sorted by due date with overdue warning | ✓ |
| Pomodoro: 25/5/25 ×4 by default, presets (Classic, Deep work, Quick, your own), pause / resume / skip / +5 min / stop, auto-start, set bonus, "Is the chapter finished?" | ✓ |
| Clock-based timer (no drift), survives sleep and restarts; steps that ended while asleep alert on wake | ✓ |
| Windows toast notifications with Start / Skip / +5 min buttons, pop-up to the front, mini always-on-top timer, tray icon with step and time left | ✓ |
| EXP rules and fair play (1 EXP per running minute, +20 set bonus only if every session ≥ 15 min, half EXP after 10 finishes a day, streak ×1.1 / ×1.25 / ×1.5) | ✓ |
| 10 ranks × 3 tiers with `50 + 30·k^1.5` EXP per level, rank coins, one exclusive item per rank | ✓ |
| Monthly seasons named after the full moon (scene weather + exclusive item), 3-tier drop (6 in Ranked mode), season rewards, prestige | ✓ |
| Weekly boss (8 bosses, HP = weekly focus goal, fight animation after each work session, rewards or it laughs and leaves) | ✓ |
| Blood Moon night (EXP ×2) and 3 monthly challenges | ✓ |
| A world that grows: each project builds a building (tower, stage, yard, library…), lit windows per finished mission, a crow on the roof when done | ✓ |
| Shop: gym, music and cybersecurity collections, hair, backgrounds, full sets with bonus animations, streak freezes | ✓ |
| 27 achievements (8,210 coins), hidden ones, progress on locked badges, crow delivers each badge | ✓ |
| Record: leaderboard this week / month / all time, weekly "Top focuser" and "Streak keeper" badges, read-only player summary | ✓ |
| Settings: animations, sounds (synthesised bell, chime, gong, crow call, wood block), volume, night ambience, notifications, pop-up, mini timer, Pomodoro defaults, day start time, start with Windows, minimize to tray, PINs, backup, reset player | ✓ |

## Choices made where the spec left room

- **Heatmap shading**: on the dark night panels, more focus is shown *brighter* (empty outline = not
  opened, dim square = opened without focus, then mid gray to moon white). Darker-on-dark squares
  would be invisible.
- **Fonts**: Tiny5 for UI text and numbers and Jersey 10 for big headings (both SIL Open Font License).
  Pixelify Sans was tried first but its 5 looks like an S at small sizes.
- **Skip** on a step-end card skips the step that is about to start (after work: skip the break;
  after a break: skip that work session). **+5 min** continues the step that just ended.
- **Season item**: earned by reaching Adventurer during that month. The season coin reward needs any
  EXP earned that month.
- **Boss reward**: 300 coins, 100 EXP and the boss's item the first time (150 extra coins on repeats).
- **Early Crow** counts work sessions finished between 4:00 and 7:00 (Night Owl covers midnight to 4:00).
- **Full outfit sets** cost less when you already own some of their pieces (minimum 300 coins).
- **Weekly leaderboard badges** need at least two players on the PC.
- **Starter path**: the Cybersecurity example from the document can be added in one click
  (Projects → Starter path). It was listed as a future idea; it is handy for trying the app.

## Project layout

```
src/main/          Electron main process (windows, storage, toasts, tray, mini timer) and preload bridge
src/renderer/core/ game rules: types, EXP/ranks, catalog, achievements, stats, timer engine (unit tested)
src/renderer/art/  pixel art drawn in code: character paper doll, scene, buildings, badges, bosses, icons
src/renderer/ui/   React screens and cards
tests/             vitest unit tests
scripts/           esbuild build, icon generation, exe icon/version patch (no Wine needed)
```
