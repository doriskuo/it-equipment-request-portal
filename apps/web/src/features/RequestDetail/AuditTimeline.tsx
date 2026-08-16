import { type FC } from 'react';
import { type WorkflowAction } from '../../types';
import { MessageSquare, Clock } from 'lucide-react';
import clsx from 'clsx';

interface AuditTimelineProps {
  actions: WorkflowAction[];
}

export const AuditTimeline: FC<AuditTimelineProps> = ({ actions }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="bg-surface rounded-lg border border-border shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold text-text-primary flex items-center">
        <Clock className="w-5 h-5 mr-2 text-primary" />
        審核歷程紀錄
      </h3>
      
      <div className="relative pl-4 space-y-6">
        <div className="absolute left-[23px] top-4 bottom-4 w-px bg-border" />
        
        {actions.map((action, i) => {
          const isApprove = action.action === 'APPROVE' || action.action === 'SUBMIT';
          const isReject = action.action === 'REJECT';
          const isReturn = action.action === 'RETURN';

          return (
            <div key={action.id || i} className="relative z-10 flex gap-4">
              <div className={clsx(
                "w-3 h-3 rounded-full mt-1.5 shrink-0 border-2",
                isApprove ? "bg-success border-surface" :
                isReject ? "bg-danger border-surface" :
                isReturn ? "bg-warning border-surface" : "bg-neutral border-surface"
              )} />
              
              <div className="flex-1 bg-background rounded-md p-4 border border-border text-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-text-primary mr-2">{action.actor?.name || '系統'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral/10 text-neutral">
                      {({
                        'EMPLOYEE': '一般員工',
                        'MANAGER': '主管',
                        'IT': 'IT人員',
                        'PROCUREMENT': '採購人員',
                        'ACCOUNTING': '會計人員'
                      } as Record<string, string>)[action.actor?.roles?.[0]?.role || ''] || action.actor?.roles?.[0]?.role || '無'}
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary whitespace-nowrap">
                    {new Date(action.createdAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center text-xs font-medium uppercase tracking-wider">
                  <span className={clsx(
                    isApprove ? "text-success" : isReject ? "text-danger" : isReturn ? "text-warning" : "text-neutral"
                  )}>
                    {({
                      'APPROVE': '核准',
                      'SUBMIT': '送出申請',
                      'REJECT': '駁回',
                      'RETURN': '退回',
                      'START_PROCUREMENT': '開始採購',
                      'COMPLETE_PROCUREMENT': '完成採購',
                      'CONFIRM_ACCOUNTING': '會計確認',
                      'DELIVER': '設備到貨',
                    } as Record<string, string>)[action.action] || action.action.replace(/_/g, ' ')}
                  </span>
                </div>

                {action.comment && (
                  <div className="flex items-start gap-2 pt-2 mt-2 border-t border-border/50 text-text-secondary italic bg-surface/50 p-2 rounded">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p>{action.comment}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
