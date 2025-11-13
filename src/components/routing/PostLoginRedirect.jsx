import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation, useNavigate } from "react-router-dom";
import { consumePostLoginPath } from "@/auth/postLoginRedirect";

export default function PostLoginRedirect() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedUserRef = useRef(null);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      redirectedUserRef.current = null;
      return;
    }

    const sessionKey = auth.user?.session_state || auth.user?.profile?.sub || "default-session";
    if (redirectedUserRef.current === sessionKey) {
      return;
    }

    let target = consumePostLoginPath();
    if (!target) {
      const stateTarget = auth.user?.state?.returnTo;
      if (typeof stateTarget === "string") {
        target = stateTarget;
      }
    }

    if (!target) {
      redirectedUserRef.current = sessionKey;
      return;
    }

    const current = `${location.pathname}${location.search}${location.hash}`;
    if (target === current) {
      redirectedUserRef.current = sessionKey;
      return;
    }

    redirectedUserRef.current = sessionKey;
    navigate(target, { replace: true });
  }, [auth.isAuthenticated, auth.user, navigate, location.pathname, location.search, location.hash]);

  return null;
}
