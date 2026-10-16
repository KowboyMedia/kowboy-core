import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import '@tabler/core/dist/css/tabler.min.css';
import './panel.css';
import { LinkPage, SignInPage } from './SignIn';
import { InboxPage } from './Inbox';

function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/link" element={<LinkPage />} />
      <Route path="/" element={<InboxPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter basename="/admin">
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
