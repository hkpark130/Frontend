import { useAuth } from 'react-oidc-context'
import { useLocation } from 'react-router-dom'
import { rememberPostLoginPath, getCurrentLocationPath } from '@/auth/postLoginRedirect'

export function AuthStatus() {
  const auth = useAuth()
  const location = useLocation()

  const handleLogin = () => {
    const target = `${location.pathname}${location.search}${location.hash}` || getCurrentLocationPath()
    rememberPostLoginPath(target)
    auth.signinRedirect({ state: { returnTo: target } })
  }

  if (auth.isLoading) return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
      <span>로딩 중...</span>
    </div>
  )

  if (auth.error) {
    console.error('Authentication Error:', auth.error)
    const message = auth.error?.message || '세션이 만료되었습니다. 다시 로그인 해주세요.'
    return (
      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
        <span style={{ color: 'crimson' }}>{message}</span>
        <button onClick={handleLogin} className="btn primary">
          다시 로그인
        </button>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
        <button onClick={handleLogin} className="btn">
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
