import { useState, useEffect, type FormEvent, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type User } from '../store/authStore';
import api from '../lib/api';
import { Shield, Info, LogIn } from 'lucide-react';

export const LoginPage: FC = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mockUsers, setMockUsers] = useState<User[]>([]);

  // 如果已經登入，自動導向首頁
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // 抓取測試帳號清單 (僅為了快速帶入使用)
  useEffect(() => {
    api.get<User[]>('/users/mock-list')
      .then(res => setMockUsers(res.data))
      .catch(err => console.error('Failed to load mock users', err));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('請輸入電子信箱');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 模擬後端驗證過程 (在 MVP 中，我們只要確認 email 是否存在於我們的 mock users)
      // 如果要真實串接 JWT，這裡會打 api.post('/auth/login', { email, password })
      const user = mockUsers.find(u => u.email === email);
      
      if (!user) {
        setError('找不到該帳號，請確認信箱是否正確。');
        setLoading(false);
        return;
      }

      // 為了有真實登入的延遲感，稍微等待 500ms
      setTimeout(() => {
        setCurrentUser(user);
        navigate('/');
      }, 500);

    } catch (err) {
      setError('登入失敗，請稍後再試。');
      setLoading(false);
    }
  };

  const handleQuickLogin = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('demo-password'); // 隨便填一個密碼讓畫面感覺完整
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center text-primary mb-4">
          <Shield className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-text-primary">
          IT 設備請購系統
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Enterprise IT Procurement MVP
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow-sm border border-border sm:rounded-lg sm:px-10">
          
          <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div className="ml-3 flex-1 md:flex md:justify-between">
                <p className="text-xs text-primary leading-relaxed">
                  <strong className="block mb-1">【MVP 系統展示聲明】</strong>
                  本專案重點為展示「工作流程 (Workflow)」與「角色權限視角 (RBAC)」。真實環境將串接企業內部 SSO 系統，故本次不實作密碼加密與 JWT 發放。請直接點擊下方測試角色進行免密碼登入體驗。
                </p>
              </div>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-text-primary">
                電子信箱 (Email)
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-border px-3 py-2 placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">
                密碼 (Password)
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-border px-3 py-2 placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-danger mt-2">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {loading ? '驗證中...' : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>登入系統</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-surface px-2 text-text-secondary">
                  一鍵帶入測試帳號
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {mockUsers.map(user => {
                let roleLabel = user.roles.map(r => r.role).join(', ');
                if (user.email === 'vp_clark@example.com') roleLabel = '高階主管';
                if (user.email === 'mgr_bob@example.com') roleLabel = '部門主管';
                if (user.email === 'emp_alice@example.com') roleLabel = '一般員工';
                if (user.email === 'it_david@example.com') roleLabel = 'IT人員';
                if (user.email === 'proc_emma@example.com') roleLabel = '採購人員';
                if (user.email === 'acct_frank@example.com') roleLabel = '會計人員';

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleQuickLogin(user.email)}
                    className="inline-flex justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-text-primary shadow-sm hover:bg-neutral/5 transition-colors"
                  >
                    {user.name} ({roleLabel})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
