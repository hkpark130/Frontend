import { Link, useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { rememberPostLoginPath } from "@/auth/postLoginRedirect";

export default function Unauthorized() {
  const location = useLocation();
  const auth = useAuth();
  const from = typeof location.state?.from === "string" ? location.state.from : null;
  const returnTo = from || "/";

  const triggerLogin = () => {
    if (auth?.signinRedirect) {
      rememberPostLoginPath(returnTo);
      auth.signinRedirect({ state: { returnTo } });
    }
  };

  return (
    <div className="card">
      <h2>세션이 만료되었습니다</h2>
      <p className="muted">
        인증 토큰이 만료되었거나 로그인이 필요합니다. 다시 로그인하여 서비스를 계속 이용해주세요.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
        <button type="button" className="btn primary" onClick={triggerLogin}>
          다시 로그인
        </button>
        <Link to="/" className="btn outline">
          대시보드로 이동
        </Link>
        {from && (
          <Link to={from} className="btn outline">
            이전 페이지
          </Link>
        )}
      </div>
    </div>
  );
}
