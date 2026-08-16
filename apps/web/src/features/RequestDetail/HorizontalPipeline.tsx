import { type FC } from 'react';

import { Link } from 'react-router-dom';
import { Check, X, AlertCircle, Minus, Edit, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

import { type ProcurementRequest } from '../../types';

interface PipelineProps {
  request: ProcurementRequest;
  canEdit?: boolean;
}

const STAGES = [
  { id: 'SUBMIT', label: '送出申請', done: ['PENDING_DEPARTMENT_MANAGER_APPROVAL', 'PENDING_SENIOR_MANAGER_APPROVAL', 'PENDING_IT_REVIEW', 'PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS', 'PENDING_ACCOUNTING_CONFIRMATION', 'PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'MANAGER', label: '部門主管', pending: 'PENDING_DEPARTMENT_MANAGER_APPROVAL', done: ['PENDING_SENIOR_MANAGER_APPROVAL', 'PENDING_IT_REVIEW', 'PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS', 'PENDING_ACCOUNTING_CONFIRMATION', 'PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'HIGHER', label: '高階主管', pending: 'PENDING_SENIOR_MANAGER_APPROVAL', done: ['PENDING_IT_REVIEW', 'PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS', 'PENDING_ACCOUNTING_CONFIRMATION', 'PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'IT', label: 'IT處理', pending: 'PENDING_IT_REVIEW', done: ['PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS', 'PENDING_ACCOUNTING_CONFIRMATION', 'PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'PROCURE', label: '採購作業', pending: ['PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS'], done: ['PENDING_ACCOUNTING_CONFIRMATION', 'PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'ACCOUNT', label: '會計確認', pending: 'PENDING_ACCOUNTING_CONFIRMATION', done: ['PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'DELIVERY', label: '設備到貨', pending: 'PENDING_DELIVERY', done: ['PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'] },
  { id: 'RECEIPT', label: '簽收完成', pending: 'PENDING_RECEIPT_CONFIRMATION', done: ['COMPLETED'] },
];

export const HorizontalPipeline: FC<PipelineProps> = ({ request, canEdit }) => {
  const status = request.status;
  if (status === 'DRAFT') return null;

  // Find the last RETURN or REJECT action
  const errorAction = request.actions?.slice().reverse().find(a => a.action === 'RETURN' || a.action === 'REJECT');
  const errorRole = errorAction?.actorRole;
  const errorComment = errorAction?.comment;

  const getErrorStageId = () => {
    if (!errorRole) return null;
    if (errorRole === 'MANAGER') return 'MANAGER';
    if (errorRole === 'SENIOR_MANAGER') return 'HIGHER';
    if (errorRole === 'IT') return 'IT';
    if (errorRole === 'PROCUREMENT') return 'PROCURE';
    if (errorRole === 'ACCOUNTING') return 'ACCOUNT';
    return null;
  };

  const errorStageId = getErrorStageId();

  return (
    <div className="w-full py-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between relative px-4 gap-4 md:gap-0">
        {/* Background Line for Desktop (Horizontal) */}
        <div className="hidden md:block absolute top-1/2 left-8 right-8 h-0.5 bg-neutral/20 -z-10 -translate-y-1/2" />
        {/* Background Line for Mobile (Vertical) */}
        <div className="block md:hidden absolute top-4 bottom-4 left-[2.1rem] w-0.5 bg-neutral/20 -z-10" />
        
        {STAGES.map((stage) => {
          const isRejected = status === 'REJECTED' || status === 'CANCELLED';
          const isReturned = status === 'RETURNED_TO_REQUESTER';
          const isErrorState = isRejected || isReturned;

          let state: 'done' | 'pending' | 'future' | 'returned' | 'rejected' = 'future';
          
          if (isErrorState) {
            const errorStageIndex = STAGES.findIndex(s => s.id === errorStageId);
            const currentStageIndex = STAGES.findIndex(s => s.id === stage.id);
            
            if (errorStageIndex !== -1) {
              if (currentStageIndex < errorStageIndex) state = 'done';
              else if (currentStageIndex === errorStageIndex) {
                state = isReturned ? 'returned' : 'rejected';
              }
              else state = 'future';
            }
          } else {
            // Normal flow
            const isDone = stage.done.includes(status);
            const isPending = Array.isArray(stage.pending) 
              ? stage.pending.includes(status) 
              : stage.pending === status;
            
            // Check for partial delivery
            const isPartialDelivery = stage.id === 'DELIVERY' && status === 'PENDING_DELIVERY' && 
              request.items?.some(i => i.deliveryStatus === 'DELIVERED') && 
              request.items?.some(i => i.deliveryStatus === 'PENDING');

            if (isDone) state = 'done';
            else if (isPartialDelivery) state = 'partial' as any;
            else if (isPending) state = 'pending';
          }

          return (
            <div key={stage.id} className="flex flex-row md:flex-col items-center gap-4 md:gap-2 relative bg-surface md:px-2 z-10 w-full md:w-auto">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors flex-shrink-0",
                state === 'done' && "bg-success border-success text-white",
                state === 'pending' && "bg-primary border-primary text-white shadow-[0_0_0_4px_rgba(37,99,235,0.2)]",
                state === 'future' && "bg-surface border-neutral/30 text-neutral",
                state === 'returned' && "bg-warning border-warning text-white",
                state === 'rejected' && "bg-danger border-danger text-white",
                state === ('partial' as any) && "bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-[0_0_0_4px_rgba(139,92,246,0.2)]"
              )}>
                {state === 'done' && <Check className="w-4 h-4" />}
                {state === 'pending' && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                {state === 'future' && <span className="w-1.5 h-1.5 rounded-full bg-neutral/30" />}
                {state === 'returned' && <Minus className="w-4 h-4" />}
                {state === 'rejected' && <X className="w-4 h-4" />}
                {state === ('partial' as any) && <AlertTriangle className="w-4 h-4" />}
              </div>
              <span className={clsx(
                "text-[13px] md:text-xs font-medium md:whitespace-nowrap flex-grow md:flex-grow-0 md:text-center",
                state === 'done' ? "text-success" :
                state === 'pending' ? "text-primary font-bold" :
                state === 'returned' ? "text-warning" :
                state === 'rejected' ? "text-danger" :
                state === ('partial' as any) ? "text-[#8B5CF6] font-bold" : "text-neutral"
              )}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      {(status === 'RETURNED_TO_REQUESTER' || status === 'REJECTED') && (
        <div className={clsx(
          "mt-4 flex flex-col gap-1 px-4 py-3 rounded-md text-sm border",
          status === 'RETURNED_TO_REQUESTER' ? "bg-warning/10 border-warning/20 text-warning-dark" : "bg-danger/10 border-danger/20 text-danger"
        )}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>此請購單已被 {status === 'REJECTED' ? '駁回' : '退回給申請人修改'}。</span>
            </div>
            {canEdit && (
              <Link
                to={`/requests/${request.id}/edit`}
                className="flex items-center space-x-2 bg-white border border-border hover:bg-neutral/5 px-3 py-1.5 rounded-md font-medium transition-colors text-text-primary text-xs shrink-0 shadow-sm"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>編輯請購單</span>
              </Link>
            )}
          </div>
          {errorComment && (
            <div className="pl-6 mt-1 whitespace-pre-wrap font-medium">
              原因：{errorComment}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
