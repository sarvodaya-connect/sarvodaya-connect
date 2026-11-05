import type Anthropic from '@anthropic-ai/sdk';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  actualMicroUsd,
  assertBillableRequest,
  definitelyNotBilled,
  monthlyLimitMicroUsd,
  nextSpendingMonth,
  type PricingApproval,
  pricingApproval,
  reservationBound,
  SpendingBlockedError,
  spendingMonth,
  unpricedBilling,
  usageCounts,
} from './assistant-cost.js';
import { DEFAULT_REGION, type ModelRequest } from './assistant-model.js';

/** The answer when a call would pass the limit. No model call is made. */
export class SpendingLimitReachedException extends HttpException {
  constructor(now: Date) {
    const resumes = nextSpendingMonth(now).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    super(
      {
        message: `SarvoAI has reached its spending limit for this month. It will be available again on ${resumes} (5:30 a.m. Sri Lanka time). Society records are not affected, and you can still find the figures in Reports.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export interface SpendReservation {
  id: string;
  approval: PricingApproval;
  reservedMicroUsd: bigint;
  /** What the reservation assumed; a response above either breaks its assumptions. */
  promptTokenBound: number;
  outputTokenBound: number;
}

/**
 * Issue #96: the application's monthly spending limit for SarvoAI, in PostgreSQL so it
 * holds across API instances. One atomic statement reserves a high estimate before each
 * model call; afterwards the reservation becomes the estimated actual cost. Anything that
 * may have been billed stays counted until the month ends. A call that breaks the
 * reservation's assumptions places a hold that stops all further calls, across instances
 * and months, until it is reviewed. Holds counts and model IDs only: never prompts,
 * answers or who asked.
 */
@Injectable()
export class AssistantSpendingService {
  private readonly logger = new Logger(AssistantSpendingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Throws SpendingBlockedError when no safe limit can be put on the call, or when a hold
   * is waiting for review, and SpendingLimitReachedException when the call would pass the
   * limit. Either way the model is not called.
   */
  async reserve(
    modelId: string,
    request: ModelRequest,
    now = new Date(),
  ): Promise<SpendReservation> {
    const limit = monthlyLimitMicroUsd(
      this.config.get<string>('SARVOAI_MONTHLY_LIMIT_USD'),
    );
    const approval = pricingApproval(
      this.config.get<string>('SARVOAI_PRICING_APPROVAL'),
      {
        modelId,
        region: this.config.get<string>('SARVOAI_AWS_REGION') ?? DEFAULT_REGION,
      },
      now,
    );
    assertBillableRequest(request);
    const bound = reservationBound(request, approval);
    const amount = bound.microUsd;
    const through = approval.overageReviewedThrough;
    const month = spendingMonth(now);
    const id = randomUUID();
    // One statement, so simultaneous requests on any API instance queue on the month's
    // row and each sees the amount committed by the one before it.
    const reserved = await executeDatabaseOperation(
      () => this.prisma.$queryRaw<{ id: string }[]>`
        WITH month_row AS (
          INSERT INTO assistant_monthly_spend (month, committed_micro_usd, updated_at)
          SELECT ${month}, ${amount}::bigint, now()
          WHERE ${amount}::bigint <= ${limit}::bigint
            AND NOT EXISTS (
              SELECT 1 FROM assistant_spend_holds
              WHERE ${through}::timestamptz IS NULL OR detected_at > ${through}::timestamptz
            )
          ON CONFLICT (month) DO UPDATE
            SET committed_micro_usd = assistant_monthly_spend.committed_micro_usd + EXCLUDED.committed_micro_usd,
                updated_at = now()
            WHERE assistant_monthly_spend.committed_micro_usd + EXCLUDED.committed_micro_usd <= ${limit}::bigint
          RETURNING month
        )
        INSERT INTO assistant_spend_reservations (id, month, model_id, status, reserved_micro_usd)
        SELECT ${id}::uuid, month, ${modelId}, 'RESERVED'::assistant_spend_status, ${amount}::bigint
        FROM month_row
        RETURNING id::text`,
    );
    if (reserved.length === 0) {
      const held = await executeDatabaseOperation(
        () => this.prisma.$queryRaw<{ held: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM assistant_spend_holds
            WHERE ${through}::timestamptz IS NULL OR detected_at > ${through}::timestamptz
          ) AS held`,
      );
      if (held[0]?.held)
        throw new SpendingBlockedError(
          'A SarvoAI call broke its reservation assumptions and has not been reviewed',
        );
      this.logger.warn(
        JSON.stringify({ event: 'sarvoai_spending_limit_reached', month }),
      );
      throw new SpendingLimitReachedException(now);
    }
    return {
      id,
      approval,
      reservedMicroUsd: amount,
      promptTokenBound: bound.promptTokens,
      outputTokenBound: request.max_tokens,
    };
  }

