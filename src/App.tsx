import { createBrowserRouter, Navigate, RouterProvider, Outlet } from 'react-router'
import { AuthProvider } from '@/context/AuthContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { AgreementsPage } from '@/pages/agreements/AgreementsPage'
import { AgreementNew } from '@/pages/agreements/AgreementNew'
import { AgreementDetail } from '@/pages/agreements/AgreementDetail'
import { WorkOrdersPage } from '@/pages/work-orders/WorkOrdersPage'
import { WorkOrderDetail } from '@/pages/work-orders/WorkOrderDetail'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ClientDetail } from '@/pages/clients/ClientDetail'
import { FieldCompletionForm } from '@/pages/field/FieldCompletionForm'
import { SiteDetail } from '@/pages/sites/SiteDetail'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { TeamPage } from '@/pages/team/TeamPage'
import { TeamMemberDetail } from '@/pages/team/TeamMemberDetail'

function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <AuthGuard />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'agreements', element: <AgreementsPage /> },
              { path: 'agreements/new', element: <AgreementNew /> },
              { path: 'agreements/:id', element: <AgreementDetail /> },
              { path: 'work-orders', element: <WorkOrdersPage /> },
              { path: 'work-orders/:id', element: <WorkOrderDetail /> },
              { path: 'work-orders/:id/complete', element: <FieldCompletionForm /> },
              { path: 'schedule', element: <SchedulePage /> },
              { path: 'clients', element: <ClientsPage /> },
              { path: 'clients/:id', element: <ClientDetail /> },
              { path: 'sites/:id', element: <SiteDetail /> },
              { path: 'team', element: <TeamPage /> },
              { path: 'team/:id', element: <TeamMemberDetail /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
      { path: '/login', element: <LoginPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
