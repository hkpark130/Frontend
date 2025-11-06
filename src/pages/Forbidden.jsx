import { Link, useLocation } from "react-router-dom";

export default function Forbidden() {
  const location = useLocation();
  const from = typeof location.state?.from === "string" ? location.state.from : null;

  return (
    <div className="card">
      <h2>접근이 거부되었습니다</h2>
      <p className="muted">
        요청한 페이지에 접근할 권한이 없습니다. 관리자 권한이 필요한 경우 시스템 관리자에게 문의하세요.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Link to="/" className="btn primary">대시보드로 이동</Link>
        {from && (
          <Link to={from} className="btn outline">이전 페이지</Link>
        )}
      </div>
    </div>
  );
}
