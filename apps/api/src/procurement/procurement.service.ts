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
export class ProcurementService {
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
        fromStatus,
        toStatus,
        action,
        comment: comment || '',
      },
    });

    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
      select: {
        requesterId: true,
        currentAssigneeId: true,
        currentHandlerRole: true,
      },
    });
    if (request) {
      await this.notificationsService.notifyStateChange(
        requestId,
        fromStatus,
        toStatus,
        request.requesterId,
        request.currentAssigneeId,
        request.currentHandlerRole,
      );
    }
  }

  async simulateProcurement(requestId: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      supplierName: '戴爾原廠企業直銷',
      poNumber: 'PO-202608-888',
      actualTotalAmount: Math.round(
        Number(request.estimatedTotalAmount || 0) * 0.9,
      ),
    };
  }

  async simulateAccounting(requestId: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    return {
      invoiceNumber: 'XA-12345678',
      budgetCode: 'IT-HW-2026',
    };
  }

  async startProcurement(user: any, requestId: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_PROCUREMENT)
      throw new BadRequestException('Not pending procurement');

    const fromStatus = request.status;
    const toStatus = ProcurementStatus.PROCUREMENT_IN_PROGRESS;

    const result = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: user.id,
        currentHandlerRole: RoleType.PROCUREMENT,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.PROCUREMENT,
      'START_PROCUREMENT',
      fromStatus,
      toStatus,
      '',
    );
    return result;
  }

  async completeProcurement(user: any, requestId: string, data: any) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PROCUREMENT_IN_PROGRESS)
      throw new BadRequestException('Procurement not in progress');
    if (request.currentAssigneeId !== user.id)
      throw new ForbiddenException('Not your assigned procurement');

    // Delete old items if updating existing record
    const existingRecord = await this.prisma.procurementRecord.findUnique({
      where: { requestId: request.id },
    });
    if (existingRecord) {
      await this.prisma.procurementItem.deleteMany({
        where: { procurementRecordId: existingRecord.id },
      });
    }

    await this.prisma.procurementRecord.upsert({
      where: { requestId: request.id },
      create: {
        requestId: request.id,
        purchaserId: user.id,
        supplierName: data.supplierName,
        purchaseDate: new Date(),
        poNumber: data.poNumber,
        actualTotalAmount: data.actualTotalAmount,
        items: {
          create: data.items.map((i: any) => ({
            lineNo: i.lineNo,
            itemName: i.itemName,
            quantity: i.quantity,
            actualUnitPrice: i.actualUnitPrice,
            lineSubtotal: i.lineSubtotal,
          })),
        },
      },
      update: {
        purchaserId: user.id,
        supplierName: data.supplierName,
        purchaseDate: new Date(),
        poNumber: data.poNumber,
        actualTotalAmount: data.actualTotalAmount,
        items: {
          create: data.items.map((i: any) => ({
            lineNo: i.lineNo,
            itemName: i.itemName,
            quantity: i.quantity,
            actualUnitPrice: i.actualUnitPrice,
            lineSubtotal: i.lineSubtotal,
          })),
        },
      },
    });

    const fromStatus = request.status;
    const toStatus = ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION;

    const result = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: null,
        currentHandlerRole: RoleType.ACCOUNTING,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.PROCUREMENT,
      'COMPLETE_PROCUREMENT',
      fromStatus,
      toStatus,
      '',
    );
    return result;
  }

  async confirmAccounting(user: any, requestId: string, data: any) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION)
      throw new BadRequestException('Not pending accounting');

    await this.prisma.accountingConfirmation.create({
      data: {
        requestId: request.id,
        accountantId: user.id,
        invoiceNumber: data.invoiceNumber,
        budgetCode: data.budgetCode,
        note: data.note,
      },
    });

    const fromStatus = request.status;
    const toStatus = ProcurementStatus.PENDING_DELIVERY;

    // Assume we return it to the purchaser who did it, or just any PROCUREMENT
    // For MVP, just any procurement since it's a role queue
    const result = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: null,
        currentHandlerRole: RoleType.PROCUREMENT,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.ACCOUNTING,
      'CONFIRM_ACCOUNTING',
      fromStatus,
      toStatus,
      data.note,
    );
    return result;
  }

  async returnProcurement(user: any, requestId: string, comment: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (
      request.status !== ProcurementStatus.PENDING_PROCUREMENT &&
      request.status !== ProcurementStatus.PROCUREMENT_IN_PROGRESS
    ) {
      throw new BadRequestException('Not in procurement stage');
    }

    if (
      request.status === ProcurementStatus.PROCUREMENT_IN_PROGRESS &&
      request.currentAssigneeId !== user.id
    ) {
      throw new BadRequestException('You are not assigned to this request');
    }

    if (!comment || comment.trim() === '') {
      throw new BadRequestException('Comment is required for RETURN');
    }

    const fromStatus = request.status;
    const toStatus = ProcurementStatus.RETURNED_TO_REQUESTER;

    const result = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: request.requesterId,
        currentHandlerRole: RoleType.EMPLOYEE,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.PROCUREMENT,
      'RETURN',
      fromStatus,
      toStatus,
      comment,
    );
    return result;
  }

  async returnAccounting(user: any, requestId: string, comment: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: { procurementRecord: true },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION) {
      throw new BadRequestException('Not pending accounting confirmation');
    }

    if (!comment || comment.trim() === '') {
      throw new BadRequestException('Comment is required for RETURN');
    }

    const fromStatus = request.status;
    const toStatus = ProcurementStatus.PROCUREMENT_IN_PROGRESS;
    const purchaserId = request.procurementRecord?.purchaserId;

    const result = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: purchaserId || null,
        currentHandlerRole: RoleType.PROCUREMENT,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.ACCOUNTING,
      'RETURN',
      fromStatus,
      toStatus,
      comment,
    );
    return result;
  }

  async delivery(user: any, requestId: string, data: any) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_DELIVERY)
      throw new BadRequestException('Not pending delivery');

    // Update each item's delivery status
    const itemUpdates: {
      itemId: string;
      deliveryStatus: string;
      deliveryNote?: string;
    }[] = data.items || [];
    for (const update of itemUpdates) {
      await this.prisma.requestItem.update({
        where: { id: update.itemId },
        data: {
          deliveryStatus: update.deliveryStatus as any,
          deliveryNote: update.deliveryNote || null,
        },
      });
    }

    // Re-fetch items after update to check if all have a final status
    const updatedItems = await this.prisma.requestItem.findMany({
      where: { requestId: request.id },
    });

    const allResolved = updatedItems.every(
      (item) =>
        item.deliveryStatus === 'DELIVERED' ||
        item.deliveryStatus === 'OUT_OF_STOCK',
    );

    if (allResolved) {
      // All items have a final status → create delivery record and advance
      // Only create DeliveryRecord if it doesn't exist yet
      const existingRecord = await this.prisma.deliveryRecord.findUnique({
        where: { requestId: request.id },
      });
      if (!existingRecord) {
        await this.prisma.deliveryRecord.create({
          data: {
            requestId: request.id,
            deliveredById: user.id,
            receivedBy: data.receivedBy || '',
            remark: data.remark || '',
          },
        });
      }

      const fromStatus = request.status;
      const toStatus = ProcurementStatus.PENDING_RECEIPT_CONFIRMATION;

      const result = await this.prisma.procurementRequest.update({
        where: { id: request.id },
        data: {
          status: toStatus,
          currentAssigneeId: request.requesterId,
          currentHandlerRole: RoleType.EMPLOYEE,
        },
      });

      await this.recordAction(
        request.id,
        request.currentRevisionNo,
        user.id,
        RoleType.PROCUREMENT,
        'DELIVERY',
        fromStatus,
        toStatus,
        data.remark || '',
      );
      return result;
    } else {
      // Partial delivery → stay at PENDING_DELIVERY, record action for audit
      await this.recordAction(
        request.id,
        request.currentRevisionNo,
        user.id,
        RoleType.PROCUREMENT,
        'PARTIAL_DELIVERY',
        request.status,
        request.status,
        '部分品項到貨更新',
      );

      return await this.prisma.procurementRequest.findUnique({
        where: { id: request.id },
        include: { items: true },
      });
    }
  }

  async receiptConfirm(user: any, requestId: string, data: any) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_RECEIPT_CONFIRMATION)
      throw new BadRequestException('Not pending receipt');
    if (request.requesterId !== user.id)
      throw new ForbiddenException('Not your request');

    const fromStatus = request.status;
    const toStatus = ProcurementStatus.COMPLETED;

    // Optional: mark any remaining DELIVERED items as receiptConfirmedAt = now
    await this.prisma.requestItem.updateMany({
      where: {
        requestId: request.id,
        deliveryStatus: 'DELIVERED',
        receiptConfirmedAt: null,
      },
      data: {
        receiptConfirmedAt: new Date(),
      },
    });

    const result = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: toStatus,
        currentAssigneeId: null,
        currentHandlerRole: null,
      },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.EMPLOYEE,
      'RECEIPT_CONFIRM',
      fromStatus,
      toStatus,
      '',
    );
    return result;
  }

  async confirmItemReceipt(user: any, requestId: string, itemId: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ProcurementStatus.PENDING_DELIVERY)
      throw new BadRequestException(
        'Can only confirm partial items during PENDING_DELIVERY',
      );
    if (request.requesterId !== user.id)
      throw new ForbiddenException('Only requester can confirm item receipt');

    const item = await this.prisma.requestItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.requestId !== requestId)
      throw new NotFoundException('Item not found');
    if (item.deliveryStatus !== 'DELIVERED')
      throw new BadRequestException('Item is not delivered yet');
    if (item.receiptConfirmedAt)
      throw new BadRequestException('Item already confirmed');

    const updatedItem = await this.prisma.requestItem.update({
      where: { id: itemId },
      data: { receiptConfirmedAt: new Date() },
    });

    await this.recordAction(
      request.id,
      request.currentRevisionNo,
      user.id,
      RoleType.EMPLOYEE,
      'PARTIAL_RECEIPT',
      request.status,
      request.status,
      `確認收到單一品項: ${item.itemNameSnapshot}`,
    );

    return updatedItem;
  }
}
