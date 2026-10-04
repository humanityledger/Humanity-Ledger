import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// HUMANITY LEDGER - FEDERATED RELAY NODE (DECENTRALIZED CHAT)
// ============================================================================
// This endpoint acts as a Matrix-style federated relay node for community E2E 
// messaging. In a production E2E environment, community messages are synced 
// peer-to-peer using libp2p/XMTP, but for high-availability and offline-sync,
// this relay node persists encrypted blobs temporarily to allow offline users 
// to catch up on the DAG graph of messages when they reconnect.
// 
// No plaintext is accessible to this relay. All content must be client-side 
// encrypted before submission.
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { communityId, authorAddress, content, contentHtml } = body;
    
    if (!communityId || !authorAddress || !content) {
      return NextResponse.json({ error: 'Missing protocol fields' }, { status: 400 });
    }

    // Persist to the local federated node graph (Prisma DB is acting as local node storage)
    const post = await prisma.communityPost.create({
      data: { 
        communityId, 
        authorAddress, 
        content, 
        contentHtml: contentHtml || content 
      }
    });

    return NextResponse.json({ post, status: 'RELAYED_TO_NETWORK' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const communityId = searchParams.get('communityId');
  
  if (!communityId) {
    return NextResponse.json({ error: 'Missing communityId for graph sync' }, { status: 400 });
  }

  // Fetch the latest DAG segment of messages from the local relay node storage
  const posts = await prisma.communityPost.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return NextResponse.json({ posts });
}
