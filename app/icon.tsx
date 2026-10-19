import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          width: 32,
          height: 32,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            width="26"
            height="26"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              fontFamily: 'serif',
              fontSize: 18,
              fontWeight: 900,
              color: '#1C1C1E',
              letterSpacing: -1,
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
