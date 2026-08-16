import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcurementStatus, RoleType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async recordAction(
    requestId: string,
    revisionNo: number,
    actorId: string,
    actorRole: RoleType,
    action: string,
    fromStatus: ProcurementStatus,
    toStatus: ProcurementStatus,
    comment?: string,
  ) {
    await this.prisma.workflowAction.create({
      data: {
        requestId,
        revisionNo,
        actorId,
        actorRole,
        action,
        fromStatus,
        toStatus,
        comment,
      },
    });
  }

  async managerApproval(
    user: any,
    requestId: string,
    decision: 'APPROVE' | 'RETURN' | 'REJECT',
    comment?: string,
  ) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (
      request.status !== ProcurementStatus.PENDING_DEPARTMENT_MANAGER_APPROVAL
    ) {
      throw new BadRequestException('Not pending department manager approval');
    }
    if (request.currentAssigneeId !== user.id) {
      throw new ForbiddenException('You are not the assigned approver');
    }
    if (request.requesterId === user.id) {
      throw new ForbiddenException('Self-approval is not allowed');
    }

    const fromStatus = request.status;
    let toStatus: ProcurementStatus = fromStatus;
    let nextAssigneeId = null;
    let nextRole = null;

    if (!['APPROVE', 'RETURN', 'REJECT'].includes(decision)) {
      throw new BadRequestException('Invalid decision');
    }
    if (
      ['RETURN', 'REJECT'].includes(decision) &&
      (!comment || comment.trim() === '')
    ) {
      throw new BadRequestException('Comment is required for RETURN or REJECT');
    }

    if (decision === 'APPROVE') {
      if (Number(request.estimatedTotalAmount) >= 50000) {
        toStatus = ProcurementStatus.PENDING_SENIOR_MANAGER_APPROVAL;
        const seniorApproverId = user.managerId;
        if (!seniorApproverId)
          throw new BadRequestException(
            'No senior manager found to escalate to',
          );
        nextAssigneeId = seniorApproverId;
        nextRole = RoleType.MANAGER;
      } else {
        toStatus = ProcurementStatus.PENDING_IT_REVIEW;
        nextRole = RoleType.IT;
      }
    } else if (decision === 'RETURN') {
      toStatus = ProcurementStatus.RETURNED_TO_REQUESTER;
      nextAssigneeId = request.requesterId;
      nextRole = RoleType.EMPLOYEE;
    } else if (decision === 'REJECT') {
      toStatus = ProcurementStatus.REJECTED;
    }

    const updateData: any = {
      status: toStatus,
      currentAssigneeId: nextAssigneeId,
      currentHandlerRole: nextRole,
    };

    if (
      decision === 'APPROVE' &&
      toStatus === ProcurementStatus.PENDING_SENIOR_MANAGER_APPROVAL
    ) {
      updateData.seniorApproverId = nextAssigneeId;
    }

    await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: updateData,
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.MANAGER,
      decision,
      fromStatus,
      toStatus,
      comment,
    );

    await this.notificationsService.notifyStateChange(
      request.id,
      fromStatus,
      toStatus,
      request.requesterId,
      nextAssigneeId,
      nextRole,
    );

    return { success: true, newStatus: toStatus };
  }

  async seniorApproval(
    user: any,
    requestId: string,
    decision: 'APPROVE' | 'RETURN' | 'REJECT',
    comment?: string,
  ) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_SENIOR_MANAGER_APPROVAL) {
      throw new BadRequestException('Not pending senior manager approval');
    }
    if (request.currentAssigneeId !== user.id) {
      throw new ForbiddenException('You are not the assigned senior approver');
    }

    const fromStatus = request.status;
    let toStatus: ProcurementStatus = fromStatus;
    let nextAssigneeId = null;
    let nextRole = null;

    if (!['APPROVE', 'RETURN', 'REJECT'].includes(decision)) {
      throw new BadRequestException('Invalid decision');
    }
    if (
      ['RETURN', 'REJECT'].includes(decision) &&
      (!comment || comment.trim() === '')
    ) {
      throw new BadRequestException('Comment is required for RETURN or REJECT');
    }

    if (decision === 'APPROVE') {
      toStatus = ProcurementStatus.PENDING_IT_REVIEW;
      nextRole = RoleType.IT;
    } else if (decision === 'RETURN') {
      toStatus = ProcurementStatus.RETURNED_TO_REQUESTER;
      nextAssigneeId = request.requesterId;
      nextRole = RoleType.EMPLOYEE;
    } else if (decision === 'REJECT') {
      toStatus = ProcurementStatus.REJECTED;
    }

    await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: nextAssigneeId,
        currentHandlerRole: nextRole,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.MANAGER,
      decision,
      fromStatus,
      toStatus,
      comment,
    );

    await this.notificationsService.notifyStateChange(
      request.id,
      fromStatus,
      toStatus,
      request.requesterId,
      nextAssigneeId,
      nextRole,
    );

    return { success: true, newStatus: toStatus };
  }

  async itReview(
    user: any,
    requestId: string,
    decision: 'APPROVE' | 'RETURN' | 'REJECT',
    comment?: string,
  ) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_IT_REVIEW) {
      throw new BadRequestException('Not pending IT review');
    }

    const fromStatus = request.status;
    let toStatus: ProcurementStatus = fromStatus;
    let nextAssigneeId = null;
    let nextRole = null;

    if (!['APPROVE', 'RETURN', 'REJECT'].includes(decision)) {
      throw new BadRequestException('Invalid decision');
    }
    if (
      ['RETURN', 'REJECT'].includes(decision) &&
      (!comment || comment.trim() === '')
    ) {
      throw new BadRequestException('Comment is required for RETURN or REJECT');
    }

    if (decision === 'APPROVE') {
      toStatus = ProcurementStatus.PENDING_PROCUREMENT;
      nextRole = RoleType.PROCUREMENT;
    } else if (decision === 'RETURN') {
      toStatus = ProcurementStatus.RETURNED_TO_REQUESTER;
      nextAssigneeId = request.requesterId;
      nextRole = RoleType.EMPLOYEE;
    } else if (decision === 'REJECT') {
      toStatus = ProcurementStatus.REJECTED;
    }

    await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: nextAssigneeId,
        currentHandlerRole: nextRole,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.IT,
      decision,
      fromStatus,
      toStatus,
      comment,
    );

    await this.notificationsService.notifyStateChange(
      request.id,
      fromStatus,
      toStatus,
      request.requesterId,
      nextAssigneeId,
      nextRole,
    );

    return { success: true, newStatus: toStatus };
  }
}
