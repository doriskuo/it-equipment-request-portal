import { useState, useRef, useEffect, type FC } from 'react';
import { Bell, Check, Info, AlertCircle } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export const NotificationBell: FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (id: string, requestId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead(id);
    }
    setIsOpen(false);
    navigate(`/requests/${requestId}`);
  };

  return (
    <div className="relative mr-4" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface rounded-lg shadow-lg border border-border overflow-hidden z-50 flex flex-col max-h-[400px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-neutral/5">
            <h3 className="font-bold text-sm text-text-primary">通知</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> 全部標示為已讀
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">
                目前沒有新通知
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id, notif.requestId, notif.isRead)}
                    className={`p-4 hover:bg-neutral/5 cursor-pointer transition-colors flex gap-3 ${!notif.isRead ? 'bg-primary/5' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {notif.type === 'ACTION_REQUIRED' ? (
                        <AlertCircle className="w-4 h-4 text-warning" />
                      ) : (
                        <Info className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className={`text-sm font-medium ${!notif.isRead ? 'text-text-primary font-bold' : 'text-text-secondary'}`}>
                        {notif.title}
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">{notif.message}</p>
                      <span className="text-[10px] text-text-secondary/60 mt-2 block">
                        {new Date(notif.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full shrink-0 ml-auto mt-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
