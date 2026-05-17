#!/usr/bin/env node
/**
 * Copy notification MP3s into FocusFlow userData (no database).
 * Usage: node scripts/install-notification-sounds.js [sourceDir]
 * Sozlamaga yozish: npm run sounds:save
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SOURCE_DIR =
  process.argv[2] ||
  path.join(os.homedir(), 'Documents/HTML/Music');

const SOUNDS_DIR = path.join(
  os.homedir(),
  'Library/Application Support/focusflow/notification-sounds'
);

/** [fileHint, soundKey] — bir fayl bir nechta kalitga nusxalanishi mumkin */
const COPY_PAIRS = [
  ['01-task-5min', 'taskApproach5'],
  ['02-task-start', 'taskStarted'],
  ['02-task-start', 'focusStarted'],
  ['03-task-end', 'taskEnded'],
  ['03-task-end', 'sessionEnd'],
  ['04-break-5min', 'breakModeApproach5'],
  ['05-pomodoro-break', 'pomodoroBreak'],
  ['06-youtube', 'blockedYoutube'],
  ['07-telegram', 'blockedTelegram'],
  ['08-chrome', 'blockedChrome'],
  ['09-blocked-app', 'blockedApp'],
  ['10-pomodoro-work', 'pomodoroWork'],
  ['11-uy-ishi-lock', 'macLockUyIshlari'],
  ['12-sport-lock', 'macLockSport'],
  ['13-break-end', 'breakModeEnded'],
  ['14-long-break-start', 'longBreakStarted'],
  ['15-long-break-end', 'longBreakEnded'],
  ['04-break-5min', 'sedentaryWarn'],
];

function main() {
  const scriptDir = path.join(__dirname, '..');
  if (!fs.existsSync(path.join(scriptDir, 'package.json'))) {
    console.error('Xato: buyruqni focusflow papkasidan ishga tushiring:');
    console.error('  cd ~/Documents/HTML/focusflow');
    console.error('  npm run sounds:install');
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Manba papka topilmadi:', SOURCE_DIR);
    process.exit(1);
  }

  if (!fs.existsSync(SOUNDS_DIR)) {
    fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  }

  const copiedKeys = new Set();
  let copied = 0;

  for (const [fileHint, soundKey] of COPY_PAIRS) {
    const src = path.join(SOURCE_DIR, `${fileHint}.mp3`);
    if (!fs.existsSync(src)) {
      if (!copiedKeys.has(soundKey)) {
        console.warn('  skip (yo\'q):', `${fileHint}.mp3`, '→', soundKey);
      }
      continue;
    }
    const dest = path.join(SOUNDS_DIR, `${soundKey}.mp3`);
    fs.copyFileSync(src, dest);
    copiedKeys.add(soundKey);
    copied += 1;
    console.log('  ✓', soundKey, '←', path.basename(src));
  }

  console.log('\nNusxalandi:', copied, 'ta fayl →', SOUNDS_DIR);
  console.log('Keyingi qadam: npm run sounds:save');
}

main();
