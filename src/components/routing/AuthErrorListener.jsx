import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_AUTH_ERROR_EVENT } from "@/api/api";
import { rememberPostLoginPath } from "@/auth/postLoginRedirect";

export default function AuthErrorListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handler = (event) => {
      const status = event?.detail?.status;
      if (status === 401 || status === 403) {
        const fromPath = `${location.pathname}${location.search}${location.hash}`;
        rememberPostLoginPath(fromPath);
        const target = status === 401 ? "/401" : "/403";
        navigate(target, { replace: true, state: { from: fromPath } });
      }
    };

    window.addEventListener(API_AUTH_ERROR_EVENT, handler);
    return () => window.removeEventListener(API_AUTH_ERROR_EVENT, handler);
  }, [navigate, location.pathname, location.search, location.hash]);

  return null;
}
