/**
 * package-only.js — Only runs electron-builder packaging step.
 * Run this AFTER `npm run build` has already succeeded.
 * Usage: node electron/package-only.js
 */
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const OUTPUT = 'D:\\proyectofinalizado';

// Fix for "spawn powershell.exe ENOENT" inside electron-builder's npm parser
process.env.PATH += `;C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0`;

function run(cmd, label) {
  console.log(`\n⚡ ${label}…`);
  const result = spawnSync(cmd, { shell: true, cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n❌ Failed at: ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`✅ ${label} — done`);
}

// Verify .next exists
if (!fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
  console.error('❌ .next/BUILD_ID not found — run npm run build first');
  process.exit(1);
}

// Ensure output dir
if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });

// Prepare icon
const iconSrc  = path.join(ROOT, 'public', 'favicon.png');
const assetsDir = path.join(ROOT, 'electron', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const icoDest = path.join(assetsDir, 'icon.ico');
if (!fs.existsSync(icoDest) && fs.existsSync(iconSrc)) {
  const pngData = fs.readFileSync(iconSrc);
  const icondir = Buffer.alloc(6);
  icondir.writeUInt16LE(0, 0); icondir.writeUInt16LE(1, 2); icondir.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); entry.writeUInt8(0, 1); entry.writeUInt8(0, 2); entry.writeUInt8(0, 3);
  entry.writeUInt16LE(0, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngData.length, 8); entry.writeUInt32LE(22, 12);
  fs.writeFileSync(icoDest, Buffer.concat([icondir, entry, pngData]));
  console.log('✅ icon.ico created');
}

if (!fs.existsSync(path.join(assetsDir, 'LICENSE.txt'))) {
  fs.writeFileSync(path.join(assetsDir, 'LICENSE.txt'), 'Ledger Chat Desktop\nCopyright © 2026 Humanity Ledger\nAll rights reserved.\n');
}
if (!fs.existsSync(path.join(assetsDir, 'installer.nsh'))) {
  fs.writeFileSync(path.join(assetsDir, 'installer.nsh'), '; Ledger Chat installer\n');
}

const pkgPath = path.join(ROOT, 'package.json');
const pkgContent = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContent);

try {
  // Strip dependencies to prevent electron-builder from spawning npm/powershell 
  // since we only need the electron wrapper itself.
  const tempPkg = { ...pkg };
  delete tempPkg.dependencies;
  delete tempPkg.devDependencies;
  fs.writeFileSync(pkgPath, JSON.stringify(tempPkg, null, 2));

  console.log('\n🚀  Running electron-builder…');
  run(
    `npx electron-builder --config electron/build-config.json --win --x64 --publish=never`,
    'electron-builder Windows package'
  );
} finally {
  // Always restore original package.json
  fs.writeFileSync(pkgPath, pkgContent);
}

console.log('\n' + '═'.repeat(55));
console.log('🎉  PACKAGING COMPLETE!');
console.log(`📦  Output → ${OUTPUT}`);
try {
  const files = fs.readdirSync(OUTPUT);
  for (const f of files) {
    const stat = fs.statSync(path.join(OUTPUT, f));
    if (stat.isFile()) {
      const mb = (stat.size / 1024 / 1024).toFixed(1);
      console.log(`    ${f.padEnd(50)} ${mb} MB`);
    }
  }
} catch {}
console.log('\n✅  Share the installer with your users!');
