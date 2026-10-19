import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  let dataUrl = '';
  try {
    const filePath = path.join(process.cwd(), 'public', 'logo-mark-tight.png');
    const buffer = fs.readFileSync(filePath);
    dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 38,
        }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            width="144"
            height="144"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              fontFamily: 'serif',
              fontSize: 88,
              fontWeight: 900,
              color: '#1C1C1E',
              letterSpacing: -4,
            }}
          >
            HL
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
