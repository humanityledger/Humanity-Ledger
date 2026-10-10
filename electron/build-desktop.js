#!/usr/bin/env node
/**
 * build-desktop.js
 * ─────────────────
 * Master build script: compiles Next.js → packages with Electron → outputs
 * installer + portable EXE to D:\proyectofinalizado.
 *
 * Usage: node electron/build-desktop.js
 */

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const OUTPUT = 'D:\\proyectofinalizado';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, label) {
  console.log(`\n⚡ ${label}…`);
  const result = spawnSync(cmd, { shell: true, cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n❌ Failed at: ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`✅ ${label} — done`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  fs.cpSync(src, dest, { recursive: true });
}

// ─── Step 0: Ensure output dir exists ────────────────────────────────────────
ensureDir(OUTPUT);
console.log(`\n🚀  Ledger Chat Desktop — Build Pipeline`);
console.log(`    Output → ${OUTPUT}`);
console.log('─'.repeat(55));

// ─── Step 1: Generate Prisma client ─────────────────────────────────────────
run('npx prisma generate', 'Prisma generate');

// ─── Step 2: Build Next.js for production ────────────────────────────────────
const nextBuildId = path.join(ROOT, '.next', 'BUILD_ID');
if (fs.existsSync(nextBuildId)) {
  console.log('\n✅ Next.js production build — already done (using cache)');
} else {
  run('npx cross-env NODE_OPTIONS="--max-old-space-size=4096" next build', 'Next.js production build');
}

// ─── Step 3: Prepare icons ────────────────────────────────────────────────────
const assetsDir = path.join(ROOT, 'electron', 'assets');
ensureDir(assetsDir);

// Copy public icon if it exists
const iconSrc = path.join(ROOT, 'public', 'icon.png');
const iconDest = path.join(ROOT, 'electron', 'icon.png');
if (fs.existsSync(iconSrc) && !fs.existsSync(iconDest)) {
  fs.copyFileSync(iconSrc, iconDest);
  console.log('📋 Copied icon.png to electron/');
}

// Create a placeholder .ico if needed (electron-builder converts PNG on macOS/Linux)
const icoDest = path.join(assetsDir, 'icon.ico');
if (!fs.existsSync(icoDest)) {
  // Copy the PNG — electron-builder on Windows requires .ico
  // We use the PNG as a stand-in; for production you'd convert it
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(assetsDir, 'icon.png'));
  }
  console.log('⚠️  No icon.ico found — using PNG. For production, add a proper .ico to electron/assets/');
}

// Create a minimal LICENSE.txt if missing
const licenseDest = path.join(assetsDir, 'LICENSE.txt');
if (!fs.existsSync(licenseDest)) {
  fs.writeFileSync(licenseDest, [
    'Ledger Chat Desktop',
    'Copyright © 2026 Humanity Ledger',
    '',
    'This software is provided for use by authorized users.',
    'All rights reserved.',
    '',
    'By installing this software you agree to the Terms of Service',
    'available at https://humanidfi.com/legal/terms',
  ].join('\n'));
}

// Create a minimal NSIS installer header if missing
const nshDest = path.join(assetsDir, 'installer.nsh');
if (!fs.existsSync(nshDest)) {
  fs.writeFileSync(nshDest, '; Ledger Chat NSIS installer customizations\n; Auto-generated — replace with branded installer script if desired.\n');
}

// ─── Step 4: Create .env.production (sanitised — no secrets) ─────────────────
const envProdPath = path.join(ROOT, '.env.production');
if (!fs.existsSync(envProdPath)) {
  // Only embed PUBLIC_ vars that don't contain secrets
  let envContent = '# Ledger Chat Desktop — Production Env\n';
  const localEnv = path.join(ROOT, '.env.local');
  if (fs.existsSync(localEnv)) {
    const lines = fs.readFileSync(localEnv, 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('NEXT_PUBLIC_')) envContent += line + '\n';
    }
  }
  envContent += 'NODE_ENV=production\n';
  fs.writeFileSync(envProdPath, envContent);
  console.log('📋 Created .env.production (public vars only)');
}

// ─── Step 5: Package with electron-builder ───────────────────────────────────
run(
  `npx electron-builder --config electron/build-config.json --win --x64 --publish=never`,
  'electron-builder package'
);

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(55));
console.log('🎉  BUILD COMPLETE!');
console.log(`📦  Output → ${OUTPUT}`);
console.log('');

try {
  const files = fs.readdirSync(OUTPUT);
  for (const f of files) {
    const size = fs.statSync(path.join(OUTPUT, f)).size;
    const mb   = (size / 1024 / 1024).toFixed(1);
    console.log(`    ${f.padEnd(50)} ${mb} MB`);
  }
} catch {
  console.log('    (Could not list output files)');
}

console.log('\n✅  You can now share the installer with your users!');
