/**
 * One-off: rewrite CommunityPost.contentHtml as HTML-escaped plain text
 * (SEG-C3). Older rows may hold raw client HTML. Dry run by default.
 *
 *   npx tsx scripts/purge-community-contenthtml.ts           # count only
 *   npx tsx scripts/purge-community-contenthtml.ts --apply   # rewrite (take a DB backup first)
 */
import { PrismaClient } from '@prisma/client';
import { postBodyColumns } from '../lib/communities/postBody';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  let cursor: string | undefined;
  let scanned = 0, changed = 0;
  for (;;) {
    const rows = await prisma.communityPost.findMany({
      take: 100, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' }, select: { id: true, content: true, contentHtml: true },
    });
    if (!rows.length) break;
    for (const r of rows) {
      scanned++;
      const cols = postBodyColumns(r.content || '');
      const safe = cols ? cols.contentHtml : '';
      if (r.contentHtml !== safe) {
        changed++;
        if (APPLY) await prisma.communityPost.update({ where: { id: r.id }, data: { contentHtml: safe } });
      }
    }
    cursor = rows[rows.length - 1].id;
  }
  console.log(`${APPLY ? 'Rewrote' : 'Would rewrite'} ${changed} of ${scanned} community posts.`);
}

main().finally(() => prisma.$disconnect());
