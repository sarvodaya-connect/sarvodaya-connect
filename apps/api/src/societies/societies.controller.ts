import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import { SocietiesService } from './societies.service.js';
@Controller('societies')
export class SocietiesController {
  constructor(private readonly service: SocietiesService) {}
  @Get() list(@Query() query: SocietyQueryDto) { return this.service.list(query); }
  @Get(':id') getById(@Param('id', new ParseUUIDPipe()) id: string) { return this.service.getById(id); }
}
