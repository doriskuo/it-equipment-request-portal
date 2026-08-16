import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcurementStatus, RoleType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async prepareItems(itemsInput: any[]) {
    let totalAmount = 0;
    const items = [];

    for (const [index, item] of itemsInput.entries()) {
      let unitPrice = item.estimatedUnitPrice || 0;
      let categorySnapshot = 'Other';
      let itemNameSnapshot = item.itemName || 'Manual Entry';
      let specSnapshot = item.spec || null;

      if (item.equipmentProductId) {
        const product = await this.prisma.equipmentProduct.findUnique({
          where: { id: item.equipmentProductId },
          include: { category: true },
        });
        if (product) {
          unitPrice = Number(product.referencePrice);
          categorySnapshot = product.category.name;
          itemNameSnapshot = product.name;
          specSnapshot = product.specification;
        }
      }

      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      items.push({
        lineNo: index + 1,
        equipmentProductId: item.equipmentProductId || null,
        categorySnapshot,
        itemNameSnapshot,
        specSnapshot,
        quantity: item.quantity,
        estimatedUnitPrice: unitPrice,
        lineSubtotal: subtotal,
      });
    }

    return { items, totalAmount };
  }

  async createDraft(user: any, data: any) {
    const {
      purpose,
      purposeNote,
      desiredDeliveryDate,
      remark,
      items: itemsInput,
    } = data;

    const { items, totalAmount } = await this.prepareItems(itemsInput);

    if (!desiredDeliveryDate) {
      throw new BadRequestException(
        '期望交期為必填欄位 (Expected delivery date is required)',
      );
    }

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2); // allowing some timezone wiggle room
    if (new Date(desiredDeliveryDate) < minDate) {
      throw new BadRequestException(
        '期望交期至少需要設定在 3 天後 (Expected delivery date must be at least 3 days in the future)',
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.procurementRequest.count({
      where: { requestNumber: { startsWith: `PR-${dateStr}` } },
    });
    const requestNumber = `PR-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    return this.prisma.procurementRequest.create({
      data: {
        requestNumber,
        requesterId: user.id,
        departmentSnapshot: user.department.name,
        desiredDeliveryDate: new Date(desiredDeliveryDate),
        purpose,
        purposeNote,
        remark,
        estimatedTotalAmount: totalAmount,
        status: ProcurementStatus.DRAFT,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });
  }

  async submitRequest(user: any, requestId: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: { items: true, requester: { include: { manager: true } } },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== user.id)
      throw new ForbiddenException('Not your request');
    if (
      request.status !== ProcurementStatus.DRAFT &&
      request.status !== ProcurementStatus.RETURNED_TO_REQUESTER
    ) {
      throw new BadRequestException('Can only submit from DRAFT or RETURNED');
    }

    const approverId = request.requester.managerId;
    if (!approverId) throw new BadRequestException('No manager found for user');

    const nextRevisionNo =
      request.status === ProcurementStatus.RETURNED_TO_REQUESTER
        ? request.currentRevisionNo + 1
        : request.currentRevisionNo;

    await this.prisma.requestRevision.create({
      data: {
        requestId: request.id,
        revisionNo: nextRevisionNo,
        purpose: request.purpose,
        purposeNote: request.purposeNote,
        desiredDeliveryDate: request.desiredDeliveryDate,
        remark: request.remark,
        estimatedTotalAmount: request.estimatedTotalAmount,
        items: {
          create: request.items.map((i) => ({
            lineNo: i.lineNo,
            equipmentProductId: i.equipmentProductId,
            categorySnapshot: i.categorySnapshot,
            itemNameSnapshot: i.itemNameSnapshot,
            specSnapshot: i.specSnapshot,
            quantity: i.quantity,
            estimatedUnitPrice: i.estimatedUnitPrice,
            lineSubtotal: i.lineSubtotal,
          })),
        },
      },
    });

    const updated = await this.prisma.procurementRequest.update({
      where: { id: request.id },
      data: {
        status: ProcurementStatus.PENDING_DEPARTMENT_MANAGER_APPROVAL,
        currentRevisionNo: nextRevisionNo,
        departmentApproverId: approverId,
        currentAssigneeId: approverId,
        currentHandlerRole: RoleType.MANAGER,
      },
    });

    await this.notificationsService.notifyStateChange(
      request.id,
      request.status,
      updated.status,
      request.requesterId,
      approverId,
      RoleType.MANAGER,
    );

    return updated;
  }

  async findAll(user: any) {
    const roles = user.roles.map((r: any) => r.role);
    const orConditions: any[] = [];

    // 1. 每個人都可以看到自己發起的單據
    orConditions.push({ requesterId: user.id });

    // 1.5 任何人只要曾經處理過這張單，就可以持續觀看 (出現在歷史歸檔等)
    orConditions.push({ actions: { some: { actorId: user.id } } });

    // 2. 主管 (MANAGER) 可以看到直屬下屬發起的單據，或是正在等待高階主管審核的單據 (若是高階主管)
    if (roles.includes(RoleType.MANAGER)) {
      orConditions.push({ requester: { managerId: user.id } });
      // 簡單處理高階主管可視範圍：若狀態為等待高階審核，也讓所有 manager (MVP 簡化) 看到
      orConditions.push({
        status: ProcurementStatus.PENDING_SENIOR_MANAGER_APPROVAL,
      });
    }

    // 3. 資訊部 (IT) 可以看到已經進入 IT 評估，或是後續狀態的單據
    if (roles.includes(RoleType.IT)) {
      orConditions.push({
        status: {
          in: [
            ProcurementStatus.PENDING_IT_REVIEW,
            ProcurementStatus.PENDING_PROCUREMENT,
            ProcurementStatus.PROCUREMENT_IN_PROGRESS,
            ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION,
            ProcurementStatus.PENDING_DELIVERY,
            ProcurementStatus.PENDING_RECEIPT_CONFIRMATION,
            ProcurementStatus.COMPLETED,
          ],
        },
      });
    }

    // 4. 採購部 (PROCUREMENT) 可以看到已經進入採購階段及後續的單據
    if (roles.includes(RoleType.PROCUREMENT)) {
      orConditions.push({
        status: {
          in: [
            ProcurementStatus.PENDING_PROCUREMENT,
            ProcurementStatus.PROCUREMENT_IN_PROGRESS,
            ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION,
            ProcurementStatus.PENDING_DELIVERY,
            ProcurementStatus.PENDING_RECEIPT_CONFIRMATION,
            ProcurementStatus.COMPLETED,
          ],
        },
      });
    }

    // 5. 會計部 (ACCOUNTING) 可以看到已經進入會計核對階段及後續的單據
    if (roles.includes(RoleType.ACCOUNTING)) {
      orConditions.push({
        status: {
          in: [
            ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION,
            ProcurementStatus.PENDING_DELIVERY,
            ProcurementStatus.PENDING_RECEIPT_CONFIRMATION,
            ProcurementStatus.COMPLETED,
          ],
        },
      });
    }

    return this.prisma.procurementRequest.findMany({
      where: {
        OR: orConditions,
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: any) {
    const roles = user.roles.map((r: any) => r.role);
    const orConditions: any[] = [];

    // 1. 每個人都可以看到自己發起的單據
    orConditions.push({ requesterId: user.id });

    // 1.5 任何人只要曾經處理過這張單，就可以持續觀看 (避免退回後立刻 404)
    orConditions.push({ actions: { some: { actorId: user.id } } });

    // 2. 主管可以看直屬下屬的單據，或是正在等待高階主管審核的單據
    if (roles.includes(RoleType.MANAGER)) {
      orConditions.push({ requester: { managerId: user.id } });
      orConditions.push({
        status: ProcurementStatus.PENDING_SENIOR_MANAGER_APPROVAL,
      });
    }

    // 3. IT 可以看所有進入 IT 處理階段及之後的單據
    if (roles.includes(RoleType.IT)) {
      orConditions.push({
        status: {
          in: [
            ProcurementStatus.PENDING_IT_REVIEW,
            ProcurementStatus.PENDING_PROCUREMENT,
            ProcurementStatus.PROCUREMENT_IN_PROGRESS,
            ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION,
            ProcurementStatus.PENDING_DELIVERY,
            ProcurementStatus.PENDING_RECEIPT_CONFIRMATION,
            ProcurementStatus.COMPLETED,
          ],
        },
      });
    }

    // 4. 採購部可以看進入採購處理及之後的單據
    if (roles.includes(RoleType.PROCUREMENT)) {
      orConditions.push({
        status: {
          in: [
            ProcurementStatus.PENDING_PROCUREMENT,
            ProcurementStatus.PROCUREMENT_IN_PROGRESS,
            ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION,
            ProcurementStatus.PENDING_DELIVERY,
            ProcurementStatus.PENDING_RECEIPT_CONFIRMATION,
            ProcurementStatus.COMPLETED,
          ],
        },
      });
    }

    // 5. 會計部可以看已經進入會計核對階段及後續的單據
    if (roles.includes(RoleType.ACCOUNTING)) {
      orConditions.push({
        status: {
          in: [
            ProcurementStatus.PENDING_ACCOUNTING_CONFIRMATION,
            ProcurementStatus.PENDING_DELIVERY,
            ProcurementStatus.PENDING_RECEIPT_CONFIRMATION,
            ProcurementStatus.COMPLETED,
          ],
        },
      });
    }

    const request = await this.prisma.procurementRequest.findFirst({
      where: {
        id,
        OR: orConditions,
      },
      include: {
        items: true,
        requester: {
          include: { department: true },
        },
        actions: {
          include: {
            actor: {
              include: { roles: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async updateDraft(user: any, id: string, data: any) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== user.id)
      throw new ForbiddenException('Only requester can edit');
    if (
      request.status !== ProcurementStatus.DRAFT &&
      request.status !== ProcurementStatus.RETURNED_TO_REQUESTER
    ) {
      throw new BadRequestException('Cannot edit in this status');
    }

    const {
      purpose,
      purposeNote,
      desiredDeliveryDate,
      remark,
      items: itemsInput,
    } = data;
    const { items, totalAmount } = await this.prepareItems(itemsInput);

    if (!desiredDeliveryDate) {
      throw new BadRequestException(
        '期望交期為必填欄位 (Expected delivery date is required)',
      );
    }

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    if (new Date(desiredDeliveryDate) < minDate) {
      throw new BadRequestException(
        '期望交期至少需要設定在 3 天後 (Expected delivery date must be at least 3 days in the future)',
      );
    }

    await this.prisma.requestItem.deleteMany({ where: { requestId: id } });

    return this.prisma.procurementRequest.update({
      where: { id },
      data: {
        purpose,
        purposeNote,
        desiredDeliveryDate: new Date(desiredDeliveryDate),
        remark,
        estimatedTotalAmount: totalAmount,
        items: {
          create: items,
        },
      },
    });
  }
}
