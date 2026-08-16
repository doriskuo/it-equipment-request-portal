import { type FC, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useRequestDetail } from '../../hooks/useRequests';
import { HorizontalPipeline } from './HorizontalPipeline';
import { ActionPanel } from './ActionPanel';
import { AuditTimeline } from './AuditTimeline';
import { ArrowLeft, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const RequestDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { request, loading, error, refetch } = useRequestDetail(id);
  const currentUser = useAuthStore(state => state.currentUser);
  
  const [itemIndex, setItemIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'budget' | 'delivery'>('info');

  const location = useLocation();
  const backUrl = location.state?.from ? `/?type=${location.state.from}` : '/';

  if (loading) return <div className="p-8 text-center text-text-secondary">正在載入詳細資訊...</div>;
  if (error || !request) return <div className="p-8 text-center text-danger">{error || '找不到請購單'}</div>;

  const canEdit = currentUser?.id === request.requesterId && (request.status === 'DRAFT' || request.status === 'RETURNED_TO_REQUESTER');
  
  const currentItem = request.items[itemIndex];

  const handlePrevItem = () => {
    setItemIndex(prev => (prev > 0 ? prev - 1 : request.items.length - 1));
  };

  const handleNextItem = () => {
    setItemIndex(prev => (prev < request.items.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <Link to={backUrl} className="text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-3">
            {request.requestNumber}
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
              {({
                'DRAFT': '草稿',
                'PENDING_DEPARTMENT_MANAGER_APPROVAL': '待部門主管審核',
                'PENDING_SENIOR_MANAGER_APPROVAL': '待高階主管審核',
                'PENDING_IT_REVIEW': '待 IT 處理',
                'PENDING_PROCUREMENT': '待採購處理',
                'PROCUREMENT_IN_PROGRESS': '採購處理中',
                'PENDING_ACCOUNTING_CONFIRMATION': '待會計確認',
                'PENDING_DELIVERY': '待設備到貨',
                'PENDING_RECEIPT_CONFIRMATION': '待收貨驗收',
                'COMPLETED': '已完成',
                'REJECTED': '已退回',
                'CANCELLED': '已取消',
                'RETURNED_TO_REQUESTER': '需補件/修改'
              } as Record<string, string>)[request.status as string] || request.status.replace(/_/g, ' ')}
            </span>
          </h1>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-surface border border-primary/10 rounded-lg shadow-sm w-full py-4 shrink-0 overflow-x-auto">
        <HorizontalPipeline request={request} canEdit={canEdit} />
      </div>

      {/* Action Panel */}
      <ActionPanel request={request} onSuccess={refetch} />

      {/* 3-Column Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto pb-4 pr-1 scrollbar-hide">
        
        {/* Column 1: Applicant Info / Budget Tab */}
        <div className="bg-surface rounded-lg border border-border shadow-sm flex flex-col h-full overflow-hidden">
          {(() => {
            const isSeniorManager = currentUser?.department?.code === 'EXEC';
            const isManager = currentUser?.roles.some(r => r.role === 'MANAGER');
            const showBudgetTab = isManager && ['PENDING_DEPARTMENT_MANAGER_APPROVAL', 'PENDING_SENIOR_MANAGER_APPROVAL'].includes(request.status);
            const showDeliveryTab = ['PENDING_DELIVERY', 'PENDING_RECEIPT_CONFIRMATION', 'COMPLETED'].includes(request.status);
            const budgetTabName = isSeniorManager ? '預算總表' : '部門預算';
            
            return (
              <>
                <div className="flex border-b border-border bg-neutral/5 shrink-0">
                  <button 
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 py-2.5 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary bg-surface' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                  >
                    申請資訊
                  </button>
                  {showDeliveryTab && (
                    <button 
                      onClick={() => setActiveTab('delivery')}
                      className={`flex-1 py-2.5 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'delivery' ? 'border-primary text-primary bg-surface' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                    >
                      到貨追蹤
                    </button>
                  )}
                  {showBudgetTab && (
                    <button 
                      onClick={() => setActiveTab('budget')}
                      className={`flex-1 py-2.5 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'budget' ? 'border-primary text-primary bg-surface' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                    >
                      {budgetTabName}
                    </button>
                  )}
                </div>

                <div className="p-5 overflow-y-auto flex-1 scrollbar-hide space-y-4">
                  {activeTab === 'delivery' ? (
                    <div className="space-y-3 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <span className="text-sm font-bold text-text-primary flex items-center gap-2">
                          <Package className="w-4 h-4" /> 設備到貨進度
                        </span>
                        <span className="text-[10px] bg-neutral/10 px-2 py-0.5 rounded text-text-secondary">
                          {request.items.filter((i: any) => i.receiptConfirmedAt).length}/{request.items.length} 已簽收
                        </span>
                      </div>
                      <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                        {request.items.map((item: any, idx: number) => {
                          let statusColor = 'bg-neutral/5 border-border';
                          let statusText = '⏳ 採購處理中';
                          
                          if (item.deliveryStatus === 'OUT_OF_STOCK') {
                            statusColor = 'bg-danger/5 border-danger/20 text-text-secondary line-through';
                            statusText = '🚫 缺貨取消';
                          } else if (item.receiptConfirmedAt) {
                            statusColor = 'bg-success/10 border-success/30';
                            statusText = '✅ 已簽收';
                          } else if (item.deliveryStatus === 'DELIVERED') {
                            statusColor = 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30';
                            statusText = '📦 已到貨，待簽收';
                          } else if (request.status !== 'PROCUREMENT_IN_PROGRESS') {
                            statusText = '⏳ 等待到貨中';
                          }

                          return (
                            <div key={item.id || idx} className={`p-3 rounded-md border text-sm ${statusColor} flex flex-col gap-1`}>
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-medium flex-1">{item.itemNameSnapshot} x{item.quantity}</span>
                                <span className={`text-xs font-bold whitespace-nowrap ${
                                  item.receiptConfirmedAt ? 'text-success' : 
                                  item.deliveryStatus === 'DELIVERED' ? 'text-[#8B5CF6]' : 
                                  item.deliveryStatus === 'OUT_OF_STOCK' ? 'text-danger' : 'text-text-secondary'
                                }`}>
                                  {statusText}
                                </span>
                              </div>
                              {item.deliveryNote && (
                                <span className="text-xs text-danger mt-1">備註: {item.deliveryNote}</span>
                              )}
                              {item.receiptConfirmedAt && (
                                <span className="text-[10px] text-text-secondary mt-1">
                                  簽收時間: {new Date(item.receiptConfirmedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeTab === 'info' ? (
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="text-text-secondary mb-0.5">申請人</p>
                        <p className="font-medium">{request.requester?.name} ({
                          {
                            'Information Technology': '資訊部',
                            'Executive': '高階管理處',
                            'Finance': '財務部',
                            'Procurement': '採購部'
                          }[request.requester?.department?.name || ''] || request.requester?.department?.name
                        })</p>
                      </div>
                      <div>
                        <p className="text-text-secondary mb-0.5">用途／申請原因</p>
                        <p className="font-medium">
                          {{
                            'NEW_EMPLOYEE': '新進員工設備',
                            'EQUIPMENT_REPLACEMENT': '設備老舊替換',
                            'EQUIPMENT_FAILURE': '設備損壞',
                            'JOB_REQUIREMENT': '職務需求變更',
                            'PROJECT_REQUIREMENT': '專案需求',
                            'EXPANSION': '擴編/新需求',
                            'OTHER': '其他'
                          }[request.purpose] || request.purpose}
                          {request.purpose === 'OTHER' && request.purposeNote ? ` - ${request.purposeNote}` : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-text-secondary mb-0.5">申請時間</p>
                          <p className="font-medium">{new Date(request.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary mb-0.5">期望交期</p>
                          <p className="font-medium">{request.desiredDeliveryDate ? new Date(request.desiredDeliveryDate).toLocaleDateString() : '無'}</p>
                        </div>
                      </div>
                      {request.remark && (
                        <div>
                          <p className="text-text-secondary mb-0.5">備註說明</p>
                          <p className="font-medium whitespace-pre-wrap">{request.remark}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm flex flex-col h-full">
                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-primary flex items-center">
                            <span className="mr-2">📊</span> {budgetTabName} (年度額度)
                          </h3>
                          <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded border border-warning/20">概念展示</span>
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-primary/10">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary">可用餘額：</span>
                            <span className="font-bold text-text-primary">NT$ {isSeniorManager ? '1,250,000' : '350,000'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary">本單預估總額：</span>
                            <span className="font-bold text-danger">- NT$ {request.estimatedTotalAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-dashed border-border">
                            <span className="text-text-secondary">審核後結餘：</span>
                            <span className="font-bold text-primary">
                              NT$ {(
                                (isSeniorManager ? 1250000 : 350000) - Number(request.estimatedTotalAmount)
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto pt-4">
                        <p className="text-[11px] text-text-secondary/70 italic leading-relaxed bg-neutral/5 p-3 rounded border border-border">
                          * 註解：牽涉財務預算相關模組不在此次 MVP 實作範圍內。此面板為未來 ERP 預算模組整合之概念展示，作為主管簽核時能立即參考預算消耗狀況的功能藍圖。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Column 2: Items Carousel & Total */}
        <div className="bg-surface rounded-lg border border-border shadow-sm p-5 space-y-4 flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-md font-bold text-text-primary">
              請購項目 <span className="text-text-secondary font-normal text-xs ml-1">({itemIndex + 1}/{request.items.length})</span>
            </h2>
            {request.items.length > 1 && (
              <div className="flex items-center space-x-1">
                <button onClick={handlePrevItem} className="p-0.5 hover:bg-background rounded text-text-secondary hover:text-text-primary border border-transparent hover:border-border">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={handleNextItem} className="p-0.5 hover:bg-background rounded text-text-secondary hover:text-text-primary border border-transparent hover:border-border">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Carousel Card */}
          {currentItem && (
            <div className="bg-background rounded-lg border border-border p-4 shadow-sm flex-grow flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-bold text-text-primary leading-tight">{currentItem.itemNameSnapshot}</h3>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">{currentItem.specSnapshot || '無規格說明'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-sm">
                  <div>
                    <p className="text-text-secondary mb-0.5 text-xs">數量</p>
                    <p className="font-medium">{currentItem.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-text-secondary mb-0.5 text-xs">單價</p>
                    <p className="font-medium">NT$ {currentItem.estimatedUnitPrice?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-end">
                   <span className="text-text-secondary text-xs font-medium">項目小計</span>
                   <span className="text-base font-bold text-text-primary">NT$ {currentItem.lineSubtotal?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Total Section */}
          <div className="bg-primary/5 rounded-lg border border-primary/20 p-3 flex justify-between items-center mt-auto">
            <span className="font-medium text-sm text-primary/80">總額</span>
            <span className="text-xl font-black text-primary tracking-tight">NT$ {request.estimatedTotalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Column 3: Audit Timeline */}
        <div className="bg-surface rounded-lg border border-border shadow-sm p-5 space-y-4 h-full overflow-hidden flex flex-col">
          <h2 className="text-md font-bold text-text-primary border-b border-border pb-2 shrink-0">處理紀錄</h2>
          <div className="overflow-y-auto pr-2 flex-grow scrollbar-thin">
            {request.actions && request.actions.length > 0 ? (
              <AuditTimeline actions={request.actions} />
            ) : (
              <p className="text-sm text-text-secondary italic">目前無處理紀錄</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
