import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
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
      </div>
    ),
    { ...size }
  );
}
