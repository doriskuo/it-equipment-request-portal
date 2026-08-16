import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { AuthGuard, CurrentUser } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/requests')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Roles(RoleType.PROCUREMENT)
  @Post(':id/procurement/start')
  async startProcurement(@CurrentUser() user: any, @Param('id') id: string) {
    return this.procurementService.startProcurement(user, id);
  }

  @Roles(RoleType.PROCUREMENT)
  @Post(':id/procurement/complete')
  async completeProcurement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.procurementService.completeProcurement(user, id, data);
  }

  @Roles(RoleType.PROCUREMENT)
  @Post(':id/procurement/simulate')
  async simulateProcurement(@Param('id') id: string) {
    return this.procurementService.simulateProcurement(id);
  }

  @Post(':id/procurement/return')
  async returnProcurement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('comment') comment: string,
  ) {
    return this.procurementService.returnProcurement(user, id, comment);
  }

  @Post(':id/accounting/confirm')
  async confirmAccounting(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.procurementService.confirmAccounting(user, id, data);
  }

  @Roles(RoleType.ACCOUNTING)
  @Post(':id/accounting/simulate')
  async simulateAccounting(@Param('id') id: string) {
    return this.procurementService.simulateAccounting(id);
  }

  @Post(':id/accounting/return')
  async returnAccounting(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('comment') comment: string,
  ) {
    return this.procurementService.returnAccounting(user, id, comment);
  }

  @Roles(RoleType.PROCUREMENT)
  @Post(':id/delivery')
  async delivery(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.procurementService.delivery(user, id, data);
  }

  @Roles(RoleType.EMPLOYEE)
  @Post(':id/receipt-confirm')
  async receiptConfirm(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.procurementService.receiptConfirm(user, id, data);
  }

  @Roles(RoleType.EMPLOYEE)
  @Post(':id/items/:itemId/confirm-receipt')
  async confirmItemReceipt(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.procurementService.confirmItemReceipt(user, id, itemId);
  }
}
