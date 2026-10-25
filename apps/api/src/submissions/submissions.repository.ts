import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubmissionTypeValue } from './dto/submission.dto.js';
import { applyRegistryChanges, RegistryApplyError } from './registry-apply.js';
import type { ResolvedRegistryChange } from './registry-fields.js';
import type {
  SubmissionAction,
  SubmissionStatus,
} from './submission-transitions.js';

const include = {
  fields: { orderBy: { field: 'asc' } },
  events: { orderBy: { createdAt: 'asc' } },
  society: { select: { districtId: true, nameEn: true, societyCode: true } },
} as const;

export type SubmissionRecord = NonNullable<
  Awaited<ReturnType<SubmissionsRepository['findById']>>
>;

export interface Actor {
  id: string;
  name: string;
}

export interface NewSubmission {
  societyId: string;
  type: SubmissionTypeValue;
  title: string;
  actor: Actor;
  changes: {
    field: string;
    label: string;
    previousValue?: unknown;
    proposedValue: unknown;
  }[];
}

export interface TransitionInput {
  id: string;
  version: number;
  from: SubmissionStatus;
  to: SubmissionStatus;
  action: SubmissionAction;
  actor: Actor;
  comment?: string;
  data?: Prisma.SubmissionUpdateManyMutationInput;
  fieldUpdates?: { field: string; data: Prisma.SubmissionFieldUpdateInput }[];
  /** Registry changes applied in the same transaction when the action is APPROVE. */
  registry?: { societyId: string; changes: readonly ResolvedRegistryChange[] };
}

@Injectable()
export class SubmissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.submission.findUnique({ where: { id }, include }),
    );
  }

  findSociety(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        select: { id: true, districtId: true },
      }),
    );
  }

  findOpen(societyId: string, type: SubmissionTypeValue) {
    return executeDatabaseOperation(() =>
      this.prisma.submission.findFirst({
        where: {
          societyId,
          type,
          status: {
            in: [
              'DRAFT',
              'SUBMITTED',
              'UNDER_REVIEW',
              'CHANGES_REQUESTED',
              'RESUBMITTED',
            ],
          },
        },
        select: { id: true },
      }),
    );
  }

  async list(
    where: Prisma.SubmissionWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [records, totalItems] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.submission.findMany({
          where,
          include,
          orderBy: [{ submittedAt: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.submission.count({ where }),
      ]),
    );
    return { records, totalItems };
  }

  /** Creates the draft and its audit entry together. */
  create(input: NewSubmission) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.submission.create({
          data: {
            societyId: input.societyId,
            type: input.type,
            title: input.title,
            submittedById: input.actor.id,
            submittedByName: input.actor.name,
            fields: {
              create: input.changes.map((change) => ({
                field: change.field,
                label: change.label,
                previousValue:
                  change.previousValue === undefined
                    ? undefined
                    : (change.previousValue as Prisma.InputJsonValue),
                proposedValue: change.proposedValue as Prisma.InputJsonValue,
              })),
            },
          },
          select: { id: true },
        });
        await tx.auditLogEntry.create({
          data: {
            action: 'SUBMISSION_CREATED',
            entityType: 'Submission',
            entityId: created.id,
            actorId: input.actor.id,
            actorName: input.actor.name,
            metadata: { type: input.type, societyId: input.societyId },
          },
        });
        return created;
      }),
    );
  }

  /**
   * One atomic step: status change (only if version and status still match),
   * field updates, history event and audit entry. Returns false when someone
   * else changed the submission first.
   */
  async transition(input: TransitionInput): Promise<boolean> {
    const outcome = await executeDatabaseOperation(
      async (): Promise<{ applied: boolean; failure?: RegistryApplyError }> => {
        try {
          const applied = await this.prisma.$transaction(async (tx) => {
            const result = await tx.submission.updateMany({
              where: { id: input.id, version: input.version, status: input.from },
              data: {
                ...input.data,
                status: input.to,
                version: { increment: 1 },
              },
            });
            if (result.count !== 1) return false;

            // Registry writes share this transaction: if any step below
            // throws, the status change, registry, event and audit all roll back.
            const registryChanges =
              input.action === 'APPROVE' && input.registry
                ? await applyRegistryChanges(
                    tx,
                    input.registry.societyId,
                    input.registry.changes,
                  )
                : [];

            for (const update of input.fieldUpdates ?? []) {
              await tx.submissionField.update({
                where: {
                  submissionId_field: {
                    submissionId: input.id,
                    field: update.field,
                  },
                },
                data: update.data,
              });
            }
            await tx.submissionEvent.create({
              data: {
                submissionId: input.id,
                action: input.action,
                fromStatus: input.from,
                toStatus: input.to,
                actorId: input.actor.id,
                actorName: input.actor.name,
                comment: input.comment,
              },
            });
            await tx.auditLogEntry.create({
              data: {
                action: `SUBMISSION_${input.action}`,
                entityType: 'Submission',
                entityId: input.id,
                actorId: input.actor.id,
                actorName: input.actor.name,
                metadata: {
                  from: input.from,
                  to: input.to,
                  version: input.version,
                  ...(input.comment ? { comment: input.comment } : {}),
                  ...(registryChanges.length > 0 ? { registryChanges } : {}),
                },
              },
            });
            return true;
          });
          return { applied };
        } catch (error) {
          if (error instanceof RegistryApplyError) {
            return { applied: false, failure: error };
          }
          throw error;
        }
      },
    );
    if (outcome.failure) {
      throw outcome.failure.status === 409
        ? new ConflictException(outcome.failure.message)
        : new BadRequestException(outcome.failure.message);
    }
    return outcome.applied;
  }
}
