import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface RateLimitRule {
  namespace: string;
  identifier: string;
  maxAttempts: number;
  windowMs: number;
}

interface StoredRule extends RateLimitRule {
  keyHash: string;
}

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const TRUSTED_PROXY_HEADERS = new Set([
  'cf-connecting-ip',
  'fly-client-ip',
  'true-client-ip',
  'x-forwarded-for',
  'x-real-ip',
]);
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

function toStoredRule(rule: RateLimitRule): StoredRule {
  return {
    ...rule,
    keyHash: createHash('sha256')
      .update(`${rule.namespace}\0${rule.identifier}`)
      .digest('hex'),
  };
}

/**
 * Reads only the header explicitly configured for the trusted reverse proxy.
 * For X-Forwarded-For the right-most value is used so a client-prepended value
 * cannot bypass the limiter. The proxy must overwrite or append this header.
 */
export function getClientIdentifier(request: NextRequest): string {
  const configuredHeader = process.env.TRUSTED_PROXY_IP_HEADER?.trim().toLowerCase();
  if (!configuredHeader || !TRUSTED_PROXY_HEADERS.has(configuredHeader)) {
    return 'unconfigured-trusted-proxy';
  }

  const rawValue = request.headers.get(configuredHeader);
  if (!rawValue) return `missing-${configuredHeader}`;

  const value = configuredHeader === 'x-forwarded-for'
    ? rawValue.split(',').map((part) => part.trim()).filter(Boolean).at(-1)
    : rawValue.trim();

  return `${configuredHeader}:${value || 'unknown'}`.slice(0, 192);
}

/**
 * Atomically checks and consumes every rule. Per-key advisory locks make the
 * count-and-insert sequence safe under parallel requests, including an empty
 * event set where a normal row lock cannot be taken.
 */
export async function consumeRateLimits(rules: RateLimitRule[]): Promise<RateLimitResult> {
  if (rules.length === 0) return { allowed: true };

  const storedRules = rules.map(toStoredRule);
  const lockKeys = [...new Set(storedRules.map((rule) => rule.keyHash))].sort();

  return prisma.$transaction(async (tx) => {
    for (const keyHash of lockKeys) {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 0))
      `;
    }

    const now = new Date();
    await tx.rateLimitEvent.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - RATE_LIMIT_RETENTION_MS) } },
    });

    for (const rule of storedRules) {
      const cutoff = new Date(now.getTime() - rule.windowMs);
      const [count, oldest] = await Promise.all([
        tx.rateLimitEvent.count({
          where: { keyHash: rule.keyHash, createdAt: { gte: cutoff } },
        }),
        tx.rateLimitEvent.findFirst({
          where: { keyHash: rule.keyHash, createdAt: { gte: cutoff } },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);

      if (count >= rule.maxAttempts && oldest) {
        return {
          allowed: false as const,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((oldest.createdAt.getTime() + rule.windowMs - now.getTime()) / 1000),
          ),
        };
      }
    }

    await tx.rateLimitEvent.createMany({
      data: storedRules.map((rule) => ({ keyHash: rule.keyHash, createdAt: now })),
    });
    return { allowed: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
