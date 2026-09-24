// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { DemoAuthProvider } from './services/auth/AuthContext.tsx';
import { AdminAuthProvider } from './services/admin/AdminAuthContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DemoAuthProvider>
        <AdminAuthProvider>
          <App />
        </AdminAuthProvider>
      </DemoAuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
