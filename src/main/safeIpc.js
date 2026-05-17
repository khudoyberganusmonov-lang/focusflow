const { ipcMain } = require('electron');
const { isDatabaseReady } = require('./database');

function logIpcError(channel, err) {
  console.error(`[ipc] ${channel}:`, err?.message || err);
}

/**
 * Wraps ipcMain.handle with try/catch. Async handlers get rejected promises caught too.
 */
function safeHandle(channel, handler, fallback = null) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = handler(event, ...args);
      if (result && typeof result.then === 'function') {
        return await result;
      }
      return result;
    } catch (err) {
      logIpcError(channel, err);
      return typeof fallback === 'function' ? fallback(err) : fallback;
    }
  });
}

function requireDatabase(channel, fallback) {
  if (!isDatabaseReady()) {
    console.warn(`[ipc] ${channel}: database not available`);
    return fallback;
  }
  return undefined;
}

module.exports = { safeHandle, requireDatabase, logIpcError };
