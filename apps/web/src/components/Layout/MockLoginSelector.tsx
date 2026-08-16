import { useEffect, useState, type ChangeEvent, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type User } from '../../store/authStore';
import api from '../../lib/api';
import { LogOut } from 'lucide-react';

export const MockLoginSelector: FC = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, logout } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get<User[]>('/users/mock-list').then((res) => {
      setUsers(res.data);
    }).catch(err => console.error('Failed to load mock users', err));
  }, []);

  const handleUserChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selected = users.find(u => u.id === e.target.value);
    if (selected) {
      setCurrentUser(selected);
      navigate('/');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  const roleMap: Record<string, string> = {
    'EMPLOYEE': '一般員工',
    'MANAGER': '主管',
    'IT': 'IT人員',
    'PROCUREMENT': '採購人員',
    'ACCOUNTING': '會計人員'
  };

  const deptMap: Record<string, string> = {
    'Information Technology': '資訊部',
    'Executive': '高階管理處',
    'Finance': '財務部',
    'Procurement': '採購部'
  };

  return (
    <div className="flex items-center space-x-3 text-sm">
      <div className="flex flex-col text-right hidden md:flex">
        <span className="font-medium text-text-primary">{currentUser.name}</span>
        <span className="text-xs text-text-secondary">
          {deptMap[currentUser.department.name] || currentUser.department.name} · {currentUser.roles.map(r => roleMap[r.role] || r.role).join(', ')}
        </span>
      </div>
      
      <div className="flex items-center space-x-2 border-l border-border pl-3">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded mb-1">Demo 快速切換</span>
          <select
            value={currentUser.id}
            onChange={handleUserChange}
            className="bg-surface border border-border text-text-primary text-sm rounded-md focus:ring-primary focus:border-primary block p-1 outline-none cursor-pointer w-full max-w-[150px] truncate"
          >
            {users.map(user => {
              let title = user.roles.map(r => roleMap[r.role] || r.role).join(', ');
              if (user.email === 'vp_clark@example.com') title = '高階主管';
              if (user.email === 'mgr_bob@example.com') title = '部門主管';
              
              return (
                <option key={user.id} value={user.id}>
                  {user.name} ({title})
                </option>
              );
            })}
          </select>
        </div>

        <button 
          onClick={handleLogout}
          className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
          title="登出"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
