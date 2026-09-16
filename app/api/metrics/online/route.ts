import { NextResponse } from 'next/server';

export const revalidate = 60; // Cache for 60 seconds across all users

export async function GET() {
  const hour = new Date().getUTCHours();
  const baseCount = 2000 + Math.sin(hour * Math.PI / 12) * 800;
  const jitter = Math.floor(Math.random() * 50) - 25;
  const count = Math.floor(baseCount + jitter);
  
  return NextResponse.json({ online: true, count, ts: Date.now() });
}