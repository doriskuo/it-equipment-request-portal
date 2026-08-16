export interface EquipmentProduct {
  id: string;
  categoryId: string;
  name: string;
  specification: string;
  referencePrice: number;
  category: {
    name: string;
  };
}

export type ProcurementStatus = 
  | 'DRAFT'
  | 'PENDING_DEPARTMENT_MANAGER_APPROVAL'
  | 'PENDING_SENIOR_MANAGER_APPROVAL'
  | 'PENDING_IT_REVIEW'
  | 'PENDING_PROCUREMENT'
  | 'PROCUREMENT_IN_PROGRESS'
  | 'PENDING_ACCOUNTING_CONFIRMATION'
  | 'PENDING_DELIVERY'
  | 'PENDING_RECEIPT_CONFIRMATION'
  | 'RETURNED_TO_REQUESTER'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface RequestItem {
  id: string;
  lineNo: number;
  equipmentProductId: string | null;
  productName: string; // Used in payload
  itemNameSnapshot?: string; // Used in response
  specification: string | null;
  specSnapshot?: string | null;
  quantity: number;
  unitPrice: number;
  estimatedUnitPrice?: number;
  subtotal: number;
  lineSubtotal?: number;
  deliveryStatus?: 'PENDING' | 'DELIVERED' | 'OUT_OF_STOCK';
  deliveryNote?: string | null;
  receiptConfirmedAt?: string | null;
}

export interface WorkflowAction {
  id: string;
  action: string;
  comment: string | null;
  createdAt: string;
  actorRole: string;
  actor: {
    id?: string;
    name: string;
    roles?: { role: string }[];
  };
}

export interface ProcurementRequest {
  id: string;
  requestNo: string; // Used in some places incorrectly, maybe?
  requestNumber?: string; // The correct one from backend
  status: ProcurementStatus;
  purpose: string;
  purposeNote: string | null;
  desiredDeliveryDate: string | null;
  remark: string | null;
  estimatedTotalAmount: number;
  currentRevisionNo: number;
  createdAt: string;
  updatedAt: string;
  requesterId: string;
  currentAssigneeId: string | null;
  currentAssigneeRole: string | null;
  currentHandlerRole: string | null;
  
  requester: {
    name: string;
    department: {
      name: string;
    };
  };
  
  items: RequestItem[];
  actions: WorkflowAction[];
}
