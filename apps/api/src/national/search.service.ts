import { Injectable } from '@nestjs/common';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { Principal } from '../auth/principal.js';
import type { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { financialYear } from '../societies/financial-year.js';
import { societyWhereForPrincipal } from '../societies/society-access.policy.js';

export const SEARCH_TYPES = [
  'society',
  'person',
  'document',
  'activity',
  'request',
] as const;
type SearchType = (typeof SEARCH_TYPES)[number];

export class SearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type?: SearchType;
}

const PER_TYPE = 10;
const ONE_TYPE = 25;

const ROLE_LABELS: Record<string, string> = {
  SOCIETY_OFFICER: 'Society Officer',
  PROGRAMME_COORDINATOR: 'SPC',
  DEPUTY_DISTRICT_MANAGER: 'DDM',
  DISTRICT_MANAGER: 'District Manager',
  HQ_ADMIN: 'HQ',
};

const DOCUMENT_LABELS: Record<string, string> = {
  AUDIT_REPORT: 'Audit report',
  AGM_MINUTES: 'AGM minutes',
  OFFICE_BEARER_LIST: 'Office-bearer list',
  MEMBERS_LIST: 'Members list',
};

const contains = (value: string) => ({
  contains: value,
  mode: 'insensitive' as const,
});

