// The app: Refine over Core's admin API, React Router for the addresses, one toaster, and the
// pages of the information architecture (docs/admin-panel-design.md §2).
import { Authenticated, Refine, type NotificationProvider } from '@refinedev/core';
import routerProvider, { CatchAllNavigate } from '@refinedev/react-router';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { Toaster, toast } from 'sonner';
import { Layout } from '@/components/layout';
import { authProvider, dataProvider, liveProvider } from '@/lib/providers';
import { SignIn } from '@/pages/sign-in';
import { Overview } from '@/pages/overview';
import { Flow } from '@/pages/flow';
import { Records } from '@/pages/records';
import { RecordPage } from '@/pages/record';
import { OldRecordPage } from '@/pages/record-old';
import { Tenants } from '@/pages/tenants';
import { TenantPage } from '@/pages/tenant';
import { OldTenantPage } from '@/pages/tenant-old';
import { ManualSyncPage } from '@/pages/sync';
import { FailedForms } from '@/pages/forms';
import { Events } from '@/pages/events';
import { Crms } from '@/pages/crms';
import { CrmPage } from '@/pages/crm';
import { SettingsPage } from '@/pages/settings';

/** Refine's notifications are the app's toasts, so one outcome never appears twice (§3 I, Must). */
const notificationProvider: NotificationProvider = {
  open: ({ type, message, description }) => {
    const body = description ? { description } : undefined;
    if (type === 'error') toast.error(message, body);
    else toast.success(message, body);
  },
  close: () => undefined,
};

export function App() {
  return (
    // No transitions: the record id box takes its value from the address, and React cannot
    // control a text box from inside a transition, so keys typed fast could be lost.
    <BrowserRouter basename="/admin" useTransitions={false}>
      <Refine
        dataProvider={dataProvider}
        authProvider={authProvider}
        liveProvider={liveProvider}
        routerProvider={routerProvider}
        notificationProvider={notificationProvider}
        resources={[
          { name: 'overview', list: '/' },
          { name: 'records', list: '/records' },
          { name: 'tenants', list: '/tenants', show: '/tenants/:id', create: '/tenants/new' },
          { name: 'forms', list: '/forms' },
          { name: 'events', list: '/events' },
          { name: 'crms', list: '/crms', show: '/crms/:provider' },
          { name: 'settings', list: '/settings' },
          { name: 'devices', list: '/settings' },
        ]}
        options={{
          liveMode: 'auto',
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
          disableTelemetry: true,
        }}
      >
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route
            element={
              <Authenticated key="area" fallback={<CatchAllNavigate to="/sign-in" />}>
                <Layout />
              </Authenticated>
            }
          >
            <Route index element={<Overview />} />
            <Route path="flow" element={<Flow />} />
            <Route path="records" element={<Records />} />
            <Route path="records/:connection/:datatype/:id" element={<RecordPage />} />
            <Route path="records-old/:connection/:datatype/:id" element={<OldRecordPage />} />
            <Route path="tenants" element={<Outlet />}>
              <Route index element={<Tenants />} />
              <Route path="new" element={<TenantPage />} />
              <Route path=":id" element={<TenantPage />} />
            </Route>
            <Route path="tenants-old/:id" element={<OldTenantPage />} />
            <Route path="manual-sync" element={<ManualSyncPage />} />
            <Route path="forms" element={<FailedForms />} />
            <Route path="events" element={<Events />} />
            <Route path="crms" element={<Outlet />}>
              <Route index element={<Crms />} />
              <Route path=":provider" element={<CrmPage />} />
            </Route>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster position="bottom-right" richColors closeButton />
      </Refine>
    </BrowserRouter>
  );
}
