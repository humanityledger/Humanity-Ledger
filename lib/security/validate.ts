import { z, ZodSchema, ZodError } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Zod validation helper for API route inputs.
 *
 * Usage:
 *   const Body = z.object({ message: z.string().max(4096) });
 *   const body = await validateBody(req, Body);
 *   if (body instanceof NextResponse) return body; // validation error
 */

export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T | NextResponse> {
  try {
    const raw = await req.json();
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn({ issues: err.issues }, 'Request body validation failed');
      return NextResponse.json(
        { error: 'Invalid request body', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

export function validateQuery<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): T | NextResponse {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    return schema.parse(params);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }
}

// Common schemas
export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const WalletAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const MessageBodySchema = z.object({
  content: z.string().min(1).max(4096),
  communityId: z.string().optional(),
  channelId: z.string().optional(),
});
