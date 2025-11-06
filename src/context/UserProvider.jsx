import React, { createContext, useContext, useEffect, useMemo } from "react";
import { AuthProvider, useAuth } from "react-oidc-context";
import { userManager } from "@/auth/oidcConfig";
import { setApiAccessToken } from "@/api/api";

const UserContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);

const normalizeName = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    return normalizeName(trimmed.substring(1));
  }
  const lastSlash = trimmed.lastIndexOf("/");
  const withoutPrefix = lastSlash >= 0 ? trimmed.substring(lastSlash + 1) : trimmed;
  const withoutRolePrefix = withoutPrefix.startsWith("ROLE_") ? withoutPrefix.substring(5) : withoutPrefix;
  return withoutRolePrefix.trim();
};

const collectGroups = (profile) => {
  if (!profile) return [];
  const collected = new Set();
  const push = (candidate) => {
    const normalized = normalizeName(candidate);
    if (normalized) {
      collected.add(normalized);
    }
  };

  if (Array.isArray(profile.groups)) {
    profile.groups.forEach(push);
  }

  const realmAccess = profile.realm_access;
  if (realmAccess && Array.isArray(realmAccess.roles)) {
    realmAccess.roles.forEach(push);
  }

  const resourceAccess = profile.resource_access;
  if (resourceAccess && typeof resourceAccess === "object") {
    Object.values(resourceAccess).forEach((entry) => {
      if (entry && Array.isArray(entry.roles)) {
        entry.roles.forEach(push);
      }
    });
  }

  return Array.from(collected);
};

const UserSync = ({ children }) => {
  const auth = useAuth();

  useEffect(() => {
    // Always sync the api access token: set it when present, clear when absent
    try {
      const token = auth.user?.access_token ?? null;
      setApiAccessToken(token);
    } catch (err) {
      // defensive: ensure we don't break the app if setApiAccessToken throws
      console.warn("Failed to sync API access token", err);
      setApiAccessToken(null);
    }
  }, [auth.user?.access_token]);

  const user = auth.user ?? null;
  const isLoggedIn = auth.isAuthenticated;
  const groups = useMemo(() => collectGroups(auth.user?.profile), [auth.user?.profile]);
  const isAdmin = useMemo(
    () => groups.some((group) => group.toLowerCase() === "admin"),
    [groups],
  );
  const isLoading = auth.isLoading;

  return (
    <UserContext.Provider value={{ user, setUser: () => {}, isLoggedIn, isLoading, groups, isAdmin, auth }}>
      {children}
    </UserContext.Provider>
  );
};

const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

export const UserProvider = ({ children }) => (
  <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
    <UserSync>{children}</UserSync>
  </AuthProvider>
);