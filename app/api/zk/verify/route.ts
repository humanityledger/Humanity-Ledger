import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: '410 Gone: Mock ZK endpoints have been decommissioned for sovereign security.' }, { status: 410 });
} 
export async function GET() {
  return NextResponse.json({ error: '410 Gone: Mock ZK endpoints have been decommissioned for sovereign security.' }, { status: 410 });
}
