import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileTopBar } from './MobileTopBar'

export function AppShell() {
  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <MobileTopBar />
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0 pb-20 md:pb-0">
        <div className="mx-auto max-w-[1200px] p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
