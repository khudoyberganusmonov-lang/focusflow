const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '../assets');
fs.mkdirSync(assetsDir, { recursive: true });

// Minimal 512x512 blue PNG (FocusFlow placeholder)
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAADklEQVQYV2NkYGD4z8DAwMgABXgBD2VqJqkAAAAASUVORK5CYII=';

const iconPng = path.join(assetsDir, 'icon.png');
const trayPng = path.join(assetsDir, 'tray-icon.png');
const dmgBg = path.join(assetsDir, 'dmg-background.png');

fs.writeFileSync(iconPng, Buffer.from(pngBase64, 'base64'));
fs.copyFileSync(iconPng, trayPng);
fs.copyFileSync(iconPng, dmgBg);

// Generate .icns on macOS using sips + iconutil
if (process.platform === 'darwin') {
  const iconset = path.join(assetsDir, 'icon.iconset');
  fs.mkdirSync(iconset, { recursive: true });

  const sizes = [16, 32, 64, 128, 256, 512];
  for (const size of sizes) {
    const out = path.join(iconset, `icon_${size}x${size}.png`);
    execSync(
      `sips -z ${size} ${size} "${iconPng}" --out "${out}" 2>/dev/null || cp "${iconPng}" "${out}"`,
      { stdio: 'ignore' }
    );
    if (size <= 256) {
      const out2x = path.join(iconset, `icon_${size}x${size}@2x.png`);
      const d = Math.min(size * 2, 512);
      execSync(
        `sips -z ${d} ${d} "${iconPng}" --out "${out2x}" 2>/dev/null || cp "${iconPng}" "${out2x}"`,
        { stdio: 'ignore' }
      );
    }
  }

  try {
    execSync(`iconutil -c icns "${iconset}" -o "${path.join(assetsDir, 'icon.icns')}"`, {
      stdio: 'ignore',
    });
    fs.rmSync(iconset, { recursive: true, force: true });
  } catch {
    fs.copyFileSync(iconPng, path.join(assetsDir, 'icon.icns'));
  }
} else {
  fs.copyFileSync(iconPng, path.join(assetsDir, 'icon.icns'));
}

console.log('Assets generated in assets/');
