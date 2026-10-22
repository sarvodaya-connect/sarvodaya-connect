import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Principal } from '../auth/principal.js';
import { ActivitiesRepository } from './activities.repository.js';
import { ActivityInputDto, ActivityQueryDto } from './dto/activity.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repository: ActivitiesRepository) {}
  private async assertSociety(id: string, principal: Principal) {
    if (!(await this.repository.canAccessSociety(id, principal)))
      throw new ForbiddenException(
        'You are not authorised to use this society',
      );
  }
  private validate(input: ActivityInputDto, submitting = false) {
    if ((input.latitude == null) !== (input.longitude == null))
      throw new BadRequestException(
        'Latitude and longitude must be supplied together',
      );
    if (new Date(input.activityDate).getTime() > Date.now())
      throw new BadRequestException('Activity date cannot be in the future');
    if (
      submitting &&
      input.femaleParticipants +
        input.maleParticipants +
        (input.otherParticipants ?? 0) <
        1
    )
      throw new BadRequestException(
        'A submitted activity must have at least one participant',
      );
    if (
      !input.title.trim() ||
      !input.description.trim() ||
      !input.location.trim() ||
      !input.sector.trim()
    )
      throw new BadRequestException(
        'Title, description, location and sector are required',
      );
  }
  private present(record: any) {
    const total =
      record.femaleParticipants +
      record.maleParticipants +
      record.otherParticipants;
    return {
      id: record.id,
      societyId: record.societyId,
      societyName: record.society.nameEn,
      districtId: record.society.districtId,
      districtName: record.society.district.nameEn,
      title: record.title,
      description: record.description,
      activityDate: record.activityDate.toISOString().slice(0, 10),
      location: record.location,
      ...(record.latitude != null
        ? {
            locationCoordinates: {
              latitude: record.latitude,
              longitude: record.longitude,
            },
          }
        : {}),
      classification: {
        sector: record.classification.sector,
        dimension: record.classification.dimension,
        sdgs: record.sdgs,
      },
      participants: {
        female: record.femaleParticipants,
        male: record.maleParticipants,
        other: record.otherParticipants,
        total,
      },
      ...(record.outcomes ? { outcomes: record.outcomes } : {}),
      status: record.status,
      submittedBy: record.submittedById,
      ...(record.submittedAt
        ? { submittedAt: record.submittedAt.toISOString() }
        : {}),
      ...(record.approvedAt
        ? { approvedAt: record.approvedAt.toISOString() }
        : {}),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
  async create(input: ActivityInputDto, principal: Principal, submit = false) {
    await this.assertSociety(input.societyId, principal);
    this.validate(input, submit);
    return this.present(
      await this.repository.create(
        input,
        principal,
        submit ? 'SUBMITTED' : 'DRAFT',
      ),
    );
  }
  async saveDraft(id: string, input: ActivityInputDto, principal: Principal) {
    const current = await this.repository.find(id, principal);
    if (!current) throw new NotFoundException('Activity not found');
    if (current.submittedById !== principal.id || current.status !== 'DRAFT')
      throw new ForbiddenException('Only the owner can edit a draft');
    if (input.societyId !== current.societyId)
      throw new BadRequestException('Activity society cannot be changed');
    this.validate(input);
    const updated = await this.repository.updateDraft(id, input, principal.id);
    if (!updated)
      throw new ConflictException(
        'Activity draft changed before it could be saved',
      );
    return this.present(updated);
  }
  async submit(id: string, principal: Principal) {
    const current = await this.repository.find(id, principal);
    if (!current) throw new NotFoundException('Activity not found');
    if (
      current.submittedById !== principal.id ||
      !['DRAFT', 'RESUBMITTED'].includes(current.status)
    )
      throw new ForbiddenException('Only the owner can submit a draft');
    if (
      current.femaleParticipants +
        current.maleParticipants +
        current.otherParticipants <
      1
    )
      throw new BadRequestException(
        'A submitted activity must have at least one participant',
      );
    const submitted = await this.repository.submit(id, principal.id);
    if (!submitted)
      throw new ConflictException(
        'Activity status changed before it could be submitted',
      );
    return this.present(submitted);
  }
  async list(query: ActivityQueryDto, principal: Principal) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException(
        'The from date must be on or before the to date',
      );
    const result = await this.repository.list(query, principal);
    return {
      ...result,
      data: result.data.map((record) => this.present(record)),
    };
  }
  async detail(id: string, principal: Principal) {
    const record = await this.repository.find(id, principal);
    if (!record) throw new NotFoundException('Activity not found');
    return this.present(record);
  }
  summary(query: ActivityQueryDto, principal: Principal) {
    if (query.status && query.status !== 'APPROVED')
      throw new BadRequestException(
        'Activity summaries only include approved records',
      );
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException(
        'The from date must be on or before the to date',
      );
    return this.repository.summary(query, principal);
  }
}
