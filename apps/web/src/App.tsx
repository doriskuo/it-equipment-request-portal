import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { InboxPage } from './features/InboxPage';
import { RequestFormPage } from './features/RequestFormPage';
import { RequestDetailPage } from './features/RequestDetail/RequestDetailPage';
import { LoginPage } from './features/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/" element={<MainLayout />}>
          <Route index element={<InboxPage />} />
          <Route path="requests/new" element={<RequestFormPage />} />
          <Route path="requests/:id/edit" element={<RequestFormPage />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
