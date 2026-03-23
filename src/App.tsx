import { createBrowserRouter, Navigate, RouterProvider, Outlet } from 'react-router'
import { AuthProvider } from '@/context/AuthContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { WorkOrdersPage } from '@/pages/work-orders/WorkOrdersPage'
import { WorkOrderNew } from '@/pages/work-orders/WorkOrderNew'
import { WorkOrderDetail } from '@/pages/work-orders/WorkOrderDetail'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ClientDetail } from '@/pages/clients/ClientDetail'
import { FieldCompletionForm } from '@/pages/field/FieldCompletionForm'
import { SiteDetail } from '@/pages/sites/SiteDetail'

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
              { index: true, element: <Navigate to="/work-orders" replace /> },
              { path: 'work-orders', element: <WorkOrdersPage /> },
              { path: 'work-orders/new', element: <WorkOrderNew /> },
              { path: 'work-orders/:id', element: <WorkOrderDetail /> },
              { path: 'work-orders/:id/complete', element: <FieldCompletionForm /> },
              { path: 'schedule', element: <SchedulePage /> },
              { path: 'clients', element: <ClientsPage /> },
              { path: 'clients/:id', element: <ClientDetail /> },
              { path: 'sites/:id', element: <SiteDetail /> },
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
