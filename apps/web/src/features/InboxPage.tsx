import { type FC } from 'react';
import { useRequests } from '../hooks/useRequests';
import { useAuthStore } from '../store/authStore';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';

export const InboxPage: FC = () => {
  const { requests, loading, error } = useRequests();
  const currentUser = useAuthStore(state => state.currentUser);
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'my';

  if (!currentUser) {
    return <div className="p-8 text-center text-text-secondary">正在載入使用者資訊...</div>;
  }

  // Filter requests based on the selected tab/type
  const filteredRequests = requests.filter(req => {
    const isArchived = ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(req.status);

    if (type === 'archive') {
      return isArchived;
    }

    if (type === 'pending') {
      if (isArchived) return false;
      if (req.status === 'DRAFT' || req.status === 'RETURNED_TO_REQUESTER') return false;
      
      // 1. If explicitly assigned to me
      if (req.currentAssigneeId && req.currentAssigneeId === currentUser.id) {
        return true;
      }
      
      // 2. Fallback to robust status mapping if assignee is missing
      const roles = currentUser.roles.map(r => r.role);
      switch (req.status) {
        case 'PENDING_DEPARTMENT_MANAGER_APPROVAL':
        case 'PENDING_SENIOR_MANAGER_APPROVAL':
          return roles.includes('MANAGER');
        case 'PENDING_IT_REVIEW':
          return roles.includes('IT');
        case 'PENDING_PROCUREMENT':
        case 'PROCUREMENT_IN_PROGRESS':
        case 'PENDING_DELIVERY':
          return roles.includes('PROCUREMENT');
        case 'PENDING_ACCOUNTING_CONFIRMATION':
          return roles.includes('ACCOUNTING');
        case 'PENDING_RECEIPT_CONFIRMATION':
          return req.requesterId === currentUser.id;
      }
      
      // 3. Fallback to currentHandlerRole
      if (req.currentHandlerRole) {
        return roles.includes(req.currentHandlerRole);
      }
      
      return false;
    }

    // Default: 'my' (我的申請單)
    return req.requesterId === currentUser.id && !isArchived;
  });

  const getTitle = () => {
    if (type === 'pending') return '待辦審核區';
    if (type === 'archive') return '歷史歸檔';
    return '我的申請單';
  };

  const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-success/10 text-success';
    if (status === 'REJECTED' || status === 'CANCELLED') return 'bg-danger/10 text-danger';
    if (status === 'RETURNED_TO_REQUESTER') return 'bg-warning/10 text-warning';
    return 'bg-primary/10 text-primary';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'DRAFT': '草稿',
      'PENDING_DEPARTMENT_MANAGER_APPROVAL': '待部門主管審核',
      'PENDING_SENIOR_MANAGER_APPROVAL': '待高階主管審核',
      'PENDING_IT_REVIEW': '待 IT 處理',
      'PENDING_PROCUREMENT': '待採購處理',
      'PROCUREMENT_IN_PROGRESS': '採購處理中',
      'PENDING_ACCOUNTING_CONFIRMATION': '待會計確認',
      'PENDING_DELIVERY': '待設備到貨',
      'PENDING_RECEIPT_CONFIRMATION': '待收貨驗收',
      'RETURNED_TO_REQUESTER': '需補件/修改',
      'COMPLETED': '已完成',
      'REJECTED': '已退回',
      'CANCELLED': '已取消'
    };
    return statusMap[status] || status.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">{getTitle()}</h1>
      </div>

      <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">載入申請單中...</div>
        ) : error ? (
          <div className="p-8 text-center text-danger">{error}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-16 text-center text-text-secondary">
            收件匣內沒有任何申請單。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-background text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium text-text-primary">請購單號</th>
                  <th className="px-6 py-4 font-medium text-text-primary">內容摘要</th>
                  <th className="px-6 py-4 font-medium text-text-primary text-right">預估總額</th>
                  <th className="px-6 py-4 font-medium text-text-primary text-center">狀態</th>
                  <th className="px-6 py-4 font-medium text-text-primary">目前處理人</th>
                  <th className="px-6 py-4 font-medium text-text-primary">申請日期</th>
                  <th className="px-6 py-4 font-medium text-text-primary text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.map(req => {
                  const itemsSummary = req.items && req.items.length > 0 
                    ? `${req.items[0].itemNameSnapshot} ${req.items.length > 1 ? `等 ${req.items.length} 項` : ''}`
                    : '無項目';
                  
                  return (
                    <tr key={req.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary whitespace-nowrap">{req.requestNumber}</td>
                      <td className="px-6 py-4">{itemsSummary}</td>
                      <td className="px-6 py-4 text-right">NT$ {req.estimatedTotalAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap", getStatusColor(req.status))}>
                          {getStatusLabel(req.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {req.currentAssigneeRole ? (
                          <span>{req.currentAssigneeRole}</span>
                        ) : (
                          <span className="text-neutral">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link 
                          to={`/requests/${req.id}`}
                          state={{ from: type }}
                          className="text-primary hover:text-primary-hover font-medium"
                        >
                          檢視
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
