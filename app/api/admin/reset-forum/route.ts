import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/admin';
import { requireAdmin } from '@/lib/admin-guard';

export async function POST(req: Request) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const session = await getSession();
    const address = session?.userId;
    if (!isAdmin(address)) {
        return NextResponse.json({ error: 'Unauthorized: System Admin Only' }, { status: 403 });
    }

    console.log('Resetting forum...');
    
    // Delete all posts
    await prisma.forumPost.deleteMany({});
    
    // Delete all topics
    await prisma.forumTopic.deleteMany({});
    
    // Delete all users who are not admins (isAdmin field exists in schema; @ts-ignore covers stale generated types)
    await prisma.user.deleteMany({
      where: { isAdmin: false } as any
    });

    // Find the admin user
    const admin = await prisma.user.findFirst({
      where: { isAdmin: true } as any
    });

    if (!admin) {
      return NextResponse.json({ success: false, error: 'No admin found to author the welcome post.' });
    }

    // Ensure a category exists
    let category = await prisma.forumCategory.findFirst();
    if (!category) {
      category = await prisma.forumCategory.create({
        data: {
          name: 'General',
          slug: 'general',
          description: 'General discussion',
          color: '#00C076',
          orderIndex: 0
        }
      });
    }

    const welcomeContent = `Welcome to the newly reorganized System Forum!

Here you will find a premium, secure environment for sovereign discussion and analytics sharing.

### Key Features
1. **Sovereign Grid**: Deep-dive analysis and structured data.
2. **Active Feed**: Real-time discussions and updates.
3. **Recent Profiles**: Track new system identities joining the network.
4. **Highest Yield**: The most valuable and upvoted analytics.

Please explore the settings panel to configure your preferences, and maintain professionalism at all times.`;

    // Create the welcome topic
    await prisma.forumTopic.create({
      data: {
        title: 'Welcome to the System Network',
        content: welcomeContent,
        authorId: admin.id,
        categoryId: category.id,
        views: 0,
        isPinned: true
      }
    });

    return NextResponse.json({ success: true, message: 'Forum reset successfully. 65 fictitious users deleted and welcome message created.' });
  } catch (error: any) {
    console.error('Error resetting forum:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
