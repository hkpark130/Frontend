import { useAuth } from 'react-oidc-context'

export function AuthStatus() {
  const auth = useAuth()

  if (auth.isLoading) return <span>로딩 중...</span>

    if (auth.error) {
        console.error('Authentication Error:', auth.error)
        return <span style={{ color: 'crimson' }}>Auth error</span>
    }

  if (!auth.isAuthenticated) {
    return (
      <button onClick={() => auth.signinRedirect()} className="btn">
        로그인
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span>{auth.user?.profile?.preferred_username || 'user'}</span>
      <button onClick={() => auth.signoutRedirect()} className="btn outline">
        로그아웃
      </button>
    </div>
  )
}
