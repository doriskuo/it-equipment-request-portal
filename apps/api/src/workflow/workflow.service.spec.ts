import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';
import { ProcurementStatus } from '@prisma/client';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prisma: PrismaService;

  // 模擬 (Mock) 外部依賴，確保不連動到真實資料庫
  const mockPrismaService = {
    procurementRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workflowAction: {
      create: jest.fn(),
    },
  };

  const mockNotificationsService = {
    notifyStateChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('managerApproval 防呆機制測試', () => {
    it('若進行退回 (RETURN) 卻未填寫原因 (comment)，應該拋出 BadRequestException', async () => {
      // 模擬資料庫回傳一張正在等待主管審核的單據
      mockPrismaService.procurementRequest.findUnique.mockResolvedValue({
        id: 'REQ-123',
        status: ProcurementStatus.PENDING_DEPARTMENT_MANAGER_APPROVAL,
        currentAssigneeId: 'manager-1',
        requesterId: 'emp-1',
      });

      const user = { id: 'manager-1' };
      const decision = 'RETURN';
      const emptyComment = ''; // 刻意不填原因

      // 預期執行這個動作時，會被我們寫的防呆邏輯擋下來
      await expect(
        service.managerApproval(user, 'REQ-123', decision, emptyComment)
      ).rejects.toThrow(BadRequestException);
      
      await expect(
        service.managerApproval(user, 'REQ-123', decision, emptyComment)
      ).rejects.toThrow('Comment is required for RETURN or REJECT');
    });

    it('若使用非法的 decision (例如亂打字)，應該拋出 BadRequestException', async () => {
      mockPrismaService.procurementRequest.findUnique.mockResolvedValue({
        id: 'REQ-123',
        status: ProcurementStatus.PENDING_DEPARTMENT_MANAGER_APPROVAL,
        currentAssigneeId: 'manager-1',
      });

      const user = { id: 'manager-1' };
      const invalidDecision = 'HACK' as any;

      await expect(
        service.managerApproval(user, 'REQ-123', invalidDecision, '測試')
      ).rejects.toThrow(BadRequestException);
    });
  });
});
