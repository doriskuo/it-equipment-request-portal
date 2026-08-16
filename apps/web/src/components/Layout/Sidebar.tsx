import { useState, type FC } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Monitor, 
  FileText, 
  Inbox, 
  CheckCircle,
  Settings,
  Archive,
  Building2
} from 'lucide-react';
import clsx from 'clsx';

export const Sidebar: FC = () => {
  const { currentUser } = useAuthStore();
  const location = useLocation();
  
  // 展開狀態控制
  const [isProcurementOpen, setIsProcurementOpen] = useState(true);
  const [isITEquipmentOpen, setIsITEquipmentOpen] = useState(true);

  // 判斷是否具備審核/處理權限
  const isApprover = currentUser && currentUser.roles.some(r => ['MANAGER', 'IT', 'PROCUREMENT', 'ACCOUNTING'].includes(r.role));

  const isActive = (path: string, searchParams?: string) => {
    const isPathMatch = location.pathname === path;
    const isRequestDetail = location.pathname.startsWith('/requests/') && location.pathname !== '/requests/new';
    const fromType = location.state?.from;

    if (searchParams) {
      const typeStr = searchParams.replace('?type=', '');
      
      if (isRequestDetail && fromType === typeStr) {
        return true;
      }
      
      if (isPathMatch) {
        // 如果是在首頁且沒有 search params，但我們其實是在「我的申請單」的預設狀態
        if (searchParams === '?type=my' && !location.search && !isRequestDetail) return true;
        return location.search === searchParams;
      }
      return false;
    }
    return isPathMatch && !isRequestDetail;
  };

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col hidden md:flex h-full">
      <div className="flex-1 py-6 px-4 overflow-y-auto">
        {/* Fake Modules */}
        <div className="mb-6">
          <div className="flex items-center text-text-tertiary px-2 mb-2 text-sm cursor-default">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            儀表板
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center text-text-tertiary px-2 mb-2 text-sm cursor-default">
            <Users className="w-4 h-4 mr-2" />
            人事管理
          </div>
        </div>

        {/* Active Module: Procurement */}
        <div className="mb-6">
          <button 
            onClick={() => setIsProcurementOpen(!isProcurementOpen)}
            className="w-full flex items-center justify-between text-text px-2 mb-2 font-semibold text-sm hover:bg-surface-hover rounded py-1 transition-colors cursor-pointer"
          >
            <div className="flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2" />
              採購管理
            </div>
          </button>
          
          {isProcurementOpen && (
            <div className="ml-4 border-l border-border pl-2 mt-2 space-y-4">
              {/* Fake sub-module */}
              <div className="flex items-center text-text-tertiary px-2 text-sm cursor-default">
                <Building2 className="w-4 h-4 mr-2" />
                辦公用品請購
              </div>

              {/* IT Equipment Procurement (Our MVP) */}
              <div>
                <button 
                  onClick={() => setIsITEquipmentOpen(!isITEquipmentOpen)}
                  className="w-full flex items-center justify-between text-text font-semibold px-2 mb-2 text-sm hover:bg-surface-hover rounded py-1 transition-colors cursor-pointer"
                >
                  <div className="flex items-center">
                    <Monitor className="w-4 h-4 mr-2" />
                    IT 設備請購
                  </div>
                </button>
                
                {isITEquipmentOpen && (
                  <ul className="ml-6 space-y-1">
                    <li>
                      <Link
                        to="/requests/new"
                        className={clsx(
                          'flex items-center px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                          isActive('/requests/new')
                            ? 'bg-surface-hover text-text font-medium'
                            : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                        )}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        發起新請購
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/?type=my"
                        className={clsx(
                          'flex items-center px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                          isActive('/', '?type=my')
                            ? 'bg-surface-hover text-text font-medium'
                            : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                        )}
                      >
                        <Inbox className="w-4 h-4 mr-2" />
                        我的申請單
                      </Link>
                    </li>
                    
                    {/* Role-based Dynamic Menu */}
                    {isApprover && (
                      <li>
                        <Link
                          to="/?type=pending"
                          className={clsx(
                            'flex items-center px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                            isActive('/', '?type=pending')
                              ? 'bg-surface-hover text-text font-medium'
                              : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                          )}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          待辦審核區
                        </Link>
                      </li>
                    )}

                    <li>
                      <Link 
                        to="/?type=archive"
                        className={clsx(
                          'flex items-center px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                          isActive('/', '?type=archive')
                            ? 'bg-surface-hover text-text font-medium'
                            : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                        )}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        歷史歸檔
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fake Modules */}
        <div>
          <div className="flex items-center text-text-tertiary px-2 text-sm cursor-default">
            <Settings className="w-4 h-4 mr-2" />
            系統設定
          </div>
        </div>
      </div>

      {/* Disclaimer - Fixed at bottom */}
      <div className="p-4 bg-surface-hover border-t border-border mt-auto">
        <div className="bg-warning/10 border border-warning/20 p-3 rounded-md">
          <p className="text-xs text-warning-dark leading-relaxed">
            <span className="font-bold">💡 MVP 概念展示版本：</span>
            <br />
            除「IT 設備請購」模組外，其餘大模組與次選單皆為概念示意，可依企業需求無限擴充。側邊欄選單會依據登入身分動態調整。
          </p>
        </div>
      </div>
    </aside>
  );
};
