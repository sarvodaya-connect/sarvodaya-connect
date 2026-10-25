import { BadRequestException } from '@nestjs/common';

import type { MembershipCategory } from '../generated/prisma/client.js';
import type { SubmissionTypeValue } from './dto/submission.dto.js';

/**
 * Explicit allowlist of the society registry fields that approving a
 * submission may change. Anything not listed here is rejected. System-
 * controlled fields (id, societyCode, districtId, status) are never listed.
 * Mirrors the REGISTRY_UPDATE_* constants in packages/api-contracts.
 */
export type RegistryScalar = string | number | null;

export const REGISTRY_SUBMISSION_TYPES = [
  'PROFILE_UPDATE',
  'COUNCIL_UPDATE',
  'MEMBERSHIP_COUNTS',
] as const;
export type RegistrySubmissionType = (typeof REGISTRY_SUBMISSION_TYPES)[number];

export const PROFILE_COLUMNS = [
  'nameEn',
  'nameLocal',
  'dsDivision',
  'gnDivision',
  'village',
  'addressLine',
  'latitude',
  'longitude',
  'establishedOn',
] as const;
export type ProfileColumn = (typeof PROFILE_COLUMNS)[number];

export const COUNCIL_COLUMNS = [
  'fullName',
  'position',
  'appointedOn',
  'endedOn',
] as const;
export type CouncilColumn = (typeof COUNCIL_COLUMNS)[number];

export const MEMBERSHIP_CATEGORIES: readonly MembershipCategory[] = [
  'CHILDREN',
  'YOUTH',
  'MOTHERS',
  'ORDINARY',
  'ELDERS_COUNCIL',
];
export const MEMBERSHIP_GENDERS = ['female', 'male'] as const;
export type MembershipGender = (typeof MEMBERSHIP_GENDERS)[number];

export type RegistryTarget =
  | { kind: 'profile'; column: ProfileColumn }
  | { kind: 'council'; seatNumber: number; column: CouncilColumn }
  | {
      kind: 'membership';
      year: number;
      category: MembershipCategory;
      gender: MembershipGender;
    };

export interface ResolvedRegistryChange {
  field: string;
  target: RegistryTarget;
  /** What the submitter saw in the registry; null when it was empty. */
  previousValue: unknown;
  /** The value to apply: the corrected value when there is one. */
  value: RegistryScalar;
}

export interface SubmissionFieldValues {
  field: string;
  previousValue: unknown;
  proposedValue: unknown;
  correctedValue: unknown;
}

type Validator = (value: unknown) => RegistryScalar;

function text(min: number, max: number): Validator {
  return (value) => {
    if (typeof value !== 'string') throw new Error('must be text');
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max) {
      throw new Error(`must be ${min} to ${max} characters`);
    }
    return trimmed;
  };
}

function numberBetween(min: number, max: number): Validator {
  return (value) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    ) {
      throw new Error(`must be a number from ${min} to ${max}`);
    }
    return value;
  };
}

function wholeNumberBetween(min: number, max: number): Validator {
  return (value) => {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    ) {
      throw new Error(`must be a whole number from ${min} to ${max}`);
    }
    return value;
  };
}

const isoDate: Validator = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('must be a date written as YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('must be a real calendar date');
  }
  return value;
};

const PROFILE_VALIDATORS: Record<ProfileColumn, Validator> = {
  nameEn: text(2, 150),
  nameLocal: text(1, 150),
  dsDivision: text(1, 100),
  gnDivision: text(1, 100),
  village: text(1, 100),
  addressLine: text(1, 255),
  latitude: numberBetween(-90, 90),
  longitude: numberBetween(-180, 180),
  establishedOn: isoDate,
};

const COUNCIL_VALIDATORS: Record<CouncilColumn, Validator> = {
  fullName: text(2, 150),
  position: text(2, 100),
  appointedOn: isoDate,
  endedOn: isoDate,
};

const MEMBERSHIP_VALIDATOR = wholeNumberBetween(0, 1_000_000);

function isOneOf<T extends string>(
  list: readonly T[],
  value: string,
): value is T {
  return (list as readonly string[]).includes(value);
}

export function isRegistryType(type: string): type is RegistrySubmissionType {
  return (REGISTRY_SUBMISSION_TYPES as readonly string[]).includes(type);
}

function parseTarget(
  type: RegistrySubmissionType,
  field: string,
): RegistryTarget | undefined {
  const parts = field.split('.');
  if (type === 'PROFILE_UPDATE') {
    const [root, column] = parts;
    if (
      parts.length === 2 &&
      root === 'profile' &&
      column !== undefined &&
      isOneOf(PROFILE_COLUMNS, column)
    ) {
      return { kind: 'profile', column };
    }
    return undefined;
  }
  if (type === 'COUNCIL_UPDATE') {
    const [root, seat, column] = parts;
    if (
      parts.length === 3 &&
      root === 'council' &&
      seat !== undefined &&
      column !== undefined &&
      /^\d{1,2}$/.test(seat) &&
      isOneOf(COUNCIL_COLUMNS, column)
    ) {
      const seatNumber = Number(seat);
      if (seatNumber >= 1 && seatNumber <= 25) {
        return { kind: 'council', seatNumber, column };
      }
    }
    return undefined;
  }
  const [root, yearText, category, gender] = parts;
  if (
    parts.length === 4 &&
    root === 'membership' &&
    yearText !== undefined &&
    category !== undefined &&
    gender !== undefined &&
    /^\d{4}$/.test(yearText) &&
    isOneOf(MEMBERSHIP_CATEGORIES, category) &&
    isOneOf(MEMBERSHIP_GENDERS, gender)
  ) {
    const year = Number(yearText);
    if (year >= 1900 && year <= 2200) {
      return { kind: 'membership', year, category, gender };
    }
  }
  return undefined;
}

function validatorFor(target: RegistryTarget): Validator {
  switch (target.kind) {
    case 'profile':
      return PROFILE_VALIDATORS[target.column];
    case 'council':
      return COUNCIL_VALIDATORS[target.column];
    case 'membership':
      return MEMBERSHIP_VALIDATOR;
  }
}

/** Resolves one submitted field, or throws 400 when it is not allowlisted or its value is invalid. */
export function resolveRegistryChange(
  type: RegistrySubmissionType,
  field: string,
  value: unknown,
  previousValue?: unknown,
): ResolvedRegistryChange {
  const target = parseTarget(type, field);
  if (!target) {
    throw new BadRequestException(
      `"${field}" cannot be changed through a ${type} submission`,
    );
  }
  try {
    return {
      field,
      target,
      previousValue: previousValue === undefined ? null : previousValue,
      value: validatorFor(target)(value),
    };
  } catch (error) {
    throw new BadRequestException(
      `Invalid value for "${field}": ${error instanceof Error ? error.message : 'not accepted'}`,
    );
  }
}

/** Rejects unsupported fields and bad values early. Record-only types are not checked. */
export function assertChangesSupported(
  type: SubmissionTypeValue,
  changes: readonly { field: string; proposedValue: unknown }[],
): void {
  if (!isRegistryType(type)) return;
  for (const change of changes) {
    resolveRegistryChange(type, change.field, change.proposedValue);
  }
}

/** The registry changes an approval will apply. Empty for record-only types. */
export function resolveRegistryChanges(
  type: SubmissionTypeValue,
  fields: readonly SubmissionFieldValues[],
): ResolvedRegistryChange[] {
  if (!isRegistryType(type)) return [];
  return fields.map((item) =>
    resolveRegistryChange(
      type,
      item.field,
      item.correctedValue ?? item.proposedValue,
      item.previousValue,
    ),
  );
}
