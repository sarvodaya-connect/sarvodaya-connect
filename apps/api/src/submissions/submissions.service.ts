import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import type {
  CreateSubmissionDto,
  RequestChangesDto,
  ResubmitDto,
  SubmissionActionDto,
  SubmissionQueryDto,
} from './dto/submission.dto.js';
import {
  SubmissionsRepository,
  type SubmissionRecord,
  type TransitionInput,
} from './submissions.repository.js';
import {
  allowedActions,
  applyTransition,
  type SubmissionAction,
} from './submission-transitions.js';
import {
  assertChangesSupported,
  resolveRegistryChanges,
} from './registry-fields.js';

type Extras = Pick<TransitionInput, 'comment' | 'data' | 'fieldUpdates' | 'registry'>;

const DECISIONS: Partial<Record<SubmissionAction, string>> = {
  APPROVE: 'APPROVED',
  REQUEST_CHANGES: 'CHANGES_REQUESTED',
  REJECT: 'REJECTED',
};

const OPEN_FOR_EDIT = ['DRAFT', 'CHANGES_REQUESTED'];

@Injectable()
export class SubmissionsService {
  constructor(private readonly repository: SubmissionsRepository) {}

  async create(principal: Principal, dto: CreateSubmissionDto) {
    if (!principal.societyIds.includes(dto.societyId)) {
      throw new ForbiddenException(
        'You are not authorised to submit for this society',
      );
    }
    const fields = dto.changes.map((change) => change.field);
    if (new Set(fields).size !== fields.length) {
      throw new BadRequestException('Each field can appear only once');
    }
    assertChangesSupported(dto.type, dto.changes);
    if (!(await this.repository.findSociety(dto.societyId))) {
      throw new NotFoundException('Society not found');
    }
    if (await this.repository.findOpen(dto.societyId, dto.type)) {
      throw new ConflictException(
        'An open submission of this type already exists for this society',
      );
    }
    const created = await this.repository.create({
      societyId: dto.societyId,
      type: dto.type,
      title: dto.title,
      actor: { id: principal.id, name: principal.displayName },
      changes: dto.changes,
    });
    return this.get(principal, created.id);
  }