/**
 * V5 D18: societies, people, documents, activities and grade requests the
 * user may open. Names, S numbers and titles are searched; NICs, phone
 * numbers and addresses never are, and are never returned.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: SearchQueryDto, principal: Principal) {
    const q = input.q.trim();
    const scope = societyWhereForPrincipal(principal);
    const isHq = principal.roles.includes('HQ_ADMIN');
    const seesMembersList =
      isHq || principal.roles.includes('DISTRICT_MANAGER');
    const inSociety: Prisma.SocietyWhereInput = {
      AND: [
        scope,
        {
          OR: [
            { nameEn: contains(q) },
            { nameLocal: contains(q) },
            { societyCode: contains(q) },
          ],
        },
      ],
    };
    const societyWhere: Prisma.SocietyWhereInput = inSociety;
    const memberWhere: Prisma.SocietyCouncilMemberWhereInput = {
      isActive: true,
      fullName: contains(q),
      society: scope,
    };
    const accountWhere: Prisma.PlatformAccountWhereInput = isHq
      ? { displayName: contains(q) }
      : { id: { in: [] } };
    const documentWhere: Prisma.SocietyDocumentWhereInput = {
      uploadedAt: { not: null },
      society: scope,
      ...(seesMembersList ? {} : { documentType: { not: 'MEMBERS_LIST' } }),
      OR: [{ title: contains(q) }, { society: inSociety }],
    };
    const activityWhere: Prisma.WorkPlanActivityWhereInput = {
      society: scope,
      OR: [{ name: contains(q) }, { society: inSociety }],
    };
    const requestWhere: Prisma.GradeChangeRequestWhereInput = {
      society: inSociety,
    };
    const take = (type: SearchType) =>
      input.type === undefined ? PER_TYPE : input.type === type ? ONE_TYPE : 0;

    const [counts, rows] = await executeDatabaseOperation(() =>
      Promise.all([
        Promise.all([
          this.prisma.society.count({ where: societyWhere }),
          this.prisma.societyCouncilMember.count({ where: memberWhere }),
          this.prisma.platformAccount.count({ where: accountWhere }),
          this.prisma.societyDocument.count({ where: documentWhere }),
          this.prisma.workPlanActivity.count({ where: activityWhere }),
          this.prisma.gradeChangeRequest.count({ where: requestWhere }),
        ]),
        Promise.all([
          this.prisma.society.findMany({
            where: societyWhere,
            include: { district: { select: { nameEn: true } } },
            orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
            take: take('society'),
          }),
          this.prisma.platformAccount.findMany({
            where: accountWhere,
            select: { id: true, displayName: true, role: true, status: true },
            orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
            take: take('person'),
          }),
          this.prisma.societyCouncilMember.findMany({
            where: memberWhere,
            select: {
              id: true,
              fullName: true,
              position: true,
              society: { select: { id: true, nameEn: true } },
            },
            orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            take: take('person'),
          }),
          this.prisma.societyDocument.findMany({
            where: documentWhere,
            select: {
              id: true,
              title: true,
              documentType: true,
              financialYear: true,
              uploadedAt: true,
              society: { select: { id: true, nameEn: true } },
            },
            orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
            take: take('document'),
          }),
          this.prisma.workPlanActivity.findMany({
            where: activityWhere,
            select: {
              id: true,
              name: true,
              status: true,
              datesLabel: true,
              year: true,
              societyId: true,
              society: { select: { nameEn: true } },
              sdgs: { select: { sdg: true }, orderBy: { sdg: 'asc' } },
            },
            orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'asc' }],
            take: take('activity'),
          }),
          this.prisma.gradeChangeRequest.findMany({
            where: requestWhere,
            select: {
              id: true,
              fromGrade: true,
              toGrade: true,
              status: true,
              requestedAt: true,
              requestedByName: true,
              requestedByRole: true,
              society: { select: { id: true, nameEn: true } },
            },
            orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
            take: take('request'),
          }),
        ]),
      ]),
    );
    const [societies, accounts, members, documents, activities, requests] =
      rows;
    const date = (value: Date) =>
      value.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Colombo',
      });

    const people = [
      ...accounts.map((account) => ({
        type: 'person' as const,
        id: account.id,
        title: account.displayName,
        subtitle: `${ROLE_LABELS[account.role] ?? account.role} account`,
        status:
          account.status === 'ACTIVE'
            ? 'Account active'
            : account.status === 'DISABLED'
              ? 'Account disabled'
              : 'Account pending',
        href: `/accounts?q=${encodeURIComponent(account.displayName)}`,
      })),
      ...members.map((member) => ({
        type: 'person' as const,
        id: member.id,
        title: member.fullName,
        subtitle: `Exco · ${member.position} · ${member.society.nameEn}`,
        status: 'Exco',
        href: `/societies/${member.society.id}/exco`,
      })),
    ].slice(0, take('person'));

    return {
      query: q,
      counts: {
        society: counts[0],
        person: counts[1] + counts[2],
        document: counts[3],
        activity: counts[4],
        request: counts[5],
      },
      data: [
        ...societies.map((society) => ({
          type: 'society' as const,
          id: society.id,
          title: society.nameEn,
          subtitle: [
            'Society',
            society.societyCode,
            society.district.nameEn,
            society.nameLocal,
          ]
            .filter(Boolean)
            .join(' · '),
          status: society.status === 'ACTIVE' ? 'Active' : 'Not active',
          href: `/societies/${society.id}`,
        })),
        ...people,
        ...documents.map((document) => ({
          type: 'document' as const,
          id: document.id,
          title:
            document.financialYear !== null
              ? `${DOCUMENT_LABELS[document.documentType] ?? document.title} ${financialYear(document.financialYear).label}`
              : document.title,
          subtitle: `Document · ${document.society.nameEn} · uploaded ${date(document.uploadedAt!)}`,
          status: null,
          href: `/societies/${document.society.id}/documents${document.financialYear !== null ? `?year=${document.financialYear}` : ''}`,
        })),
        ...activities.map((activity) => ({
          type: 'activity' as const,
          id: activity.id,
          title: activity.name,
          subtitle: [
            'Activity',
            activity.society.nameEn,
            activity.datesLabel
              ? `${activity.datesLabel} ${activity.year}`
              : String(activity.year),
          ].join(' · '),
          status:
            activity.status === 'APPROVED'
              ? `Approved${activity.sdgs.length ? ` · SDG ${activity.sdgs.map((row) => row.sdg).join(', ')}` : ''}`
              : activity.status === 'SENT_BACK'
                ? 'Sent back'
                : 'Waiting for SPC',
          href: `/societies/${activity.societyId}/work-plan`,
        })),
        ...requests.map((request) => ({
          type: 'request' as const,
          id: request.id,
          title: `Grade change ${request.fromGrade ?? '–'} → ${request.toGrade}`,
          subtitle: `Grade request · ${request.society.nameEn} · sent ${date(request.requestedAt)} by ${request.requestedByName} (${ROLE_LABELS[request.requestedByRole] ?? request.requestedByRole})`,
          status:
            request.status === 'PENDING'
              ? 'Waiting for HQ'
              : request.status === 'APPROVED'
                ? 'Approved'
                : 'Not approved',
          href: isHq
            ? `/reviews/${request.id}`
            : `/societies/${request.society.id}`,
        })),
      ],
    };
  }
}
