const path = require('path');
const os = require('os');
const fs = require('fs');
const { app } = require('electron');

const USER_DATA = path.join(
  os.homedir(),
  'Library/Application Support/focusflow'
);

app.whenReady().then(() => {
  app.setPath('userData', USER_DATA);

  const settingsService = require('../src/main/settingsService');
  const { initDatabase, isDatabaseReady } = require('../src/main/database');
  const { SOUND_KEYS } = require('../src/shared/notificationSoundCatalog.cjs');

  initDatabase();
  settingsService.init();

  if (!isDatabaseReady()) {
    console.error('Database not ready — avval FocusFlow ni bir marta oching.');
    app.quit();
    process.exit(1);
  }

  const soundsDir = path.join(USER_DATA, 'notification-sounds');
  const sounds = {};

  for (const soundKey of SOUND_KEYS) {
    const p = path.join(soundsDir, `${soundKey}.mp3`);
    if (fs.existsSync(p)) {
      sounds[soundKey] = p;
    }
  }

  const current = settingsService.getSettings();
  settingsService.setAll({
    notificationSounds: { ...(current.notificationSounds || {}), ...sounds },
  });

  console.log('Sozlamaga yozildi:', Object.keys(sounds).length, 'ta ovoz');
  console.log('Kalitlar:', Object.keys(sounds).join(', '));
  app.quit();
});
