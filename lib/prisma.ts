import 'server-only';
import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// 
// COSMIC ENTITY TYPE BRIDGE
// The Prisma client was generated before CosmicEntity was added to the schema.
// This type declaration makes the TypeScript compiler aware of prisma.cosmicEntity
// so that all forge services compile correctly right now.
// Once `npx prisma generate` is run the generated types supersede this cast.
// 

type CosmicEntityRecord = {
  id: string;
  seedHash: string;
  ledgerEventId: string | null;
  tier: string;
  amountUSD: number;
  chain: string;
  generatorType: string;
  status: string;
  artMetadata: Prisma.JsonValue | null;
  musicMetadata: Prisma.JsonValue | null;
  biotechMetadata: Prisma.JsonValue | null;
  worldSimMetadata: Prisma.JsonValue | null;
  agentMetadata: Prisma.JsonValue | null;
  contractAddress: string | null;
  hiveEnergyAtBirth: number;
  evolutionCount: number;
  parentEntityId: string | null;
  beneficiaryAddr: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CosmicEntityWhereInput = Partial<{
  id: string;
  seedHash: string;
  status: string | { in: string[] };
  tier: string;
  chain: string;
  amountUSD: number;
}>;

type CosmicEntityWhereUniqueInput = { id?: string; seedHash?: string };

type CosmicEntityAggregateArgs = {
  where?: CosmicEntityWhereInput;
  _sum?: Partial<Record<'amountUSD' | 'hiveEnergyAtBirth' | 'evolutionCount', boolean>>;
  _count?: boolean | Partial<Record<keyof CosmicEntityRecord, boolean>>;
  _avg?: Partial<Record<'amountUSD' | 'hiveEnergyAtBirth', boolean>>;
};

type CosmicEntityDelegate = {
  findMany(args?: {
    where?: CosmicEntityWhereInput;
    orderBy?: Partial<Record<keyof CosmicEntityRecord, 'asc' | 'desc'>>;
    take?: number;
    skip?: number;
  }): Promise<CosmicEntityRecord[]>;
  findUnique(args: { where: CosmicEntityWhereUniqueInput }): Promise<CosmicEntityRecord | null>;
  findFirst(args?: { where?: CosmicEntityWhereInput; orderBy?: Partial<Record<keyof CosmicEntityRecord, 'asc' | 'desc'>> }): Promise<CosmicEntityRecord | null>;
  create(args: { data: Omit<Partial<CosmicEntityRecord>, 'id' | 'createdAt' | 'updatedAt'> }): Promise<CosmicEntityRecord>;
  update(args: { where: CosmicEntityWhereUniqueInput; data: Partial<CosmicEntityRecord> }): Promise<CosmicEntityRecord>;
  updateMany(args: { where?: CosmicEntityWhereInput; data: Partial<CosmicEntityRecord> }): Promise<Prisma.BatchPayload>;
  delete(args: { where: CosmicEntityWhereUniqueInput }): Promise<CosmicEntityRecord>;
  deleteMany(args?: { where?: CosmicEntityWhereInput }): Promise<Prisma.BatchPayload>;
  count(args?: { where?: CosmicEntityWhereInput }): Promise<number>;
  aggregate(args: CosmicEntityAggregateArgs): Promise<{
    _sum: { amountUSD: number | null; hiveEnergyAtBirth: number | null; evolutionCount: number | null };
    _count: { _all: number };
    _avg: { amountUSD: number | null; hiveEnergyAtBirth: number | null };
  }>;
};

// 
// WALLET INTELLIGENCE TYPE BRIDGE
// WalletAnalytics was added to schema.prisma but npx prisma generate
// has not been run yet. This bridge makes the TypeScript compiler aware of
// prisma.walletAnalytics immediately, without regenerating the client.
// 

type WalletAnalyticsRecord = {
  id: string;
  address: string;
  forensics: Prisma.JsonValue | null;
  category: string | null;
  updatedAt: Date;
  createdAt: Date;
};

type WalletAnalyticsDelegate = {
  findMany(args?: {
    where?: Partial<{ address: string | { in: string[] }; category: string }>;
    select?: Partial<Record<keyof WalletAnalyticsRecord, boolean>>;
    orderBy?: Partial<Record<keyof WalletAnalyticsRecord, 'asc' | 'desc'>>;
    take?: number;
    skip?: number;
  }): Promise<Partial<WalletAnalyticsRecord>[]>;
  findUnique(args: {
    where: { id?: string; address?: string };
    select?: Partial<Record<keyof WalletAnalyticsRecord, boolean>>;
  }): Promise<Partial<WalletAnalyticsRecord> | null>;
  upsert(args: {
    where: { address: string };
    create: Partial<WalletAnalyticsRecord>;
    update: Partial<WalletAnalyticsRecord>;
  }): Promise<WalletAnalyticsRecord>;
  count(args?: { where?: Partial<{ address: string; category: string }> }): Promise<number>;
};

type NotificationRecord = {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  type: string;
  isGlobal: boolean;
  actionUrl: string | null;
  read: boolean;
  createdAt: Date;
};

type NotificationDelegate = {
  create(args: { data: Omit<Partial<NotificationRecord>, 'id' | 'createdAt' | 'read'> }): Promise<NotificationRecord>;
  findMany(args?: { where?: any; orderBy?: any; take?: number }): Promise<NotificationRecord[]>;
  update(args: { where: { id: string }; data: Partial<NotificationRecord> }): Promise<NotificationRecord>;
};

type VerificationCodeRecord = {
  id: string;
  code: string;
  userId: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
};

type VerificationCodeDelegate = {
  create(args: { data: Omit<Partial<VerificationCodeRecord>, 'id' | 'createdAt'> }): Promise<VerificationCodeRecord>;
  findFirst(args: { where: any; orderBy?: any }): Promise<VerificationCodeRecord | null>;
  update(args: { where: { id: string }; data: Partial<VerificationCodeRecord> }): Promise<VerificationCodeRecord>;
};

/** PrismaClient augmented with models not yet reflected in the generated client */
type SystemPrismaClient = PrismaClient & {
  cosmicEntity: CosmicEntityDelegate;
  walletAnalytics: WalletAnalyticsDelegate;
  notification: NotificationDelegate;
  verificationCode: VerificationCodeDelegate;
};

function getSanitizedDatabaseUrl(): string | undefined {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) return undefined;

    try {
        const urlObj = new URL(rawUrl);
        
        // Fallback: If we detect the public proxy domain on Railway, rewrite to internal domain
        if (urlObj.hostname.includes('proxy.rlwy.net')) {
            urlObj.hostname = 'postgres.railway.internal';
            urlObj.port = '5432';
        }

        if (urlObj.protocol === 'postgresql:' || urlObj.protocol === 'postgres:') {
            // Force PgBouncer whenever a pooler is detected or in production (prevents 'Closed, cause: None' prepared statement errors)
            const isPooler = urlObj.hostname.includes('-pooler') || urlObj.hostname.includes('pooler') || urlObj.port === '6543';
            if (isPooler || process.env.NODE_ENV === 'production') {
                urlObj.searchParams.set('pgbouncer', 'true');
            }

            // Connection limit: keep sane limits to avoid exhausting Neon / Railway serverless pools
            const maxLimit = process.env.NODE_ENV === 'production' ? '20' : '10';
            if (!urlObj.searchParams.has('connection_limit')) {
                urlObj.searchParams.set('connection_limit', maxLimit);
            }

            // Connection timeout: gives Neon compute 15s to wake from scale-to-zero suspend without socket closure
            if (!urlObj.searchParams.has('connect_timeout')) {
                urlObj.searchParams.set('connect_timeout', '15');
            }
        }
        return urlObj.toString();
    } catch {
        return rawUrl;
    }
}

