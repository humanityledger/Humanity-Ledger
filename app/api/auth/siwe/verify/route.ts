import { NextRequest } from 'next/server';
import { POST as canonicalPost } from '@/app/api/siwe/verify/route';

/**
 * Compatibility bridge: forwards legacy /api/auth/siwe/verify calls
 * to the canonical /api/siwe/verify handler.
 */
export async function POST(req: NextRequest) {
  return canonicalPost(req);
}

export async function GET(req: NextRequest) {
  return canonicalPost(req);
}
