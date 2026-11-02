import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializePassport } from '@/lib/passport/serialize';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug || !/^[a-zA-Z0-9_-]{4,64}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid passport id' }, { status: 400 });
  }

  const passport = await prisma.productPassport.findUnique({
    where: { publicSlug: slug },
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });

  if (!passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 });
  }

  return NextResponse.json(serializePassport(passport), {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
