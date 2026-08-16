import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { AuthGuard, CurrentUser } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.requestsService.findAll(user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.requestsService.findOne(id, user);
  }

  @Roles(RoleType.EMPLOYEE)
  @Post()
  async createDraft(@CurrentUser() user: any, @Body() data: any) {
    return this.requestsService.createDraft(user, data);
  }

  @Roles(RoleType.EMPLOYEE)
  @Patch(':id')
  async updateDraft(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.requestsService.updateDraft(user, id, data);
  }

  @Roles(RoleType.EMPLOYEE)
  @Post(':id/submit')
  async submitRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.requestsService.submitRequest(user, id);
  }
}
