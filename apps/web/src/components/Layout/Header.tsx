import { MockLoginSelector } from './MockLoginSelector';
import { NotificationBell } from './NotificationBell';
import { Package } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-surface border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center space-x-2 mr-8">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white">
          <Package className="w-5 h-5" />
        </div>
        <span className="text-xl font-bold tracking-tight text-text-primary">
          IT 設備請購系統 <span className="text-primary font-black">MVP</span>
        </span>
      </div>
      
      <div className="flex items-center">
        <NotificationBell />
        <MockLoginSelector />
      </div>
    </header>
  );
};
