import { useAuth } from 'react-oidc-context'

export function AuthStatus() {
  const auth = useAuth()

  if (auth.isLoading) return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
      <span>로딩 중...</span>
    </div>
  )

  if (auth.error) {
    console.error('Authentication Error:', auth.error)
    return <span style={{ color: 'crimson' }}>{auth.error.message}</span>
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
        <button onClick={() => auth.signinRedirect()} className="btn">
          로그인
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
      <span>{auth.user?.profile?.preferred_username || 'user'}</span>
      <button onClick={() => auth.signoutRedirect()} className="btn outline">
        로그아웃
      </button>
    </div>
  )
}
