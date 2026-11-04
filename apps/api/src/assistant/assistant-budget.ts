import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';

export class AssistantBudgetError extends Error {}

/**
 * Initial pilot: reserve USD 2 per attempted provider call, never refund it.
 * The SQL function serializes admissions across all Lambda instances. Failure,
 * timeout and ambiguous provider outcomes consume the reservation too.
 */
export async function reserveAssistantCall(config: ConfigService, prisma?: PrismaService): Promise<void> {
  const review = config.get<string>('SARVOAI_PRICE_REVIEW_UNTIL') ?? '';
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(review) ? Date.parse(`${review}T00:00:00Z`) : NaN;
  if (!prisma || !Number.isFinite(expiry) || new Date(expiry).toISOString().slice(0, 10) !== review || Date.now() >= expiry || expiry > Date.now() + 31 * 86400000) {
    throw new AssistantBudgetError('SarvoAI requires a current pricing review');
  }
  try {
    const rows = await prisma.$queryRaw<{ admitted: boolean }[]>`SELECT public.reserve_sarvoai_call() AS admitted`;
    if (rows.length !== 1 || rows[0].admitted !== true) throw new Error('Not admitted');
  } catch {
    throw new AssistantBudgetError('SarvoAI monthly allowance is unavailable or exhausted');
  }
}
