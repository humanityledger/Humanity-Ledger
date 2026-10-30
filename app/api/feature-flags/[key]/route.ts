import { NextRequest, NextResponse } from 'next/server';
import { getFlag } from '@/lib/feature-flags/index';
import { requireAdmin } from '@/lib/admin-guard';

// GET /api/feature-flags/[key]?wallet=0x...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const wallet   = req.nextUrl.searchParams.get('wallet') ?? '';

  try {
    const flag = await getFlag(key);
    if (!flag) return NextResponse.json({ enabled: false, reason: 'NOT_FOUND' });

    // Evaluate for this wallet
    const { evaluateFlag } = await import('@/lib/feature-flags/index');
    // Extract tier from session cookie if possible
    const tier = req.cookies.get('system_tier')?.value ?? 'STARTER';
    const enabled = await evaluateFlag(key, wallet, tier);

    return NextResponse.json({ enabled, flagKey: key, rollout: flag.rollout });
  } catch {
    return NextResponse.json({ enabled: false, reason: 'ERROR' });
  }
}

// POST /api/feature-flags/[key]  Admin only
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json();
  const { setFlag } = await import('@/lib/feature-flags/index');

  await setFlag({
    key,
    enabled:   body.enabled   ?? false,
    rollout:   body.rollout   ?? 0,
    allowlist: body.allowlist ?? [],
    tierGate:  body.tierGate  ?? 'ALL',
    axiom:     body.axiom     ?? 0,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, key });
}
