const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const FACE_MODEL = 'blaze_face_short_range.tflite';
const POSE_MODEL = 'pose_landmarker_lite.task';

function resourceRoot() {
  try {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'app.asar.unpacked');
    }
    return app.getAppPath();
  } catch {
    return path.join(__dirname, '..', '..');
  }
}

function devRoot() {
  try {
    return app.getAppPath();
  } catch {
    return path.join(__dirname, '..', '..');
  }
}

function buildCandidate(root) {
  const base = path.join(root, 'assets', 'mediapipe');
  return {
    wasmPath: path.join(base, 'wasm'),
    faceModelPath: path.join(base, FACE_MODEL),
    poseModelPath: path.join(base, POSE_MODEL),
  };
}

/**
 * @returns {{ wasmPath: string, faceModelPath: string, poseModelPath: string|null, modelPath: string } | null}
 */
function getMediaPipePaths() {
  const roots = [resourceRoot(), devRoot()];
  const extraWasm = path.join(
    devRoot(),
    'node_modules',
    '@mediapipe',
    'tasks-vision',
    'wasm'
  );

  const candidates = [];
  for (const root of roots) {
    candidates.push(buildCandidate(root));
  }
  candidates.push({
    wasmPath: extraWasm,
    faceModelPath: path.join(devRoot(), 'assets', 'mediapipe', FACE_MODEL),
    poseModelPath: path.join(devRoot(), 'assets', 'mediapipe', POSE_MODEL),
  });

  for (const c of candidates) {
    if (!fs.existsSync(c.wasmPath) || !fs.existsSync(c.faceModelPath)) continue;
    const poseModelPath = fs.existsSync(c.poseModelPath) ? c.poseModelPath : null;
    return {
      wasmPath: c.wasmPath,
      faceModelPath: c.faceModelPath,
      poseModelPath,
      modelPath: c.faceModelPath,
    };
  }
  return null;
}

module.exports = {
  getMediaPipePaths,
  FACE_MODEL,
  POSE_MODEL,
};
