import { useState, useEffect, type FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEquipment } from '../hooks/useEquipment';
import { useRequestDetail } from '../hooks/useRequests';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { Plus, Trash2, ArrowLeft, Save, Send, ChevronLeft, ChevronRight } from 'lucide-react';

interface FormItem {
  id: string; // local temp id
  categoryId?: string; // added back for UI selection
  equipmentProductId: string; // empty string for 'other'
  productName: string;
  specification: string;
  quantity: number;
  unitPrice: number;
}

export const RequestFormPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products } = useEquipment();
  const { request, loading: requestLoading } = useRequestDetail(id);
  const currentUser = useAuthStore(state => state.currentUser);

  const [purpose, setPurpose] = useState('NEW_EMPLOYEE');
  const [purposeNote, setPurposeNote] = useState('');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState('');
  const [remark, setRemark] = useState('');
  const [items, setItems] = useState<FormItem[]>([
    { id: Date.now().toString(), categoryId: '', equipmentProductId: '', productName: '', specification: '', quantity: 1, unitPrice: 0 }
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMinDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  };

  const ITEMS_PER_PAGE = 3;
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));

  // Load existing data if editing
  useEffect(() => {
    if (request && id) {
      setPurpose(request.purpose);
      setPurposeNote(request.purposeNote || '');
      setDesiredDeliveryDate(request.desiredDeliveryDate ? request.desiredDeliveryDate.split('T')[0] : '');
      setRemark(request.remark || '');
      setItems(request.items.map(i => {
        const prod = products.find(p => p.id === i.equipmentProductId);
        return {
          id: i.id,
          categoryId: prod?.category?.name || '',
          equipmentProductId: i.equipmentProductId || '',
          productName: i.itemNameSnapshot || i.productName || '',
          specification: i.specSnapshot || i.specification || '',
          quantity: i.quantity,
          unitPrice: i.estimatedUnitPrice || i.unitPrice || 0
        };
      }));
      setPageIndex(0);
    }
  }, [request, id, products]);

  const estimatedTotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

  const handlePrevPage = () => {
    if (pageIndex > 0) setPageIndex(p => p - 1);
  };

  const handleNextPage = () => {
    if (pageIndex < totalPages - 1) setPageIndex(p => p + 1);
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'categoryId') {
      item.equipmentProductId = '';
      item.productName = '';
      item.specification = '';
      item.unitPrice = 0;
    } else if (field === 'equipmentProductId' && value !== '') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        item.categoryId = prod.category?.name || '';
        item.productName = prod.name;
        item.specification = prod.specification;
        item.unitPrice = prod.referencePrice;
      }
    } else if (field === 'equipmentProductId' && value === '') {
      item.productName = '';
      item.specification = '';
      item.unitPrice = 0;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    const newLength = items.length + 1;
    setItems([...items, { id: Date.now().toString(), categoryId: '', equipmentProductId: '', productName: '', specification: '', quantity: 1, unitPrice: 0 }]);
    setPageIndex(Math.floor((newLength - 1) / ITEMS_PER_PAGE));
  };

  const removeItem = (globalIndex: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== globalIndex);
      setItems(newItems);
      const newTotalPages = Math.max(1, Math.ceil(newItems.length / ITEMS_PER_PAGE));
      if (pageIndex >= newTotalPages) {
        setPageIndex(newTotalPages - 1);
      }
    }
  };

  const handleSave = async (isSubmit: boolean) => {
    if (!purpose.trim()) {
      setError('請填寫請購目的。');
      return;
    }
    if (!desiredDeliveryDate.trim()) {
      setError('請選擇期望交期。');
      return;
    }
    if (items.some(i => !i.equipmentProductId || i.quantity <= 0)) {
      setError('所有項目都必須選擇產品名稱且數量大於 0。');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      purpose,
      purposeNote: purpose === 'OTHER' ? (purposeNote || null) : null,
      desiredDeliveryDate: desiredDeliveryDate ? new Date(desiredDeliveryDate).toISOString() : null,
      remark: remark || null, // 畫面上的「備註」
      items: items.map(i => ({
        equipmentProductId: i.equipmentProductId || null,
        productName: i.productName,
        specification: i.specification || null,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      }))
    };

    try {
      let savedId = id;
      if (id) {
        await api.patch(`/requests/${id}`, payload);
      } else {
        const res = await api.post<{ id: string }>('/requests', payload);
        savedId = res.data.id;
      }

      if (isSubmit && savedId) {
        await api.post(`/requests/${savedId}/submit`);
      }

      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '儲存時發生錯誤。');
    } finally {
      setSaving(false);
    }
  };

  if (id && requestLoading) return <div className="p-8 text-center">正在載入中...</div>;

  const currentItems = items.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);

  const categories = Array.from(new Set(products.map(p => p.category?.name).filter(Boolean)));

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[500px] space-y-4 max-w-6xl mx-auto w-full">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-text-primary">
          {id ? '編輯請購單' : '發起新請購'}
        </h1>
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow">
        {/* Left Column: Basic Info */}
        <div className="col-span-1 bg-surface rounded-lg border border-border shadow-sm p-4 flex flex-col h-full space-y-4">
          <h2 className="text-md font-bold text-text-primary border-b border-border pb-1">基本資訊</h2>
          
          <div className="bg-primary/5 rounded-md px-3 py-2 text-sm text-text-secondary border border-primary/10 flex flex-col space-y-1">
            <div className="flex justify-between items-center"><span className="text-text-primary">申請人</span> <span>{currentUser?.name}</span></div>
            <div className="flex justify-between items-center"><span className="text-text-primary">部門</span> <span>{currentUser?.department?.name}</span></div>
            <div className="flex justify-between items-center"><span className="text-text-primary">日期</span> <span>{new Date().toLocaleDateString('zh-TW')}</span></div>
          </div>

          <div className="flex flex-col flex-grow space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-text-primary">用途／原因 <span className="text-danger">*</span></label>
              <select
                value={purpose} onChange={(e) => setPurpose(e.target.value)}
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm focus:ring-primary focus:border-primary outline-none bg-background"
              >
                <option value="NEW_EMPLOYEE">新進員工設備</option>
                <option value="EQUIPMENT_REPLACEMENT">設備老舊替換</option>
                <option value="EQUIPMENT_FAILURE">設備損壞</option>
                <option value="JOB_REQUIREMENT">職務需求變更</option>
                <option value="PROJECT_REQUIREMENT">專案需求</option>
                <option value="EXPANSION">擴編/新需求</option>
                <option value="OTHER">其他 (請說明)</option>
              </select>
              {purpose === 'OTHER' && (
                <input 
                  type="text" 
                  value={purposeNote} onChange={(e) => setPurposeNote(e.target.value)}
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm focus:ring-primary focus:border-primary outline-none bg-background mt-1"
                  placeholder="請輸入詳細原因"
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-text-primary">期望交期</label>
              <input 
                type="date" 
                min={getMinDate()}
                value={desiredDeliveryDate} onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm focus:ring-primary focus:border-primary outline-none bg-background"
              />
            </div>
            <div className="space-y-1 flex flex-col flex-grow">
              <label className="block text-xs font-medium text-text-primary">備註</label>
              <textarea 
                value={remark} onChange={(e) => setRemark(e.target.value)}
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm focus:ring-primary focus:border-primary outline-none bg-background resize-none flex-grow"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Items List & Actions */}
        <div className="col-span-1 lg:col-span-2 bg-surface rounded-lg border border-border shadow-sm p-4 flex flex-col h-full min-h-0">
          <div className="flex justify-between items-center border-b border-border pb-2 mb-3">
            <h2 className="text-md font-bold text-text-primary">
              請購項目 <span className="text-text-secondary font-normal text-sm ml-2">({items.length} 項, 第 {pageIndex + 1}/{totalPages} 頁)</span>
            </h2>
            <div className="flex items-center space-x-2">
              {totalPages > 1 && (
                <div className="flex items-center space-x-1 mr-2 border-r border-border pr-2">
                  <button onClick={handlePrevPage} disabled={pageIndex === 0} className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={handleNextPage} disabled={pageIndex === totalPages - 1} className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button onClick={addItem} type="button" className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1.5 rounded-md flex items-center font-medium transition-colors">
                <Plus className="w-3.5 h-3.5 mr-1" /> 新增項目
              </button>
            </div>
          </div>

          {/* Card-based Items List (Paginated, Fixed Height with Placeholders) */}
          <div className="flex-grow space-y-3 flex flex-col justify-between">
            {[0, 1, 2].map((slotIdx) => {
              const item = currentItems[slotIdx];
              if (!item) {
                // Empty Placeholder Slot
                return (
                  <div key={`empty-${slotIdx}`} className="bg-background/30 rounded-lg border border-border border-dashed p-3 relative flex-1 min-h-[88px] flex items-center justify-center">
                    <span className="text-text-secondary text-xs opacity-50">空白項目插槽</span>
                  </div>
                );
              }

              const globalIndex = pageIndex * ITEMS_PER_PAGE + slotIdx;
              return (
                <div key={item.id} className="bg-background rounded-lg border border-border p-3 relative group shadow-sm transition-all hover:border-primary/30 flex-1 min-h-[88px] flex flex-col justify-center">
                  <div className="absolute top-0 left-0 w-1 h-full bg-border group-hover:bg-primary/50 transition-colors rounded-l-lg" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pl-2 w-full items-center">
                    <div className="col-span-1 md:col-span-5 flex space-x-2">
                      <select 
                        value={item.categoryId || ''}
                        onChange={(e) => handleItemChange(globalIndex, 'categoryId', e.target.value)}
                        className="w-1/3 border border-border rounded px-2 py-1 text-xs focus:ring-primary focus:border-primary outline-none bg-surface"
                      >
                        <option value="">所有類別</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="w-2/3 flex flex-col">
                        <select 
                          value={item.equipmentProductId}
                          onChange={(e) => handleItemChange(globalIndex, 'equipmentProductId', e.target.value)}
                          className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-primary focus:border-primary outline-none bg-surface"
                        >
                          <option value="" disabled>選擇設備...</option>
                          {products
                            .filter(p => !item.categoryId || p.category?.name === item.categoryId)
                            .map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {item.specification ? (
                          <p className="text-[10px] text-text-secondary line-clamp-1 mt-0.5" title={item.specification}>{item.specification}</p>
                        ) : (
                          <p className="text-[10px] text-transparent mt-0.5">-</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-2 flex items-center space-x-1">
                      <span className="text-[10px] text-text-secondary uppercase">數量</span>
                      <input 
                        type="number" min="1" 
                        value={item.quantity} 
                        onChange={(e) => handleItemChange(globalIndex, 'quantity', Number(e.target.value))}
                        className="w-full border border-border rounded px-2 py-1 text-sm outline-none focus:ring-primary focus:border-primary bg-surface"
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-2 flex items-center space-x-1">
                      <span className="text-[10px] text-text-secondary uppercase">單價</span>
                      <input 
                        type="number" min="0" 
                        value={item.unitPrice} 
                        onChange={(e) => handleItemChange(globalIndex, 'unitPrice', Number(e.target.value))}
                        disabled
                        className="w-full border border-border rounded px-2 py-1 text-sm bg-neutral/5 text-text-secondary outline-none cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 flex flex-col justify-center items-end pr-2">
                      <span className="text-[10px] text-text-secondary uppercase mb-0.5">小計</span>
                      <div className="text-sm font-bold text-text-primary">
                        NT$ {(item.quantity * item.unitPrice).toLocaleString()}
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-1 flex items-center justify-end">
                      <button 
                        onClick={() => removeItem(globalIndex)} 
                        disabled={items.length === 1}
                        className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total & Actions */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg w-full md:w-auto flex items-center space-x-4">
                <span className="text-text-secondary text-xs font-medium">總額</span>
                <span className="text-xl font-black text-primary tracking-tight">NT$ {estimatedTotal.toLocaleString()}</span>
              </div>
              
              <div className="flex space-x-2 w-full md:w-auto">
                <button 
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 border border-border rounded-md text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>草稿</span>
                </button>
                <button 
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-surface rounded-md text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>送出</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