function createPrismaClient(): PrismaClient {
    const url = getSanitizedDatabaseUrl();

    const client = new PrismaClient({
        datasources: url ? { db: { url } } : undefined,
        log: process.env.NODE_ENV === 'production' 
            ? [{ level: 'error', emit: 'event' }] 
            : ['error', 'warn'],
    });

    // System error filter: suppress P1009 (table not in DB yet) which floods logs
    // during the window between schema push and migration. Log all other errors normally.
    if (process.env.NODE_ENV === 'production') {
        (client as any).$on('error', (e: any) => {
            const msg: string = e?.message || '';
            // Suppress schema-lag errors that are self-healing via /api/admin/sync-db
            const isSchemaBehind =
                msg.includes('does not exist in the current database') || // table/column missing
                msg.includes('P1009') ||
                msg.includes('P2021') || // table does not exist
                msg.includes('P2022') || // column does not exist
                msg.includes('42703') || // PostgreSQL raw: column does not exist
                msg.includes('Invalid `prisma.'); // Validation error thrown during try/catch fallbacks
            if (!isSchemaBehind) {
                console.error('[PRISMA] DB Error:', msg.length > 500 ? msg.slice(0, 500) + '...' : msg);
            }
        });
    }

    return client;
}

export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as unknown as SystemPrismaClient;

// Always store the singleton globally, even in production, to prevent Serverless/Edge connection explosions
(globalForPrisma as unknown as { prisma: SystemPrismaClient }).prisma = prisma;

/** Named accessor — preferred import for new code (avoids default import ambiguity). */
export function getPrisma(): SystemPrismaClient {
  return prisma;
}

export default prisma;

