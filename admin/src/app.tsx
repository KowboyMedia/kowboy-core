// The app: the router, the query cache, the toasts, and the gate that sends a visitor without a
// session to the login page. Every page is a route under /admin.
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { isUnauthorized } from '@/api/client';
import { sessionQuery } from '@/api/queries';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/shell';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { TenantsPage } from '@/pages/tenants';
import { TenantPage } from '@/pages/tenant';
import { RecordsPage } from '@/pages/records';
import { RecordPage } from '@/pages/record';
import { JobsPage } from '@/pages/jobs';
import { JobPage } from '@/pages/job';
import { EventsPage } from '@/pages/events';
import { ProviderPage } from '@/pages/provider';
import { SettingsPage } from '@/pages/settings';
import { NotFoundPage } from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !isUnauthorized(error) && count < 2,
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

/** Everything behind the login: the shell with the session, or the way to the login page. */
function Gate() {
  const location = useLocation();
  const session = useQuery(sessionQuery());
  if (session.isPending) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (session.isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return (
    <Shell session={session.data}>
      <Outlet />
    </Shell>
  );
}

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: <Gate />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'tenants', element: <TenantsPage /> },
        { path: 'tenants/new', element: <TenantPage /> },
        { path: 'tenants/:id', element: <TenantPage /> },
        { path: 'records', element: <RecordsPage /> },
        { path: 'records/:connection/:datatype/:id', element: <RecordPage /> },
        { path: 'jobs', element: <JobsPage /> },
        { path: 'jobs/:id', element: <JobPage /> },
        { path: 'events', element: <EventsPage /> },
        { path: 'crm/:provider', element: <ProviderPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: '/admin' },
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
