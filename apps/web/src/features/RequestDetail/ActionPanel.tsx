import { useState, type FC } from 'react';
import { type ProcurementRequest } from '../../types';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { CheckCircle, XCircle, CornerUpLeft, AlertCircle } from 'lucide-react';

interface ActionPanelProps {
  request: ProcurementRequest;
  onSuccess: () => void;
}

export const ActionPanel: FC<ActionPanelProps> = ({ request, onSuccess }) => {
  const currentUser = useAuthStore(state => state.currentUser);
  const [comment, setComment] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const STORAGE_KEY_PROC = `mock_proc_${request.id}`;
  const STORAGE_KEY_ACC = `mock_acc_${request.id}`;

  const [procurement, setProcurement] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY_PROC);
    return saved ? JSON.parse(saved) : { supplierName: '', poNumber: '', actualTotalAmount: request.estimatedTotalAmount };
  });
  const [accounting, setAccounting] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY_ACC);
    return saved ? JSON.parse(saved) : { invoiceNumber: '', budgetCode: '', note: '' };
  });
  const [delivery, setDelivery] = useState({ receivedBy: request.requester?.name || '', remark: '' });
  const [itemDeliveryStates, setItemDeliveryStates] = useState<Record<string, { status: string; note: string }>>(() => {
    const initial: Record<string, { status: string; note: string }> = {};
    request.items.forEach(item => {
      initial[item.id] = { status: item.deliveryStatus || 'PENDING', note: item.deliveryNote || '' };
    });
    return initial;
  });
  
  const [isSimulatedProcurement, setIsSimulatedProcurement] = useState(() => !!sessionStorage.getItem(STORAGE_KEY_PROC));
  const [isSimulatedAccounting, setIsSimulatedAccounting] = useState(() => !!sessionStorage.getItem(STORAGE_KEY_ACC));
  const [isSimulatingProc, setIsSimulatingProc] = useState(false);
  const [isSimulatingAcc, setIsSimulatingAcc] = useState(false);

  if (!currentUser) return null;
  if (request.status === 'RETURNED_TO_REQUESTER' || request.status === 'DRAFT') return null;

  // 1. Determine if current user is the handler (robust fallback similar to Inbox)
  let isHandler = false;
  const roles = currentUser.roles.map(r => r.role);

  if (request.currentAssigneeId) {
    isHandler = request.currentAssigneeId === currentUser.id;
  } else if (request.status === 'PENDING_DEPARTMENT_MANAGER_APPROVAL' || request.status === 'PENDING_SENIOR_MANAGER_APPROVAL') {
    isHandler = roles.includes('MANAGER');
  } else if (request.status === 'PENDING_IT_REVIEW') {
    isHandler = roles.includes('IT');
  } else if (request.status === 'PENDING_PROCUREMENT' || request.status === 'PROCUREMENT_IN_PROGRESS' || request.status === 'PENDING_DELIVERY') {
    isHandler = roles.includes('PROCUREMENT');
  } else if (request.status === 'PENDING_ACCOUNTING_CONFIRMATION') {
    isHandler = roles.includes('ACCOUNTING');
  } else if (request.status === 'PENDING_RECEIPT_CONFIRMATION') {
    isHandler = request.requesterId === currentUser.id;
  } else if (request.currentHandlerRole) {
    isHandler = roles.includes(request.currentHandlerRole);
  }

  // Is this the requester viewing during PENDING_DELIVERY?
  const isRequesterDuringDelivery = request.status === 'PENDING_DELIVERY' && currentUser.id === request.requesterId;
  const hasDeliveriesToConfirm = isRequesterDuringDelivery && request.items.some(i => i.deliveryStatus === 'DELIVERED' && !i.receiptConfirmedAt);

  // Only show panel if current user is the handler or the requester with deliveries to confirm
  if (!isHandler && !hasDeliveriesToConfirm) return null;

  const handleConfirmPartialItem = async (itemId: string) => {
    setLoading(true);
    try {
      await api.post(`/requests/${request.id}/items/${itemId}/confirm-receipt`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || '確認領取失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'RETURN') => {
    setLoading(true);
    setError(null);
    try {
      const finalComment = selectedReason && selectedReason !== 'other' 
        ? (comment ? `${selectedReason} - ${comment}` : selectedReason)
        : comment;
        
      if ((action === 'REJECT' || action === 'RETURN') && (!finalComment || finalComment.trim() === '')) {
        setError('請選擇或填寫原因 (Reason is required for Reject/Return)');
        setLoading(false);
        return;
      }
        
      const payload: any = { decision: action, comment: finalComment };
      
      let endpoint = '';
      if (request.status === 'PENDING_DEPARTMENT_MANAGER_APPROVAL') {
        endpoint = `/requests/${request.id}/manager-approval`;
      } else if (request.status === 'PENDING_SENIOR_MANAGER_APPROVAL') {
        endpoint = `/requests/${request.id}/senior-approval`;
      } else if (request.status === 'PENDING_IT_REVIEW') {
        endpoint = `/requests/${request.id}/it-review`;
      } else if (request.status === 'PENDING_PROCUREMENT') {
        if (action === 'APPROVE') {
          endpoint = `/requests/${request.id}/procurement/start`;
        } else if (action === 'RETURN') {
          endpoint = `/requests/${request.id}/procurement/return`;
        }
      } else if (request.status === 'PROCUREMENT_IN_PROGRESS') {
        if (action === 'APPROVE') {
          endpoint = `/requests/${request.id}/procurement/complete`;
          payload.supplierName = procurement.supplierName;
          payload.poNumber = procurement.poNumber;
          payload.actualTotalAmount = procurement.actualTotalAmount;
          payload.items = request.items.map((item: any) => ({
            lineNo: item.lineNo,
            itemName: item.itemNameSnapshot,
            quantity: item.quantity,
            actualUnitPrice: item.estimatedUnitPrice, // MVP simplified
            lineSubtotal: Number(item.quantity) * Number(item.estimatedUnitPrice)
          }));
        } else if (action === 'RETURN') {
          endpoint = `/requests/${request.id}/procurement/return`;
        }
      } else if (request.status === 'PENDING_ACCOUNTING_CONFIRMATION') {
        if (action === 'APPROVE') {
          endpoint = `/requests/${request.id}/accounting/confirm`;
          payload.invoiceNumber = accounting.invoiceNumber;
          payload.budgetCode = accounting.budgetCode;
          payload.note = accounting.note;
        } else if (action === 'RETURN') {
          endpoint = `/requests/${request.id}/accounting/return`;
        }
      } else if (request.status === 'PENDING_DELIVERY') {
        if (action === 'APPROVE') {
          endpoint = `/requests/${request.id}/delivery`;
          payload.receivedBy = delivery.receivedBy;
          payload.remark = delivery.remark;
          payload.items = Object.entries(itemDeliveryStates).map(([itemId, state]) => ({
            itemId,
            deliveryStatus: state.status,
            deliveryNote: state.note || undefined,
          }));
          delete payload.decision;
        }
      } else if (request.status === 'PENDING_RECEIPT_CONFIRMATION') {
        if (action === 'APPROVE') {
          endpoint = `/requests/${request.id}/receipt-confirm`;
          delete payload.decision;
        }
      } else {
        // Fallback
        endpoint = `/requests/${request.id}/manager-approval`;
      }

      await api.post(endpoint, payload);
      // Clean up session storage after successful submission
      sessionStorage.removeItem(STORAGE_KEY_PROC);
      sessionStorage.removeItem(STORAGE_KEY_ACC);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-6 shadow-sm flex flex-col gap-4 sticky bottom-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg font-bold text-text-primary">
          {isRequesterDuringDelivery ? '部分設備簽收' : '處理動作'}
        </span>
        <span className="text-sm font-medium text-text-secondary px-2 py-0.5 bg-neutral/10 rounded-full">
          {isRequesterDuringDelivery ? '申請人' : currentUser.roles[0]?.role}
        </span>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md border border-danger/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isRequesterDuringDelivery && hasDeliveriesToConfirm && (
        <div className="w-full flex flex-col gap-3">
          <div className="bg-[#8B5CF6]/10 rounded-md border border-[#8B5CF6]/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#8B5CF6] flex items-center gap-2">
                📦 待您驗收的已到貨設備
              </span>
              <span className="text-xs text-[#8B5CF6]/80">其餘設備採購仍在處理中</span>
            </div>
            <div className="flex flex-col gap-2">
              {request.items.filter(i => i.deliveryStatus === 'DELIVERED').map(item => (
                <div key={item.id} className="flex items-center justify-between bg-background p-3 rounded-md border border-border shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.itemNameSnapshot} x{item.quantity}</span>
                  </div>
                  {item.receiptConfirmedAt ? (
                    <span className="text-xs font-bold text-success flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> 已簽收
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConfirmPartialItem(item.id)}
                      disabled={loading}
                      className="bg-primary text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      確認領取
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isHandler && (
      <>
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between w-full">

        {request.status === 'PROCUREMENT_IN_PROGRESS' && isHandler && (
          <div className="w-full flex flex-col gap-2 bg-primary/5 p-3 rounded-md border border-primary/20">
            {!isSimulatedProcurement && (
              <div className="flex items-center text-sm text-primary font-medium">
                <span className="animate-spin mr-2">🔄</span>
                單據已拋轉至採購系統處理。等待回傳...
              </div>
            )}
            <div className="flex gap-2 w-full flex-wrap">
              <input type="text" placeholder="供應商名稱" value={procurement.supplierName} onChange={e => setProcurement({...procurement, supplierName: e.target.value})} readOnly={isSimulatedProcurement} className={`flex-1 min-w-[150px] bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary ${isSimulatedProcurement ? 'opacity-60 bg-neutral/10 cursor-not-allowed' : ''}`} />
              <input type="text" placeholder="採購單號" value={procurement.poNumber} onChange={e => setProcurement({...procurement, poNumber: e.target.value})} readOnly={isSimulatedProcurement} className={`flex-1 min-w-[150px] bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary ${isSimulatedProcurement ? 'opacity-60 bg-neutral/10 cursor-not-allowed' : ''}`} />
              <input type="number" placeholder="實際總額" value={procurement.actualTotalAmount} onChange={e => setProcurement({...procurement, actualTotalAmount: Number(e.target.value)})} readOnly={isSimulatedProcurement} className={`w-full lg:w-32 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary ${isSimulatedProcurement ? 'opacity-60 bg-neutral/10 cursor-not-allowed' : ''}`} />
              {!isSimulatedProcurement && (
                <button 
                  disabled={isSimulatingProc}
                  onClick={async () => {
                    setIsSimulatingProc(true);
                    try {
                      const res = await api.post(`/requests/${request.id}/procurement/simulate`);
                      setProcurement(res.data);
                      setIsSimulatedProcurement(true);
                      sessionStorage.setItem(STORAGE_KEY_PROC, JSON.stringify(res.data));
                    } catch (err) {
                      setError('模擬回傳失敗');
                    } finally {
                      setIsSimulatingProc(false);
                    }
                  }}
                  className="bg-background border-2 border-dashed border-primary text-primary px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/10 transition-colors flex items-center whitespace-nowrap disabled:opacity-50"
                >
                  {isSimulatingProc ? <span className="animate-spin mr-1">🔄</span> : '🤖'} 模擬接收系統回傳
                </button>
              )}
            </div>
          </div>
        )}

        {request.status === 'PENDING_ACCOUNTING_CONFIRMATION' && isHandler && (
          <div className="w-full flex flex-col gap-2 bg-primary/5 p-3 rounded-md border border-primary/20">
            {!isSimulatedAccounting && (
              <div className="flex items-center text-sm text-primary font-medium">
                <span className="animate-spin mr-2">🔄</span>
                已拋轉至會計系統進行發票與採購單核銷...
              </div>
            )}
            <div className="flex gap-2 w-full flex-wrap">
              <input type="text" placeholder="發票號碼" value={accounting.invoiceNumber} onChange={e => setAccounting({...accounting, invoiceNumber: e.target.value})} readOnly={isSimulatedAccounting} className={`flex-1 min-w-[150px] bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary ${isSimulatedAccounting ? 'opacity-60 bg-neutral/10 cursor-not-allowed' : ''}`} />
              <input type="text" placeholder="預算科目" value={accounting.budgetCode} onChange={e => setAccounting({...accounting, budgetCode: e.target.value})} readOnly={isSimulatedAccounting} className={`flex-1 min-w-[150px] bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary ${isSimulatedAccounting ? 'opacity-60 bg-neutral/10 cursor-not-allowed' : ''}`} />
              {!isSimulatedAccounting && (
                <button 
                  disabled={isSimulatingAcc}
                  onClick={async () => {
                    setIsSimulatingAcc(true);
                    try {
                      const res = await api.post(`/requests/${request.id}/accounting/simulate`);
                      const newAcc = { ...accounting, ...res.data };
                      setAccounting(newAcc);
                      setIsSimulatedAccounting(true);
                      sessionStorage.setItem(STORAGE_KEY_ACC, JSON.stringify(newAcc));
                    } catch (err) {
                      setError('模擬回傳失敗');
                    } finally {
                      setIsSimulatingAcc(false);
                    }
                  }}
                  className="bg-background border-2 border-dashed border-primary text-primary px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/10 transition-colors flex items-center whitespace-nowrap disabled:opacity-50"
                >
                  {isSimulatingAcc ? <span className="animate-spin mr-1">🔄</span> : '🤖'} 模擬接收系統回傳
                </button>
              )}
            </div>
          </div>
        )}

        {request.status === 'PENDING_DELIVERY' && isHandler && (
          <div className="w-full flex flex-col gap-3">
            <div className="bg-primary/5 rounded-md border border-primary/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-primary">📦 設備到貨確認清單</span>
                <span className="text-[10px] text-text-secondary bg-neutral/10 px-2 py-0.5 rounded">
                  {Object.values(itemDeliveryStates).filter(s => s.status === 'DELIVERED').length}/{request.items.length} 已到貨
                </span>
              </div>
              {request.items.map(item => {
                const state = itemDeliveryStates[item.id] || { status: 'PENDING', note: '' };
                const isConfirmed = !!item.receiptConfirmedAt;
                return (
                  <div key={item.id} className={`flex flex-col gap-1 p-2 rounded border ${
                    state.status === 'DELIVERED' ? 'bg-success/5 border-success/20' :
                    state.status === 'OUT_OF_STOCK' ? 'bg-danger/5 border-danger/20' :
                    'bg-background border-border'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium flex-1 ${state.status === 'OUT_OF_STOCK' ? 'line-through text-text-secondary' : ''}`}>
                        {item.itemNameSnapshot || '未命名'} <span className="text-text-secondary">x{item.quantity}</span>
                      </span>
                      {isConfirmed ? (
                        <span className="text-xs font-bold text-success flex items-center gap-1 min-w-[100px]">
                          <CheckCircle className="w-3 h-3" /> 申請人已簽收
                        </span>
                      ) : (
                        <select
                          className="bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary min-w-[100px]"
                          value={state.status}
                          onChange={e => setItemDeliveryStates(prev => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], status: e.target.value }
                          }))}
                        >
                          <option value="PENDING">⏳ 等待中</option>
                          <option value="DELIVERED">✅ 已到貨</option>
                          <option value="OUT_OF_STOCK">❌ 缺貨取消</option>
                        </select>
                      )}
                    </div>
                    {state.status === 'OUT_OF_STOCK' && (
                      <input
                        type="text"
                        placeholder="缺貨原因 (如：供應商停產)"
                        value={state.note}
                        onChange={e => setItemDeliveryStates(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], note: e.target.value }
                        }))}
                        className="bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                value={delivery.receivedBy === request.requester?.name || !delivery.receivedBy ? '申請人本人' : '其他 (請填寫)'}
                onChange={e => {
                  if (e.target.value === '申請人本人') {
                    setDelivery({ ...delivery, receivedBy: request.requester?.name || '' });
                  } else {
                    setDelivery({ ...delivery, receivedBy: '' });
                  }
                }}
              >
                <option value="申請人本人">交付對象：{request.requester?.name}</option>
                <option value="其他 (請填寫)">其他 (部門代收)</option>
              </select>
              {delivery.receivedBy !== request.requester?.name && delivery.receivedBy !== undefined && (
                <input type="text" placeholder="代收人姓名" value={delivery.receivedBy}
                  onChange={e => setDelivery({...delivery, receivedBy: e.target.value})}
                  className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
              )}
            </div>
            {Object.values(itemDeliveryStates).some(s => s.status === 'PENDING') && (
              <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 px-2 py-1.5 rounded border border-warning/20">
                <span>⚠️</span> 尚有 {Object.values(itemDeliveryStates).filter(s => s.status === 'PENDING').length} 項設備等待中，送出後單據將維持「部分到貨」狀態
              </div>
            )}
          </div>
        )}

        {request.status === 'PENDING_RECEIPT_CONFIRMATION' && isHandler && (
          <div className="w-full flex flex-col gap-2">
            <div className="bg-success/5 rounded-md border border-success/20 p-3 space-y-2">
              <span className="text-sm font-bold text-text-primary">✅ 請確認以下設備已收到</span>
              {request.items.map(item => (
                <div key={item.id} className={`flex items-center gap-2 p-2 rounded border text-sm ${
                  item.deliveryStatus === 'OUT_OF_STOCK'
                    ? 'bg-neutral/5 border-border text-text-secondary'
                    : 'bg-background border-success/20'
                }`}>
                  {item.deliveryStatus === 'OUT_OF_STOCK' ? (
                    <>
                      <span>🚫</span>
                      <span className="line-through flex-1">{item.itemNameSnapshot} x{item.quantity}</span>
                      <span className="text-xs text-danger">缺貨取消{item.deliveryNote ? ` (${item.deliveryNote})` : ''}</span>
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      <span className="flex-1 font-medium">{item.itemNameSnapshot} x{item.quantity}</span>
                      {item.receiptConfirmedAt ? (
                        <span className="text-xs text-success">已部分簽收</span>
                      ) : (
                        <span className="text-xs text-success">已到貨，待簽收</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {['PENDING_DEPARTMENT_MANAGER_APPROVAL', 'PENDING_SENIOR_MANAGER_APPROVAL'].includes(request.status) && (
          <select 
            className="w-full lg:w-40 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            value={selectedReason}
            onChange={e => setSelectedReason(e.target.value)}
          >
            <option value="">-- 常用意見/退回理由 --</option>
            <option value="數量或金額有誤">數量或金額有誤</option>
            <option value="規格不符需求">規格不符需求</option>
            <option value="缺少必要附件或說明">缺少必要附件或說明</option>
            <option value="預算不足請重估">預算不足請重估</option>
            <option value="不符合公司採購政策">不符合公司採購政策</option>
            <option value="其他 (自填)">其他 (自填)</option>
          </select>
        )}

        {request.status === 'PENDING_IT_REVIEW' && (
          <select 
            className="w-full lg:w-48 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            value={selectedReason}
            onChange={e => setSelectedReason(e.target.value)}
          >
            <option value="">-- IT 專屬退回理由 --</option>
            <option value="不符資安與合規性規範">不符資安與合規性規範</option>
            <option value="不支援現有系統或網路架構">不支援現有系統或網路架構</option>
            <option value="建議改配標準設備型號">建議改配標準設備型號</option>
            <option value="規格超出工作實際需求">規格超出工作實際需求</option>
            <option value="其他 (自填)">其他 (自填)</option>
          </select>
        )}

        {['PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS'].includes(request.status) && (
          <select 
            className="w-full lg:w-48 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            value={selectedReason}
            onChange={e => setSelectedReason(e.target.value)}
          >
            <option value="">-- 採購退回理由 --</option>
            <option value="供應商缺貨或已停產">供應商缺貨或已停產</option>
            <option value="尋無符合規格之替代品">尋無符合規格之替代品</option>
            <option value="實際報價嚴重超支建議重估">實際報價嚴重超支建議重估</option>
            <option value="其他 (自填)">其他 (自填)</option>
          </select>
        )}

        {request.status === 'PENDING_ACCOUNTING_CONFIRMATION' && (
          <select 
            className="w-full lg:w-48 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            value={selectedReason}
            onChange={e => setSelectedReason(e.target.value)}
          >
            <option value="">-- 會計退回理由 --</option>
            <option value="發票金額與採購單不符">發票金額與採購單不符</option>
            <option value="缺少必要之請款單據或憑證">缺少必要之請款單據或憑證</option>
            <option value="預算科目歸屬錯誤">預算科目歸屬錯誤</option>
            <option value="其他 (自填)">其他 (自填)</option>
          </select>
        )}

        <input 
          type="text" 
          placeholder="意見備註 (選項)..." 
          className="flex-1 min-w-[200px] bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => handleAction('APPROVE')}
          disabled={loading}
          className="bg-success text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-success-hover transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <CheckCircle className="w-4 h-4 mr-1.5" />
          {request.status === 'PENDING_PROCUREMENT' ? '拋單至採購模組' :
           request.status === 'PROCUREMENT_IN_PROGRESS' ? '確認並拋轉會計' :
           request.status === 'PENDING_ACCOUNTING_CONFIRMATION' ? '完成會計核銷' :
           request.status === 'PENDING_DELIVERY' ? (
             Object.values(itemDeliveryStates).every(s => s.status !== 'PENDING') ? '設備已全數交付' : '📦 更新到貨狀態'
           ) :
           request.status === 'PENDING_RECEIPT_CONFIRMATION' ? '確認結案簽收' :
           '核准/完成'}
        </button>
        {['PENDING_DEPARTMENT_MANAGER_APPROVAL', 'PENDING_SENIOR_MANAGER_APPROVAL', 'PENDING_IT_REVIEW', 'PENDING_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS', 'PENDING_ACCOUNTING_CONFIRMATION'].includes(request.status) && (
          <>
            <button 
              onClick={() => handleAction('RETURN')}
              disabled={loading}
              className="bg-background text-warning border border-warning/30 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-warning/10 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <CornerUpLeft className="w-4 h-4 mr-1.5" />
              退回修改
            </button>
            {['PENDING_DEPARTMENT_MANAGER_APPROVAL', 'PENDING_SENIOR_MANAGER_APPROVAL', 'PENDING_IT_REVIEW'].includes(request.status) && (
              <button 
                onClick={() => handleAction('REJECT')}
                disabled={loading}
                className="bg-background text-danger border border-danger/30 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-danger/10 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                駁回
              </button>
            )}
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
};
