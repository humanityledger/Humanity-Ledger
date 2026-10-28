import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ALL_MODULES, TOPIC_CATEGORIES } from '@/lib/data/academy-curriculum';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/academy/sync
 * Idempotent: seeds the academy syllabus from static curriculum data.
 * Replaces the Server Action syncAcademySyllabusToDB.
 */
export async function POST(req: NextRequest) {
    // Seeding runs dozens of database writes, so it needs an account and is
    // limited; anyone could otherwise loop it to load the database.
    const caller = await getVerifiedCaller(req);
    if (!caller) {
        return NextResponse.json({ ok: false, error: 'Sign in to sync the syllabus.' }, { status: 401 });
    }
    const rl = await checkRateLimit(caller, { max: 3, windowSec: 3600, prefix: 'rl:academy-sync' });
    if (!rl.allowed) {
        return NextResponse.json({ ok: false, error: 'Too many sync requests. Try again later.' }, { status: 429 });
    }
    try {
        let syncedCount = 0;

        for (const category of TOPIC_CATEGORIES) {
            const slug = category.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const course = await prisma.course.upsert({
                where:  { slug },
                update: { title: category },
                create: {
                    slug,
                    title:         category,
                    description:   `System Grid Domain: ${category}`,
                    totalDuration: 'TBD',
                    level:         'Institutional',
                },
            });

            const relatedModules = ALL_MODULES.filter(m => m.category === category);
            for (let i = 0; i < relatedModules.length; i++) {
                const mod = relatedModules[i];
                const existing = await prisma.lesson.findFirst({
                    where: { courseId: course.id, title: mod.title },
                });
                if (!existing) {
                    await prisma.lesson.create({
                        data: {
                            id:          mod.id,
                            courseId:    course.id,
                            title:       mod.title,
                            description: mod.desc,
                            level:       'Institutional',
                            duration:    '1h',
                            orderIndex:  i,
                        },
                    });
                    syncedCount++;
                }
            }
        }

        return NextResponse.json({ ok: true, syncedCount });
    } catch (e: any) {
        console.error('[Academy Sync]', e);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
