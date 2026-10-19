import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 8,
        }}
      >
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
      </div>
    ),
    { ...size }
  );
}
