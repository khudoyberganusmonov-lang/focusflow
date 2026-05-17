const { ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');
const { Howl } = require('howler');

let current = null;

ipcRenderer.on('audio:play', (_, filePath) => {
  if (!filePath) return;
  try {
    if (current) {
      current.stop();
      current.unload();
    }
    const src = filePath.startsWith('file:')
      ? filePath
      : pathToFileURL(filePath).href;
    current = new Howl({
      src: [src],
      volume: 1,
      html5: false,
      onend: () => ipcRenderer.send('audio:ended'),
      onloaderror: (_, err) =>
        ipcRenderer.send('audio:error', String(err || 'load error')),
      onplayerror: (_, err) =>
        ipcRenderer.send('audio:error', String(err || 'play error')),
    });
    current.play();
  } catch (err) {
    ipcRenderer.send('audio:error', err.message || String(err));
  }
});

ipcRenderer.send('audio:ready');
