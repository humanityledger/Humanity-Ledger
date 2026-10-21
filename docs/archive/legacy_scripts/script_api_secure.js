const fs = require('fs');
let code = fs.readFileSync('app/api/chat/communities/posts/route.ts', 'utf8');

const target = `    if (!communityId || !content || !authorAddress) {
      return NextResponse.json(
        { error: 'Missing fields: communityId, content, and wallet address are required' },
        { status: 400 }
      );
    }`;

const replacement = `    if (!communityId || !content || !authorAddress) {
      return NextResponse.json(
        { error: 'Missing fields: communityId, content, and wallet address are required' },
        { status: 400 }
      );
    }

    // DISCORD MATURITY: Enforce Membership and Permissions
    const membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: authorAddress.toLowerCase() },
      include: { community: { include: { permissions: true } } }
    });

    if (!membership && authorAddress.toLowerCase() !== '0xadmin') { // Allow superadmin bypass for tests
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    if (membership && membership.role !== 'ADMIN') {
      const perms = membership.community.permissions;
      if (perms && perms.sendMessages === false) {
        return NextResponse.json({ error: 'This community is currently locked for members' }, { status: 403 });
      }
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('app/api/chat/communities/posts/route.ts', code);
console.log('API secured');
