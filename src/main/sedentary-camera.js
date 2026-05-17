const { ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  FaceDetector,
  PoseLandmarker,
  FilesetResolver,
} = require('@mediapipe/tasks-vision');

let stream = null;
let timer = null;
let faceDetector = null;
let poseLandmarker = null;
let lastVideoTime = -1;

function toFileUri(dirOrFile) {
  const p = dirOrFile.endsWith(path.sep) ? dirOrFile : `${dirOrFile}${path.sep}`;
  return pathToFileURL(p).href;
}

async function initDetectors(wasmPath, faceModelPath, poseModelPath) {
  const wasmUri = toFileUri(wasmPath);
  const vision = await FilesetResolver.forVisionTasks(wasmUri);

  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: pathToFileURL(faceModelPath).href,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  });

  poseLandmarker = null;
  if (poseModelPath) {
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: pathToFileURL(poseModelPath).href,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }
}

function hasUpperBodyPose(poseResult) {
  const lm = poseResult?.landmarks?.[0];
  if (!lm || lm.length < 13) return false;
  const nose = lm[0];
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const vis = (p) => (p?.visibility ?? p?.presence ?? 1) > 0.45;
  return vis(nose) && (vis(leftShoulder) || vis(rightShoulder));
}

async function detectOnce(force = false) {
  const video = document.getElementById('video');
  if (!video?.videoWidth || !faceDetector) {
    return { ok: false, error: 'Kamera yoki MediaPipe tayyor emas' };
  }

  if (!force) {
    const t = video.currentTime;
    if (t === lastVideoTime) return null;
    lastVideoTime = t;
  } else {
    lastVideoTime = -1;
  }

  const ts = performance.now();
  const faceResult = faceDetector.detectForVideo(video, ts);
  const faceCount = faceResult.detections.length;
  let poseDetected = false;

  if (faceCount === 0 && poseLandmarker) {
    const poseResult = poseLandmarker.detectForVideo(video, ts);
    poseDetected = hasUpperBodyPose(poseResult);
  }

  const present = faceCount > 0 || poseDetected;
  const engine = poseLandmarker ? 'mediapipe+pose' : 'mediapipe';

  return {
    ok: true,
    present,
    faceCount,
    poseDetected,
    engine,
  };
}

async function detectPresence() {
  try {
    const r = await detectOnce(false);
    if (!r) return;
    ipcRenderer.send('sedentary:presence', r);
  } catch (err) {
    console.warn('[sedentary-camera] detect:', err.message);
  }
}

async function startCamera(cfg) {
  stopCamera();

  const { intervalSec, wasmPath, faceModelPath, modelPath, poseModelPath } =
    cfg || {};
  const facePath = faceModelPath || modelPath;

  if (!wasmPath || !facePath) {
    ipcRenderer.send('sedentary:camera-ready', {
      ok: false,
      error:
        'MediaPipe fayllari topilmadi. Terminalda: npm run mediapipe:setup',
    });
    return;
  }

  try {
    await initDetectors(wasmPath, facePath, poseModelPath || null);
  } catch (err) {
    ipcRenderer.send('sedentary:camera-ready', {
      ok: false,
      error: `MediaPipe: ${err.message || err}`,
    });
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    });
    const video = document.getElementById('video');
    video.srcObject = stream;
    await video.play();
    lastVideoTime = -1;

    const ms = Math.max(10, intervalSec || 20) * 1000;
    timer = setInterval(() => void detectPresence(), ms);
    void detectPresence();

    ipcRenderer.send('sedentary:camera-ready', {
      ok: true,
      engine: poseLandmarker ? 'mediapipe+pose' : 'mediapipe',
    });
  } catch (err) {
    faceDetector = null;
    poseLandmarker = null;
    ipcRenderer.send('sedentary:camera-ready', {
      ok: false,
      error: err.message || 'Kamera ochilmadi',
    });
  }
}

function stopCamera() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (stream) {
    stream.getTracks().forEach((tr) => tr.stop());
    stream = null;
  }
  if (faceDetector) {
    try {
      faceDetector.close();
    } catch {
      /* ignore */
    }
    faceDetector = null;
  }
  if (poseLandmarker) {
    try {
      poseLandmarker.close();
    } catch {
      /* ignore */
    }
    poseLandmarker = null;
  }
  lastVideoTime = -1;
}

ipcRenderer.on('sedentary:start', (_, cfg) => {
  void startCamera(cfg);
});

ipcRenderer.on('sedentary:stop', () => {
  stopCamera();
});

ipcRenderer.on('sedentary:test', async () => {
  try {
    const r = await detectOnce(true);
    ipcRenderer.send(
      'sedentary:test-result',
      r || { ok: false, error: 'Aniqlab bo‘lmadi' }
    );
  } catch (err) {
    ipcRenderer.send('sedentary:test-result', {
      ok: false,
      error: err.message || String(err),
    });
  }
});
