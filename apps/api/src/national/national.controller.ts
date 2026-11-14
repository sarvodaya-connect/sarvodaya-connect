import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  DirectoryQueryDto,
  MapQueryDto,
  PagedYearQueryDto,
  YearQueryDto,
} from './directory.dto.js';
import { DirectoryService } from './directory.service.js';
import { NationalService } from './national.service.js';
import {
  REPORT_TYPE_VALUES,
  ReportQueryDto,
  ReportsService,
  type ReportTypeValue,
  toCsv,
} from './reports.service.js';
import {
  CreateInformationRequestDto,
  RequestListQueryDto,
  RequestsService,
  RespondDto,
} from './requests.service.js';
import { SearchQueryDto, SearchService } from './search.service.js';

/**
 * Issue #117: D07 / M64 Programmes & Activities for a DM, DDM or SPC, over
 * the societies they may see. HQ keeps `GET national/programmes`.
 */
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles(
  'DISTRICT_MANAGER',
  'DEPUTY_DISTRICT_MANAGER',
  'PROGRAMME_COORDINATOR',
)
export class ScopedProgrammesController {
  constructor(private readonly national: NationalService) {}

  @Get('programmes')
  programmes(
    @Query() query: YearQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.national.scopedProgrammes(principal, query.year);
  }
}

/** V5 D02 and its drill-downs, D13 and D15: HQ only. */
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('HQ_ADMIN')
export class NationalController {
  constructor(
    private readonly national: NationalService,
    private readonly requests: RequestsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('national/overview')
  overview(@Query() query: YearQueryDto) {
    return this.national.overview(query.year);
  }

  @Get('national/districts')
  districts(@Query() query: YearQueryDto) {
    return this.national.districts(query.year);
  }

  @Get('national/map')
  map(@Query() query: MapQueryDto) {
    return this.national.map(query);
  }

  @Get('national/membership')
  membership() {
    return this.national.membership();
  }

  @Get('national/programmes')
  programmes(@Query() query: YearQueryDto) {
    return this.national.programmes(query.year);
  }

  @Get('national/finance')
  finance(@Query() query: PagedYearQueryDto) {
    return this.national.finance(query);
  }

  @Get('information-requests')
  listRequests(@Query() query: RequestListQueryDto) {
    return this.requests.list(query.page);
  }

  @Post('information-requests')
  createRequest(
    @Body() input: CreateInformationRequestDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.requests.create(input, principal);
  }

  @Get('hq-tasks')
  tasks() {
    return this.requests.tasks();
  }

  @Get('reports/:type')
  @Header('Cache-Control', 'no-store')
  async report(
    @Param('type', new ParseEnumPipe(REPORT_TYPE_VALUES)) type: ReportTypeValue,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const report = await this.reports.report(type, query);
    if (query.format !== 'csv') return report;
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}-${report.financialYear.startYear}.csv"`,
    );
    return toCsv(report.columns, report.rows);
  }
}

/** V5 D04 / M66 / M67 and D18, and the society side of D13: every role, within its scope. */
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class DirectoryController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly search: SearchService,
    private readonly requests: RequestsService,
  ) {}

  @Get('society-directory')
  list(
    @Query() query: DirectoryQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.directory.list(query, principal);
  }

  @Get('societies/:id/summary')
  summary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.directory.summary(id, principal);
  }

  @Get('search')
  find(
    @Query() query: SearchQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.search.search(query, principal);
  }

  @Get('information-requests/inbox')
  @RequireRoles(
    'SOCIETY_OFFICER',
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
  )
  inbox(@CurrentPrincipal() principal: Principal) {
    return this.requests.inbox(principal);
  }

  @Post('information-requests/:id/societies/:societyId/respond')
  @HttpCode(200)
  @RequireRoles(
    'SOCIETY_OFFICER',
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
  )
  respond(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('societyId', new ParseUUIDPipe()) societyId: string,
    @Body() input: RespondDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.requests.respond(id, societyId, input, principal);
  }
}
