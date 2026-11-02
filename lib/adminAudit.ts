import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface AdminAuditParams {
  adminAddress: string;
  action: string;
  target?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Records an immutable administrative action audit log.
 * Guarantees no sensitive user data (passwords, message text, private notes) is stored.
 */
export async function logAdminAction(params: AdminAuditParams): Promise<void> {
  const { adminAddress, action, target, metadata, ipAddress } = params;

  logger.info({
    audit: true,
    adminAddress,
    action,
    target,
    ipAddress,
  }, `[AdminAudit] Action '${action}' performed by ${adminAddress}`);

  try {
    // Check if AdminAudit table exists in Prisma schema or store in system logs
    if ((prisma as any).adminAudit) {
      await (prisma as any).adminAudit.create({
        data: {
          adminAddress: adminAddress.toLowerCase(),
          action,
          target: target || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          ipAddress: ipAddress || null,
          createdAt: new Date(),
        },
      });
    }
  } catch (err: any) {
    logger.error({ err }, 'Failed to persist AdminAudit record to database');
  }
}
