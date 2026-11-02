import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs'; // Node runtime needed for fs

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default async function Icon() {
  const logoData = await readFile(join(process.cwd(), 'public/logo-mark.png'));
  const base64Logo = logoData.toString('base64');
  const src = `data:image/png;base64,${base64Logo}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <img
          src={src}
          alt="HL"
          style={{ width: '80%', objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
