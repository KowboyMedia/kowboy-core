import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import '@tabler/core/dist/css/tabler.min.css';
import './panel.css';
import { LinkPage, SignInPage } from './SignIn';
import { InboxPage } from './Inbox';
import { BrokeragesPage } from './Brokerages';
import { BrokeragePage } from './Brokerage';
import { NewBrokeragePage, NewBrokerageStep } from './NewBrokerage';

function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/link" element={<LinkPage />} />
      <Route path="/" element={<InboxPage />} />
      <Route path="/brokerages" element={<BrokeragesPage />} />
      <Route path="/brokerages/:id" element={<BrokeragePage />} />
      <Route path="/new" element={<NewBrokeragePage />} />
      <Route path="/new/:id" element={<NewBrokeragePage />} />
      <Route path="/new/:id/crm" element={<NewBrokerageStep step="crm" />} />
      <Route path="/new/:id/website" element={<NewBrokerageStep step="website" />} />
      <Route path="/new/:id/check" element={<NewBrokerageStep step="check" />} />
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
