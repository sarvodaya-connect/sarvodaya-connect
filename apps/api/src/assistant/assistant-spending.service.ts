import type Anthropic from '@anthropic-ai/sdk';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  actualMicroUsd,
  definitelyNotBilled,
  type ModelPrices,
  modelPrices,
  monthlyLimitMicroUsd,
  nextSpendingMonth,
  reservationMicroUsd,
  spendingMonth,
  usageCounts,
} from './assistant-cost.js';
import type { ModelRequest } from './assistant-model.js';

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
  prices: ModelPrices;
}

/**
 * Issue #96: the application's monthly spending limit for SarvoAI, in PostgreSQL so it
 * holds across API instances. One atomic statement reserves a high estimate before each
 * model call; afterwards the reservation becomes the estimated actual cost. Anything that
 * may have been billed stays counted until the month ends. Holds counts and model IDs
 * only: never prompts, answers or who asked.
 */
@Injectable()
export class AssistantSpendingService {
  private readonly logger = new Logger(AssistantSpendingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Throws SpendingLimitReachedException when the call would pass the limit. */
  async reserve(
    modelId: string,
    request: ModelRequest,
    now = new Date(),
  ): Promise<SpendReservation> {
    const limit = monthlyLimitMicroUsd(
      this.config.get<string>('SARVOAI_MONTHLY_LIMIT_USD'),
    );
    const prices = modelPrices(
      modelId,
      this.config.get<string>('SARVOAI_INPUT_USD_PER_MTOK'),
      this.config.get<string>('SARVOAI_OUTPUT_USD_PER_MTOK'),
    );
    const amount = reservationMicroUsd(request, prices);
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
      this.logger.warn(
        JSON.stringify({ event: 'sarvoai_spending_limit_reached', month }),
      );
      throw new SpendingLimitReachedException(now);
    }
    return { id, prices };
  }

  /** Replaces the reservation with the cost of the tokens the provider reported. */
  async settle(
    reservation: SpendReservation,
    usage: Anthropic.Usage | undefined,
  ) {
    const counts = usageCounts(usage);
    if (!counts) {
      await this.keepAsUncertain(reservation, 'usage_missing');
      return;
    }
    const actual = actualMicroUsd(counts, reservation.prices);
    await this.close(
      reservation,
      'settled',
      () => this.prisma.$queryRaw<{ over: boolean }[]>`
        WITH closed AS (
          UPDATE assistant_spend_reservations
          SET status = 'SETTLED'::assistant_spend_status, actual_micro_usd = ${actual}::bigint,
              input_tokens = ${counts.inputTokens}, cache_write_tokens = ${counts.cacheWriteTokens},
              cache_read_tokens = ${counts.cacheReadTokens}, output_tokens = ${counts.outputTokens},
              closed_at = now()
          WHERE id = ${reservation.id}::uuid AND status = 'RESERVED'::assistant_spend_status
          RETURNING month, reserved_micro_usd
        )
        UPDATE assistant_monthly_spend AS spend
        SET committed_micro_usd = spend.committed_micro_usd - closed.reserved_micro_usd + ${actual}::bigint,
            updated_at = now()
        FROM closed
        WHERE spend.month = closed.month
        RETURNING ${actual}::bigint > closed.reserved_micro_usd AS over`,
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
      () => this.prisma.$queryRaw<{ over: boolean }[]>`
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
        RETURNING false AS over`,
    );
  }

  /** The reservation stays in the month's total; the month ending is what clears it. */
  private async keepAsUncertain(reservation: SpendReservation, reason: string) {
    await this.close(
      reservation,
      'uncertain',
      () => this.prisma.$queryRaw<{ over: boolean }[]>`
        UPDATE assistant_spend_reservations
        SET status = 'UNCERTAIN'::assistant_spend_status, closed_at = now()
        WHERE id = ${reservation.id}::uuid AND status = 'RESERVED'::assistant_spend_status
        RETURNING false AS over`,
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
    update: () => Promise<{ over: boolean }[]>,
    reason?: string,
  ) {
    try {
      const rows = await executeDatabaseOperation(update);
      if (rows[0]?.over) {
        this.logger.warn(
          JSON.stringify({
            event: 'sarvoai_spend_above_reservation',
            reservationId: reservation.id,
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
