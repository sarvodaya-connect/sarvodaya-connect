import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { NOTIFICATION_TOPIC_VALUES } from '../notifications.repository.js';

/** V5 D19 filter chips; Records covers documents, audits and yearly figures. */
export const ALERT_FILTERS = {
  grades: ['GRADE_REQUEST'],
  incidents: ['INCIDENT'],
  access: ['ACCESS', 'ACCOUNT'],
  records: ['RECORDS', 'INFORMATION_REQUEST'],
  activities: ['ACTIVITY'],
} as const satisfies Record<string, readonly (typeof NOTIFICATION_TOPIC_VALUES)[number][]>;

export class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unreadOnly = false;

  @IsOptional()
  @IsIn(Object.keys(ALERT_FILTERS))
  filter?: keyof typeof ALERT_FILTERS;
}
