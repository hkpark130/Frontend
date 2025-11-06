import { AuthStatus } from '@/components/AuthStatus'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Header() {
  return (
    <header className="header" style={{ width: '100%', display: 'flex', alignItems: 'center', minHeight: 56 }}>
      <div className="spacer" style={{ flex: 1 }} />
      <div
        className="header-actions"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, minWidth: 0 }}
      >
        <NotificationBell />
        <AuthStatus />
      </div>
    </header>
  )
}
