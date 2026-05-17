let sentry = null;
let enabled = false;

function init() {
  const dsn =
    process.env.SENTRY_DSN ||
    process.env.FOCUSFLOW_SENTRY_DSN ||
    '';

  if (!dsn) {
    console.log('[sentry] DSN yo‘q — xato yuborish o‘chiq');
    return;
  }

  try {
    sentry = require('@sentry/electron/main');
    const pkg = require('../../package.json');
    sentry.init({
      dsn,
      release: `${pkg.name}@${pkg.version}`,
      environment: require('electron').app.isPackaged ? 'production' : 'development',
    });
    enabled = true;
    console.log('[sentry] yoqilgan');
  } catch (err) {
    console.warn('[sentry] init:', err.message);
  }
}

function captureException(err, context) {
  if (!enabled || !sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* ignore */
  }
}

module.exports = {
  init,
  captureException,
  isEnabled: () => enabled,
};
