import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/context/UserProvider";

export default function AdminRoute({ children }) {
  const { isLoading, isLoggedIn, isAdmin } = useUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="card">
        <p>사용자 정보를 확인하는 중입니다...</p>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }

  return children;
}
