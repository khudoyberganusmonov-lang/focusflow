const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

let audioWindow = null;
let ready = false;
const pending = [];

function registerIpc() {
  ipcMain.removeAllListeners('audio:ready');
  ipcMain.removeAllListeners('audio:ended');
  ipcMain.removeAllListeners('audio:error');

  ipcMain.on('audio:ready', () => {
    ready = true;
    while (pending.length) {
      const fp = pending.shift();
      if (audioWindow && !audioWindow.isDestroyed()) {
        audioWindow.webContents.send('audio:play', fp);
      }
    }
  });

  ipcMain.on('audio:error', (_, msg) => {
    console.warn('[soundPlayer]', msg);
  });
}

function ensureWindow() {
  if (audioWindow && !audioWindow.isDestroyed()) return audioWindow;

  registerIpc();
  ready = false;

  audioWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  audioWindow.on('closed', () => {
    audioWindow = null;
    ready = false;
  });

  audioWindow.loadFile(path.join(__dirname, 'audio-player.html'));
  return audioWindow;
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function playSound(filePath) {
  if (!filePath) return false;
  try {
    const win = ensureWindow();
    if (ready) {
      win.webContents.send('audio:play', filePath);
    } else {
      pending.push(filePath);
    }
    return true;
  } catch (err) {
    console.warn('[soundPlayer] play:', err.message);
    return false;
  }
}

function init() {
  registerIpc();
}

module.exports = {
  init,
  playSound,
};
