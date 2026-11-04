// [EDGE-SAFE] Defer Node.js specific imports
// import Redis from 'ioredis';
// import dotenv from 'dotenv';

const isServer = typeof window === 'undefined';
const IS_EDGE = typeof process !== 'undefined' && process.env?.NEXT_RUNTIME === 'edge';

if (!IS_EDGE && isServer) {
    try {
        // Only run dotenv in non-edge Node environments
        // require('dotenv').config();
    } catch (e) {}
}

const memoryStore = new Map<string, any>();

function createMockRedis(name?: string) {
    return {
        on: () => {},
        get: async (k: string) => memoryStore.get(k) ?? null,
        // Honours NX and EX like Redis, so single-use markers (SET key 1 EX ttl NX)
        // behave the same with or without a real server.
        set: async (k: string, v: any, ...args: any[]) => {
            const flags = args.map((a) => String(a).toUpperCase());
            if (flags.includes('NX') && memoryStore.has(k)) return null;
            memoryStore.set(k, v);
            const ex = flags.indexOf('EX');
            if (ex !== -1 && Number(args[ex + 1]) > 0) {
                setTimeout(() => memoryStore.delete(k), Number(args[ex + 1]) * 1000).unref?.();
            }
            return 'OK';
        },
        setex: async (k: string, s: number, v: any) => {
            memoryStore.set(k, v);
            setTimeout(() => memoryStore.delete(k), s * 1000);
            return 'OK';
        },
        del: async (k: string) => {
            const r = memoryStore.has(k) ? 1 : 0;
            memoryStore.delete(k);
            return r;
        },
        //  Set operations (used by feature-flag index) 
        sadd: async (k: string, ...members: string[]) => {
            const set: Set<string> = memoryStore.get(k) || new Set();
            let added = 0;
            for (const m of members) { if (!set.has(m)) { set.add(m); added++; } }
            memoryStore.set(k, set);
            return added;
        },
        srem: async (k: string, ...members: string[]) => {
            const set: Set<string> = memoryStore.get(k) || new Set();
            let removed = 0;
            for (const m of members) { if (set.delete(m)) removed++; }
            memoryStore.set(k, set);
            return removed;
        },
        smembers: async (k: string) => {
            const set: Set<string> = memoryStore.get(k) || new Set();
            return Array.from(set);
        },
        // 
        psubscribe: async () => {},
        punsubscribe: async () => {},
        subscribe: async () => {},
        unsubscribe: async () => {},
        publish: async () => 0,
        status: 'mock',
        __isMock: true
    };
}

// Sanitize and reconstruct REDIS_URL
function getSanitizedRedisUrl(): string {
    const rawUrl = (process.env.REDIS_URL || '').toString().trim().replace(/^["']|["']$/g, '');
    
    // If properly formatted, return it
    if (rawUrl.startsWith('redis://') || rawUrl.startsWith('rediss://')) {
        return rawUrl;
    }

    // Do not guess proxy URL port to prevent silent ETIMEDOUT when port differs. Let the client fail fast.
    return rawUrl.includes('://') ? rawUrl : '';
}

const REDIS_URL = getSanitizedRedisUrl();

const IS_BUILDING = process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build' || process.env.NODE_ENV === 'test' || process.argv.join(' ').includes('next build') || (process.argv.some(arg => arg.endsWith('next') || arg.endsWith('next.js')) && process.argv.includes('build'));

/**
 * Elite-grade Redis Factory
 */
export function createRedisClient(config: { name?: string; isSubscriber?: boolean } = {}) {
    if (IS_EDGE) {
        console.warn(`[Redis:${config.name || 'Factory'}] ️ Edge Runtime detected. Skipping ioredis initialization.`);
        return createMockRedis(config.name);
    }

    if (IS_BUILDING) {
        console.warn(`[Redis:${config.name || 'Factory'}] ️ Build Phase detected. Skipping real Redis connection.`);
        return createMockRedis(config.name);
    }

    if (!REDIS_URL) {
        // Silent Mock-Mode transition
        return createMockRedis(config.name);
    }

    const Redis = require('ioredis').default || require('ioredis');
    const client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        keepAlive: 10000,
        pingInterval: 30000,
        reconnectOnError: (err: any) => {
            const targetError = "READONLY";
            if (err.message.includes(targetError) || err.message.includes("ECONNRESET")) {
                return true;
            }
            return false;
        },
        retryStrategy(times: number) {
            if (times > 10) return null;
            return Math.min(times * 1000, 5000);
        },
        ...config
    });
    client.on('error', (err: any) => {
        console.error(`[Redis:${config.name || 'Factory'}] Error:`, err.message);
    });
    return client;
}