  async list(principal: Principal, query: SubmissionQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { records, totalItems } = await this.repository.list(
      { ...this.scopeWhere(principal), ...(query.status ? { status: query.status } : {}) },
      page,
      pageSize,
    );
    return {
      data: records.map((record) => this.toDetail(record, principal)),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }

  async get(principal: Principal, id: string) {
    return this.toDetail(await this.load(principal, id), principal);
  }

  submit(principal: Principal, id: string, dto: SubmissionActionDto) {
    return this.act(principal, id, 'SUBMIT', dto.version, () => ({
      comment: dto.comment,
      data: { submittedAt: new Date() },
    }));
  }

  startReview(principal: Principal, id: string, dto: SubmissionActionDto) {
    return this.act(principal, id, 'START_REVIEW', dto.version, () => ({
      comment: dto.comment,
      data: {
        reviewerId: principal.id,
        reviewerName: principal.displayName,
        reviewStartedAt: new Date(),
      },
    }));
  }

  requestChanges(principal: Principal, id: string, dto: RequestChangesDto) {
    return this.act(principal, id, 'REQUEST_CHANGES', dto.version, (record) => {
      const known = new Set(record.fields.map((field) => field.field));
      const returned = dto.fields.map((field) => field.field);
      if (returned.some((field) => !known.has(field))) {
        throw new BadRequestException('Unknown field in returned fields');
      }
      if (new Set(returned).size !== returned.length) {
        throw new BadRequestException('Each field can be returned only once');
      }
      return {
        comment: dto.comment,
        data: { decidedAt: new Date() },
        fieldUpdates: dto.fields.map((field) => ({
          field: field.field,
          data: {
            correctionStatus: 'REQUIRED',
            reviewerComment: field.comment,
          },
        })),
      };
    });
  }

  approve(principal: Principal, id: string, dto: SubmissionActionDto) {
    return this.act(principal, id, 'APPROVE', dto.version, (record) => ({
      registry: {
        societyId: record.societyId,
        changes: resolveRegistryChanges(record.type, record.fields),
      },
      comment: dto.comment,
      data: { decidedAt: new Date() },
    }));
  }

  reject(principal: Principal, id: string, dto: SubmissionActionDto) {
    return this.act(principal, id, 'REJECT', dto.version, () => {
      if (!dto.comment) {
        throw new BadRequestException('A reason is required to reject');
      }
      return { comment: dto.comment, data: { decidedAt: new Date() } };
    });
  }

  resubmit(principal: Principal, id: string, dto: ResubmitDto) {
    return this.act(principal, id, 'RESUBMIT', dto.version, (record) => {
      const required = record.fields
        .filter((field) => field.correctionStatus === 'REQUIRED')
        .map((field) => field.field);
      const sent = dto.corrections.map((correction) => correction.field);
      for (const correction of dto.corrections) {
        assertChangesSupported(record.type, [
          { field: correction.field, proposedValue: correction.correctedValue },
        ]);
      }
      const sameSet =
        sent.length === required.length &&
        required.every((field) => sent.includes(field));
      if (!sameSet) {
        throw new BadRequestException(
          'Correct exactly the fields that were returned',
        );
      }
      return {
        comment: dto.comment,
        data: { submittedAt: new Date() },
        fieldUpdates: dto.corrections.map((correction) => ({
          field: correction.field,
          data: {
            correctionStatus: 'CORRECTED',
            correctedValue: correction.correctedValue as never,
          },
        })),
      };
    });
  }

  // ---- internals ----

  /** Order of checks: scope (404), role and state (403/409), stale version (409), input (400). */
  private async act(
    principal: Principal,
    id: string,
    action: SubmissionAction,
    version: number,
    build: (record: SubmissionRecord) => Extras,
  ) {
    const record = await this.load(principal, id);
    const to = applyTransition(record.status, action, principal.roles);
    if (record.version !== version) {
      throw new ConflictException(
        'This submission changed since you opened it. Reload and try again',
      );
    }
    const extras = build(record);
    const applied = await this.repository.transition({
      id,
      version,
      from: record.status,
      to,
      action,
      actor: { id: principal.id, name: principal.displayName },
      ...extras,
    });
    if (!applied) {
      throw new ConflictException(
        'This submission changed since you opened it. Reload and try again',
      );
    }
    return this.get(principal, id);
  }

  private async load(principal: Principal, id: string) {
    const record = await this.repository.findById(id);
    const notFound = new NotFoundException('Submission not found');
    if (!record) throw notFound;

    const isHq = principal.roles.includes('HQ_ADMIN');
    const isOfficer =
      principal.roles.includes('SOCIETY_OFFICER') &&
      principal.societyIds.includes(record.societyId);
    const isManager =
      principal.roles.includes('DISTRICT_MANAGER') &&
      principal.districtIds.includes(record.society.districtId);
    if (!isHq && !isOfficer && !isManager) throw notFound;
    // Reviewers never see drafts.
    if (!isOfficer && record.status === 'DRAFT') throw notFound;
    return record;
  }

  private scopeWhere(principal: Principal) {
    if (principal.roles.includes('HQ_ADMIN')) {
      return { status: { not: 'DRAFT' as const } };
    }
    if (principal.roles.includes('DISTRICT_MANAGER')) {
      return {
        status: { not: 'DRAFT' as const },
        society: { districtId: { in: principal.districtIds } },
      };
    }
    return { societyId: { in: principal.societyIds } };
  }

  private toDetail(record: SubmissionRecord, principal: Principal) {
    const iso = (date: Date | null) => (date ? date.toISOString() : undefined);
    const orUndefined = <T>(value: T | null) => value ?? undefined;
    const hasRequired = record.fields.some((f) => f.correctionStatus === 'REQUIRED');
    const hasCorrected = record.fields.some((f) => f.correctionStatus === 'CORRECTED');

    return {
      id: record.id,
      reference: `SUB-${String(record.seq).padStart(5, '0')}`,
      societyId: record.societyId,
      type: record.type,
      title: record.title,
      submittedBy: record.submittedById,
      status: record.status,
      version: record.version,
      correctionStatus: hasRequired ? 'REQUIRED' : hasCorrected ? 'CORRECTED' : 'NONE',
      changes: record.fields.map((field) => ({
        field: field.field,
        label: field.label,
        previousValue: orUndefined(field.previousValue),
        proposedValue: field.proposedValue,
        correctionStatus: field.correctionStatus,
        reviewerComment: orUndefined(field.reviewerComment),
        correctedValue: orUndefined(field.correctedValue),
      })),
      documents: [],
      reviews: record.events
        .filter((event) => DECISIONS[event.action as SubmissionAction])
        .map((event) => ({
          id: event.id,
          reviewerUserId: event.actorId,
          reviewerDisplayName: event.actorName,
          decision: DECISIONS[event.action as SubmissionAction],
          comment: orUndefined(event.comment),
          decidedAt: event.createdAt.toISOString(),
        })),
      events: record.events.map((event) => ({
        id: event.id,
        action: event.action,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        actorId: event.actorId,
        actorDisplayName: event.actorName,
        comment: orUndefined(event.comment),
        createdAt: event.createdAt.toISOString(),
      })),
      reviewerDisplayName: orUndefined(record.reviewerName),
      reviewStartedAt: iso(record.reviewStartedAt),
      submittedAt: iso(record.submittedAt),
      updatedAt: record.updatedAt.toISOString(),
      allowedActions: allowedActions(record.status, principal.roles),
      /** Officers may edit only while the submission is open for editing. */
      editable: OPEN_FOR_EDIT.includes(record.status),
    };
  }
}