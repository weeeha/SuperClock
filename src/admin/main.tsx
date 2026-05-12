import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import AdminApp from './App';
import { queryClient } from './lib/query';

const root = document.getElementById('admin-root');
if (!root) throw new Error('admin-root missing');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <AdminApp />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
