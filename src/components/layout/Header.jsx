import { AuthStatus } from '../../components/AuthStatus'

export default function Header() {
  return (
    <header className="header">
      <input className="search" placeholder="Search..." />
      <div className="spacer" />
      <AuthStatus />
    </header>
  )
}
