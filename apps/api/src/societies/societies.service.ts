import { Injectable, NotFoundException } from '@nestjs/common';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import {
  SocietiesRepository,
  type SocietyRecord,
} from './societies.repository.js';

// Fields not persisted in the current database schema are provisional.
// Verification status and profile completeness are not derived from registry status.
function summary(record: SocietyRecord) {
  return {
    id: record.id,
    societyCode: record.societyCode,
    nameEn: record.nameEn,
    ...(record.nameLocal ? { nameLocal: record.nameLocal } : {}),
    district: {
      id: record.district.id,
      code: record.district.code,
      nameEn: record.district.nameEn,
    },
    status: record.status,
    verificationStatus: 'UNVERIFIED' as const,
    profileCompleteness: 0,
    updatedAt: record.updatedAt.toISOString(),
  };
}
@Injectable()
export class SocietiesService {
  constructor(private readonly repository: SocietiesRepository) {}
  async list(query: SocietyQueryDto) {
    // Until verification is persisted, only UNVERIFIED can be returned truthfully.
    if (query.verificationStatus && query.verificationStatus !== 'UNVERIFIED') {
      return {
        data: [],
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems: 0,
          totalPages: 0,
        },
      };
    }
    const { records, totalItems } = await this.repository.list(query);
    return {
      data: records.map(summary),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }
  async getById(id: string) {
    const record = await this.repository.findById(id);
    if (!record) throw new NotFoundException('Society not found');
    return {
      ...summary(record),
      ...(record.establishedOn
        ? { establishedOn: record.establishedOn.toISOString().slice(0, 10) }
        : {}),
      address: {
        ...(record.addressLine ? { addressLine: record.addressLine } : {}),
        ...(record.village ? { village: record.village } : {}),
        ...(record.gnDivision ? { gnDivision: record.gnDivision } : {}),
        ...(record.dsDivision ? { dsDivision: record.dsDivision } : {}),
      },
      ...(record.latitude != null && record.longitude != null
        ? {
            location: {
              latitude: record.latitude,
              longitude: record.longitude,
            },
          }
        : {}),
      contacts: record.contacts.map((c) => ({
        id: c.id,
        ...(c.label ? { label: c.label } : {}),
        ...(c.phone ? { phone: c.phone } : {}),
        ...(c.email ? { email: c.email } : {}),
        isPrimary: c.isPrimary,
      })),
      committee: [],
      documents: [],
      history: [],
      createdAt: record.createdAt.toISOString(),
    };
  }
}
