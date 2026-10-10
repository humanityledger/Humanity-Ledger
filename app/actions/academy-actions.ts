"use server";

import prisma from "@/lib/prisma";
import { ALL_MODULES, TOPIC_CATEGORIES } from "@/lib/data/academy-curriculum";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

export async function syncAcademySyllabusToDB() {
    try {
                const session = await getSession();
        if (!session?.userId || !isAdmin(session.userId)) {
            throw new Error("UNAUTHORIZED: System Admin Only");
        }
        let syncedCount = 0;
        
        for (const category of TOPIC_CATEGORIES) {
            // Upsert Course (Topic Category)
            const slug = category.toLowerCase().replace(/[^a-z0-9]/g, "-");
            const course = await prisma.course.upsert({
                where: { slug },
                update: { title: category },
                create: {
                    slug,
                    title: category,
                    description: `System Grid Domain: ${category}`,
                    totalDuration: "TBD",
                    level: "Institutional"
                }
            });

            // Get static modules falling under this category
            const relatedModules = ALL_MODULES.filter(m => m.category === category);
            
            for (let i = 0; i < relatedModules.length; i++) {
                const mod = relatedModules[i];
                // Check if lesson exists by title (or original ID mapped to title)
                const existing = await prisma.lesson.findFirst({
                    where: { courseId: course.id, title: mod.title }
                });

                if (!existing) {
                    await prisma.lesson.create({
                        data: {
                            id: mod.id, // Enforce the same ID for deterministic PDF bindings
                            courseId: course.id,
                            title: mod.title,
                            description: mod.desc,
                            level: "Institutional",
                            duration: "1h",
                            orderIndex: i
                        }
                    });
                    syncedCount++;
                }
            }
        }
        
        return { ok: true, syncedCount };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

export async function getAcademyData(): Promise<any[]> {
    const courses = await (prisma.course.findMany as any)({
        include: {
            lessons: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    progress: true,
                    submissions: true
                }
            }
        }
    });
    return courses;
}

export async function getUserProgressAndSubmissions(walletAddress: string) {
    if (!walletAddress) return { progress: [], submissions: [] };
    const user = await (prisma.user.findUnique as any)({
        where: { walletAddress },
        include: { progress: true, submissions: true }
    });
    return { 
        progress: user?.progress || [], 
        submissions: user?.submissions || [] 
    };
}

export async function toggleLessonProgress(walletAddress: string, lessonId: string, completed: boolean) {
    if (!walletAddress) throw new Error("Unauthenticated");
    
    // Auto-create user if missing (for demo logic robustness)
    const user = await prisma.user.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress }
    });

    if (completed) {
        await prisma.userProgress.upsert({
            where: { userId_lessonId: { userId: user.id, lessonId } },
            update: { completed: true, timestamp: new Date() },
            create: { userId: user.id, lessonId, completed: true }
        });
    } else {
        await prisma.userProgress.deleteMany({
            where: { userId: user.id, lessonId }
        });
    }
    return { ok: true };
}

export async function submitProofOfWork(walletAddress: string, lessonId: string, proofUrl: string, txHash: string) {
    if (!walletAddress) throw new Error("Unauthenticated");
    
    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) throw new Error("User not registered");

    const submission = await (prisma as any).academySubmission.create({
        data: {
            userId: user.id,
            lessonId,
            contentUrl: proofUrl,
            txHash,
            status: "PENDING"
        }
    });

    return { ok: true, submission };
}

