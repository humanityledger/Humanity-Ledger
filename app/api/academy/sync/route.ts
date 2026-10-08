import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ALL_MODULES, TOPIC_CATEGORIES } from '@/lib/data/academy-curriculum';

export const dynamic = 'force-dynamic';

/**
 * POST /api/academy/sync
 * Idempotent: seeds the academy syllabus from static curriculum data.
 * Replaces the Server Action syncAcademySyllabusToDB.
 */
export async function POST() {
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