let redisClient: any;
try {
    if (REDIS_URL && !IS_EDGE && !IS_BUILDING) {
        const Redis = require('ioredis').default || require('ioredis');
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false,
            keepAlive: 10000,
            pingInterval: 30000,
            reconnectOnError: (err: any) => {
                const targetError = "READONLY";
                if (err.message.includes(targetError) || err.message.includes("ECONNRESET")) {
                    return true;
                }
                return false;
            },
            retryStrategy(times: number) {
                if (times > 10) return null;
                return Math.min(times * 1000, 5000);
            }
        });

        redisClient.on('error', (err: any) => {
            if (!redisClient.__errorLogged) {
                const maskedUrl = (REDIS_URL || '').replace(/:\/\/[^@]*@/, '://***@');
                console.error(`[Redis:Main]  Critical Connection Failure for ${maskedUrl}:`, err.message);
                if (err.message.includes('ENOTFOUND')) {
                    console.error(`[Redis:Main]  DNS RESOLUTION FAILED. Check if host has invalid characters (e.g. underscores).`);
                }
                redisClient.__errorLogged = true;
            }
        });

        redisClient.on('connect', () => {
            redisClient.__errorLogged = false;
            const masked = (REDIS_URL || '').replace(/:\/\/[^@]*@/, '://***@');
            console.log(`[Redis:Main]  Status: LEGENDARY  Connected to cluster: ${masked}`);
        });
    } else {
        // [RESILIENCE] Never throw  a missing REDIS_URL must not kill the server process.
        // Features requiring Redis (rate-limiting, caching) will degrade gracefully.
        if (process.env.NODE_ENV === 'production') {
            console.info('[Redis:Initialization] System In-Memory Mock Mode Activated. Operating safely without Redis.');
        }
        redisClient = createMockRedis('FinalFallback');
    }
} catch (err: any) {
    console.error('️ [Redis:Initialization] Zero-Crash Safeguard Triggered.');
    console.error(` Error: ${err.message}`);
    
    // Diagnostic Helper: Log the shape of the URL without revealing it
    if (REDIS_URL) {
        const maskedPreview = `${REDIS_URL.substring(0, 4)}...${REDIS_URL.substring(REDIS_URL.length - 4)}`;
        console.error(` Diagnostic: REDIS_URL length: ${REDIS_URL.length}, Start/End: ${maskedPreview}`);
    }
    
    // Fallback to "Degraded Mode" mock instead of crashing the process
    redisClient = createMockRedis('CrashRecovery');
}

// FINAL FALLBACK: If above failed or REDIS_URL was empty
if (!redisClient && !IS_BUILDING) {
    redisClient = createMockRedis('AbsoluteFallback');
    if (process.env.NODE_ENV === 'production') {
        console.info(' [Redis:Production] System Local Cache operational.');
    }
}

export { redisClient };

export const createSubClient = (name: string) => createRedisClient({ name, isSubscriber: true });

/**
 *  SAFE REDIS  wraps any redis call in a timeout.
 * Returns 'TIMEOUT' if it takes longer than 1500ms, allowing the caller 
 * to distinguish between a missing key and a network failure.
 */
export async function safeRedisGet(key: string): Promise<string | null | 'TIMEOUT'> {
    try {
        if ((redisClient as any).__isMock || (redisClient as any).__isBuildMock) {
            return await (redisClient as any).get(key);
        }
        
        // Sovereign grade timeout: 1500ms.
        return await Promise.race([
            redisClient.get(key),
            new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 1500))
        ]);
    } catch (e) {
        console.error(`[Redis:SafeGet] Critical Infrastructure Error:`, e);
        return 'TIMEOUT';
    }
}

export async function safeRedisSet(key: string, value: string, ...args: any[]): Promise<void> {
    try {
        if ((redisClient as any).__isMock || (redisClient as any).__isBuildMock) {
            if (args.length >= 2 && args[0] === 'EX') {
                await (redisClient as any).setex(key, args[1], value);
            } else {
                await (redisClient as any).set(key, value);
            }
            return;
        }
        // 2500ms for mutation operations
        await Promise.race([
            redisClient.set(key, value, ...args),
            new Promise<void>((resolve) => setTimeout(resolve, 2500))
        ]);
    } catch {
        // Silently ignore  cache is an optimization, not a requirement
    }
}

export async function safeRedisSAdd(key: string, member: string): Promise<void> {
    try {
        if ((redisClient as any).__isMock || (redisClient as any).__isBuildMock) {
            await (redisClient as any).sadd(key, member);
            return;
        }
        await Promise.race([
            redisClient.sadd(key, member),
            new Promise<void>((resolve) => setTimeout(resolve, 2500))
        ]);
    } catch {}
}

export async function safeRedisSMembers(key: string): Promise<string[]> {
    try {
        if ((redisClient as any).__isMock || (redisClient as any).__isBuildMock) {
            return await (redisClient as any).smembers(key);
        }
        const members = await Promise.race([
            redisClient.smembers(key),
            new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 2500))
        ]);
        return Array.isArray(members) ? members : [];
    } catch {
        return [];
    }
}

/**
 * Health check  use in /api/health-check to verify Redis connectivity
 */
export async function checkRedisHealth(): Promise<{ ok: boolean; latencyMs?: number; mode: 'real' | 'mock' }> {
    if ((redisClient as any).__isMock) {
        return { ok: false, mode: 'mock' };
    }
    const start = Date.now();
    try {
        await redisClient.set('__health_check', '1', 'EX', 10);
        const val = await redisClient.get('__health_check');
        return { ok: val === '1', latencyMs: Date.now() - start, mode: 'real' };
    } catch {
        return { ok: false, latencyMs: Date.now() - start, mode: 'real' };
    }
}

