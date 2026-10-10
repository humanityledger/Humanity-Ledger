import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compileGraph, NodeData, EdgeData } from '@/lib/engine/compiler';
import { runEngineTopology } from '@/lib/engine/runtime';

/**
 * HEARTBEAT ORCHESTRATOR
 * Triggered via CRON every 1 minute.
 * Securing the endpoint with a CRON_SECRET is required in production.
 */
export async function POST(req: Request) {
    // 1. Cron Authentication
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'local-mocker-key'}`) {
        if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized CRON heartbeat' }, { status: 401 });
        }
    }

    try {
        // VULN FIX: Avoid OOM by chunking. We process the oldest 100 topologies first in a round-robin fashion.
        const spaces = await prisma.canvasState.findMany({
            take: 100,
            orderBy: { lastSyncedAt: 'asc' }
        });

        const results = [];

        // 3. Process concurrently
        for (const space of spaces) {
            try {
                // Parse JSON from Postgres - Handle nested stringification cases
                let parsedNodes = space.nodes;
                let parsedEdges = space.edges;
                
                if (typeof parsedNodes === 'string') parsedNodes = JSON.parse(parsedNodes);
                if (typeof parsedEdges === 'string') parsedEdges = JSON.parse(parsedEdges);

                const nodes: NodeData[] = Array.isArray(parsedNodes) ? (parsedNodes as any as NodeData[]) : [];
                const edges: EdgeData[] = Array.isArray(parsedEdges) ? (parsedEdges as any as EdgeData[]) : [];

                // Skip executing completely empty dashboards to save compute
                // A minimum topology requires at least one node to "run"
                if (nodes.length === 0) continue;

                // Mark the start of a new heartbeat visually in logs (optional, but good for debugging)
                await (prisma as any).systemEvent.create({
                    data: {
                        userId: space.userId,
                        level: 'info',
                        source: 'engine:cron',
                        message: '=== CRON HEARTBEAT INITIATED ==='
                    }
                });

                // Compile into DAG
                const compiled = compileGraph(nodes, edges);

                // Execute the Runtime environment
                const result = await runEngineTopology(compiled);

                // Flush logs to Postgres safely using Prisma
                if (result.logs.length > 0) {
                    await (prisma as any).systemEvent.createMany({
                        data: result.logs.map(log => ({
                            userId: space.userId,
                            level: log.level,
                            source: log.source, // 'engine' or 'node:xx'
                            message: log.message,
                        }))
                    });
                }

                // Update the round-robin timestamp so it goes to the back of the queue
                await prisma.canvasState.update({
                    where: { id: space.id },
                    data: { lastSyncedAt: new Date() }
                });

                results.push({ userId: space.userId, success: result.success, computed: true });
            } catch (err: any) {
                // Failsafe per-user so one broken topology doesn't crash the whole global heartbeat loop
                await (prisma as any).systemEvent.create({
                    data: {
                        userId: space.userId,
                        level: 'error',
                        source: 'engine:kernel',
                        message: `Fatal topology constraint error: ${err.message}`
                    }
                });
                results.push({ userId: space.userId, success: false, computed: false });
            }
        }

        return NextResponse.json({
            status: 'success',
            message: `Heartbeat complete. Processed ${results.length} topological namespaces.`,
            data: results
        });
    } catch (e: any) {
        console.error("Deep Engine Failure:", e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
