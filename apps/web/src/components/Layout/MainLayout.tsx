import { Navigate, Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../store/authStore';

export const MainLayout: React.FC = () => {
  const currentUser = useAuthStore(state => state.currentUser);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen bg-background flex flex-col font-sans overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-col flex-1 max-w-7xl w-full mx-auto p-4 md:px-8 md:py-4 overflow-y-auto">
          <div className="flex flex-col flex-1 min-h-0 w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
