const { protocol } = require('electron');
const appsCatalog = require('./appsCatalog');

function registerIconScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app-icon',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true,
      },
    },
  ]);
}

function iconUrlForBundle(bundlePath) {
  if (!bundlePath) return null;
  return `app-icon://icon?path=${encodeURIComponent(bundlePath)}`;
}

async function registerIconProtocol() {
  protocol.handle('app-icon', async (request) => {
    try {
      const url = new URL(request.url);
      const encoded = url.searchParams.get('path');
      if (!encoded) {
        return new Response(null, { status: 404 });
      }
      const bundlePath = decodeURIComponent(encoded);
      const png = await appsCatalog.getIconPngBuffer(bundlePath);
      if (!png || !png.length) {
        return new Response(null, { status: 404 });
      }
      const body = png instanceof Uint8Array ? png : new Uint8Array(png);
      return new Response(body, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, max-age=604800',
        },
      });
    } catch (err) {
      console.warn('[app-icon] protocol:', err.message);
      return new Response(null, { status: 404 });
    }
  });
}

module.exports = {
  registerIconScheme,
  registerIconProtocol,
  iconUrlForBundle,
};