  /**
   * Replaces the reservation with the cost of the tokens the provider reported. If the
   * response breaks the reservation's assumptions, the same statement records the full
   * cost and places a hold. A charge the approved prices do not cover counts at no less
   * than the reservation, because its true cost is unknown.
   */
  async settle(
    reservation: SpendReservation,
    usage: Anthropic.Usage | undefined,
  ) {
    const counts = usageCounts(usage);
    if (!counts) {
      await this.keepAsUncertain(reservation, 'usage_missing');
      return;
    }
    const estimated = actualMicroUsd(counts, reservation.approval);
    const unpriced = unpricedBilling(usage);
    const actual =
      unpriced.length > 0 && estimated < reservation.reservedMicroUsd
        ? reservation.reservedMicroUsd
        : estimated;
    const promptTokens =
      counts.inputTokens + counts.cacheWriteTokens + counts.cacheReadTokens;
    const reasons = [
      ...(estimated > reservation.reservedMicroUsd
        ? ['cost_above_reservation']
        : []),
      ...(promptTokens > reservation.promptTokenBound
        ? ['prompt_above_bound']
        : []),
      ...(counts.outputTokens > reservation.outputTokenBound
        ? ['output_above_bound']
        : []),
      ...unpriced,
    ].join(',');
    await this.close(
      reservation,
      'settled',
      () => this.prisma.$queryRaw<{ detectedAt: Date | null }[]>`
        WITH closed AS (
          UPDATE assistant_spend_reservations
          SET status = 'SETTLED'::assistant_spend_status, actual_micro_usd = ${actual}::bigint,
              input_tokens = ${counts.inputTokens}, cache_write_tokens = ${counts.cacheWriteTokens},
              cache_read_tokens = ${counts.cacheReadTokens}, output_tokens = ${counts.outputTokens},
              closed_at = now()
          WHERE id = ${reservation.id}::uuid AND status = 'RESERVED'::assistant_spend_status
          RETURNING id, month, reserved_micro_usd
        ), spend AS (
          UPDATE assistant_monthly_spend AS spend
          SET committed_micro_usd = spend.committed_micro_usd - closed.reserved_micro_usd + ${actual}::bigint,
              updated_at = now()
          FROM closed
          WHERE spend.month = closed.month
          RETURNING spend.month
        ), hold AS (
          INSERT INTO assistant_spend_holds (reservation_id, reasons, reserved_micro_usd, actual_micro_usd)
          SELECT closed.id, ${reasons}::varchar, closed.reserved_micro_usd, ${actual}::bigint
          FROM closed
          WHERE ${reasons}::varchar <> ''
          RETURNING detected_at
        )
        SELECT hold.detected_at AS "detectedAt" FROM spend LEFT JOIN hold ON true`,
      undefined,
      { reasons, actual },
    );
  }

  /** After a failed call: frees the money only if the call definitely was not billed. */
  async failed(reservation: SpendReservation, error: unknown) {
    if (!definitelyNotBilled(error)) {
      await this.keepAsUncertain(reservation, 'outcome_unknown');
      return;
    }
    await this.close(
      reservation,
      'released',
      () => this.prisma.$queryRaw<{ detectedAt: Date | null }[]>`
        WITH closed AS (
          UPDATE assistant_spend_reservations
          SET status = 'RELEASED'::assistant_spend_status, actual_micro_usd = 0, closed_at = now()
          WHERE id = ${reservation.id}::uuid AND status = 'RESERVED'::assistant_spend_status
          RETURNING month, reserved_micro_usd
        )
        UPDATE assistant_monthly_spend AS spend
        SET committed_micro_usd = spend.committed_micro_usd - closed.reserved_micro_usd,
            updated_at = now()
        FROM closed
        WHERE spend.month = closed.month
        RETURNING NULL::timestamptz AS "detectedAt"`,
    );
  }

  /** The reservation stays in the month's total; the month ending is what clears it. */
  private async keepAsUncertain(reservation: SpendReservation, reason: string) {
    await this.close(
      reservation,
      'uncertain',
      () => this.prisma.$queryRaw<{ detectedAt: Date | null }[]>`
        UPDATE assistant_spend_reservations
        SET status = 'UNCERTAIN'::assistant_spend_status, closed_at = now()
        WHERE id = ${reservation.id}::uuid AND status = 'RESERVED'::assistant_spend_status
        RETURNING NULL::timestamptz AS "detectedAt"`,
      reason,
    );
  }

  /**
   * A database failure here must not lose an answer already paid for. The reservation
   * simply stays open, and so stays counted.
   */
  private async close(
    reservation: SpendReservation,
    outcome: string,
    update: () => Promise<{ detectedAt: Date | null }[]>,
    reason?: string,
    breach?: { reasons: string; actual: bigint },
  ) {
    try {
      const rows = await executeDatabaseOperation(update);
      const detectedAt = rows[0]?.detectedAt;
      if (detectedAt && breach) {
        this.logger.warn(
          JSON.stringify({
            event: 'sarvoai_calls_held_for_review',
            reservationId: reservation.id,
            reasons: breach.reasons,
            reservedMicroUsd: reservation.reservedMicroUsd.toString(),
            actualMicroUsd: breach.actual.toString(),
            detectedAt: detectedAt.toISOString(),
          }),
        );
      }
      if (reason) {
        this.logger.warn(
          JSON.stringify({
            event: 'sarvoai_spend_kept',
            outcome,
            reason,
            reservationId: reservation.id,
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'sarvoai_spend_update_failed',
          outcome,
          reservationId: reservation.id,
          error: error instanceof Error ? error.name : 'unknown',
        }),
      );
    }
  }
}
