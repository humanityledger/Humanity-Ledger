import { prisma } from '@/lib/prisma';
import { 
  TransactionStatus, 
  type TransactionType, 
  type CreateTransactionData, 
  type TransactionMetadata 
} from './transactions';

export async function createTransaction(data: CreateTransactionData) {
  return prisma.transaction.create({
    data: {
      txHash: data.hash,
      type: data.type,
      status: data.status,
      fromAddress: data.from,
      toAddress: data.to,
      amount: parseFloat(data.value) || 0,
      token: data.tokenSymbol || 'ETH',
      timestamp: new Date(),
    },
  });
}

export async function getTransactionHistory(authUserId: string, options?: any) {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  //  UNIFICACIÓN SOBERANA DE TRIPLE FLUJO (5000T) 
  // [ZK-ISOLATION] authUserId is now the wallet address (SIWE session.userId).
  // The Transaction table no longer has an authUserId column — it uses fromAddress/toAddress.
  // We query all three sources by address for full fidelity.
  let legacy: any[] = [];
  let ledgers: any[] = [];
  let blockchain: any[] = [];

  try {
    const results = await Promise.all([
      prisma.transaction.findMany({
        where: { 
          OR: [{ fromAddress: authUserId }, { toAddress: authUserId }],
          ...(options?.type ? { type: options.type } : {})
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ledgerActivity.findMany({
        where: {
          OR: [
            { fromAddress: authUserId },
            { toAddress: authUserId },
            { walletAddress: authUserId }
          ]
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      }),
      prisma.blockchainTransaction.findMany({
        where: { userId: authUserId },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
    ]);
    legacy = results[0];
    ledgers = results[1];
    blockchain = results[2];
  } catch (err: any) {
    // Graceful fallback for standalone execution
    return [];
  }

  // Mapeo unificado para el Ledger de Alta Fidelidad
  const unified = [
    ...legacy.map((t: any) => ({
      ...t,
      hash: t.txHash,
      from: t.fromAddress,
      to: t.toAddress,
      value: t.amount.toString(),
      tokenSymbol: t.token,
      isLedger: false,
      source: 'LEDGER'
    })),
    ...ledgers.map((w: any) => ({
      ...w,
      hash: w.transactionHash,
      from: w.fromAddress,
      to: w.toAddress,
      value: w.amount,
      tokenSymbol: w.token,
      status: 'CONFIRMED',
      type: w.type,
      timestamp: w.timestamp,
      isLedger: true,
      sovereign: w.sovereign,
      valueBTC: w.valueBTC,
      source: 'LEDGER_INTEL'
    })),
    ...blockchain.map((b: any) => ({
      ...b,
      hash: b.txHash,
      from: b.userId || 'UNKNOWN',
      to: 'N/A',
      value: b.fromAmount || '0',
      tokenSymbol: b.fromToken || 'CRYPTO',
      status: b.status,
      type: b.type,
      timestamp: b.createdAt,
      isLedger: false,
      source: 'BLOCKCHAIN_SYNC'
    }))
  ];

  // Re-ordenamiento cronológico total bajo lógica determinista
  return unified
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function getTransactionByHash(hash: string) {
  return prisma.transaction.findUnique({
    where: { txHash: hash },
  });
}

export async function updateTransactionStatus(
  hash: string,
  status: TransactionStatus,
  metadata?: Partial<TransactionMetadata>
) {
  return prisma.transaction.update({
    where: { txHash: hash },
    data: {
      status,
    },
  });
}

export async function getPendingTransactions(authUserId: string) {
  return prisma.transaction.findMany({
    where: {
      OR: [
        { fromAddress: authUserId },
        { toAddress: authUserId }
      ],
      status: TransactionStatus.PENDING,
    },
    orderBy: { timestamp: 'desc' },
  });
}

export async function getTransactionStats(authUserId: string) {
  const baseWhere = {
    OR: [
      { fromAddress: authUserId },
      { toAddress: authUserId }
    ]
  };

  try {
    const [total, pending, confirmed, failed] = await Promise.all([
      prisma.transaction.count({ where: baseWhere }),
      prisma.transaction.count({ where: { ...baseWhere, status: TransactionStatus.PENDING } }),
      prisma.transaction.count({ where: { ...baseWhere, status: TransactionStatus.CONFIRMED } }),
      prisma.transaction.count({ where: { ...baseWhere, status: TransactionStatus.FAILED } }),
    ]);
    return { total, pending, confirmed, failed };
  } catch {
    return { total: 0, pending: 0, confirmed: 0, failed: 0 };
  }
}

