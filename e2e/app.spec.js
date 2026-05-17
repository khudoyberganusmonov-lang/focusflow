// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('FocusFlow Electron', () => {
  test('ilova ochiladi', async () => {
    const { _electron: electron } = require('playwright');
    const appRoot = path.join(__dirname, '..');

    const app = await electron.launch({
      args: [appRoot],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '',
      },
    });

    try {
      const window = await app.firstWindow({ timeout: 90_000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 90_000 });
      const title = await window.title();
      expect(title.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
