import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { AuthGuard, CurrentUser } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/requests')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Roles(RoleType.MANAGER)
  @Post(':id/manager-approval')
  async managerApproval(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVE' | 'RETURN' | 'REJECT',
    @Body('comment') comment?: string,
  ) {
    return this.workflowService.managerApproval(user, id, decision, comment);
  }

  @Roles(RoleType.MANAGER)
  @Post(':id/senior-approval')
  async seniorApproval(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVE' | 'RETURN' | 'REJECT',
    @Body('comment') comment?: string,
  ) {
    return this.workflowService.seniorApproval(user, id, decision, comment);
  }

  @Roles(RoleType.IT)
  @Post(':id/it-review')
  async itReview(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVE' | 'RETURN' | 'REJECT',
    @Body('comment') comment?: string,
  ) {
    return this.workflowService.itReview(user, id, decision, comment);
  }
}
