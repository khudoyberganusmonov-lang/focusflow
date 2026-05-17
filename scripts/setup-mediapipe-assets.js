#!/usr/bin/env node
/**
 * Copy MediaPipe WASM + download face & pose models into assets/mediapipe.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'mediapipe');
const WASM_SRC = path.join(
  ROOT,
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm'
);

const DOWNLOADS = [
  [
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
    'blaze_face_short_range.tflite',
  ],
  [
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    'pose_landmarker_lite.task',
  ],
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
    console.error('focusflow papkasidan ishga tushiring.');
    process.exit(1);
  }
  if (!fs.existsSync(WASM_SRC)) {
    console.error('Avval: npm install @mediapipe/tasks-vision');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const wasmOut = path.join(OUT, 'wasm');
  console.log('WASM nusxalanmoqda...');
  copyDir(WASM_SRC, wasmOut);

  for (const [url, filename] of DOWNLOADS) {
    const dest = path.join(OUT, filename);
    if (!fs.existsSync(dest)) {
      console.log('Yuklanmoqda:', filename);
      await download(url, dest);
    } else {
      console.log('Allaqachon bor:', filename);
    }
  }

  console.log('Tayyor:', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
