const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const worldmapPath = path.join(__dirname, '..', 'public', 'worldmap.png');
  const { data, info } = await sharp(worldmapPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const out = Buffer.alloc(width * height * 4);
  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const brightness = (r + g + b) / 3;

      // Invert brightness to alpha: 255 (white) -> 0 alpha, 0 (black) -> 255 alpha
      const alpha = Math.max(0, Math.min(255, 255 - brightness));
      out[idx] = 18;     // Rich dark (#121212)
      out[idx+1] = 18;
      out[idx+2] = 18;
      out[idx+3] = alpha > 25 ? alpha : 0;

      if (alpha > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX;
  const cropH = maxY - minY;

  // 1. Trimmed transparent world map buffer
  const trimmedWorldMapBuffer = await sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const publicDir = path.join(__dirname, '..', 'public');
  fs.writeFileSync(path.join(publicDir, 'worldmap-transparent.png'), trimmedWorldMapBuffer);

  // 2. Square icon (e.g. 512x512) with transparent world map in center
  const mapInIcon512 = await sharp(trimmedWorldMapBuffer)
    .resize(460, Math.round(460 * (cropH / cropW)), { fit: 'inside' })
    .toBuffer();

  const icon512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    }
  })
    .composite([{ input: mapInIcon512, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
  fs.writeFileSync(path.join(publicDir, 'logo-mark.png'), icon512);
  fs.writeFileSync(path.join(publicDir, 'logo-mark-tight.png'), trimmedWorldMapBuffer);

  // 3. Smaller icons (192, 180 apple touch, 32 favicon)
  const icon192 = await sharp(icon512).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);

  // Apple touch icon: white background (Apple requires non-transparent)
  const appleTouch = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{
      input: await sharp(trimmedWorldMapBuffer).resize(140, 70, { fit: 'inside' }).toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);

  const favicon32 = await sharp(icon512).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favicon32);
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon32);

  // 4. Full horizontal logo: [World Map] "Humanity"
  // Let's create an SVG with the world map embedded as base64 + clean sans-serif text
  const mapBase64 = trimmedWorldMapBuffer.toString('base64');
  const fullLogoSvg = `
<svg width="600" height="120" viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,${mapBase64}" x="10" y="24" width="140" height="72" preserveAspectRatio="xMidYMid meet" />
  <text x="168" y="76" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="52" font-weight="800" fill="#0A0A0A" letter-spacing="-1.5px">Humanity</text>
</svg>
  `.trim();

  const fullLogoPng = await sharp(Buffer.from(fullLogoSvg))
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'logo-text.png'), fullLogoPng);
  fs.writeFileSync(path.join(publicDir, 'logo-corporate.png'), fullLogoPng);

  console.log('Successfully generated all authentic world map assets!');
}

main().catch(console.error);
