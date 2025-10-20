import React, { createContext, useContext, useEffect } from "react";
import { AuthProvider, useAuth } from "react-oidc-context";
import { userManager } from "@/auth/oidcConfig";
import { setApiAccessToken } from "@/api/api";

const UserContext = createContext();
export const useUser = () => useContext(UserContext);

const UserSync = ({ children }) => {
  const auth = useAuth();

  useEffect(() => {
    if (auth.user?.access_token) {
      setApiAccessToken(auth.user.access_token);
    }
  }, [auth.user?.access_token]);

  const user = auth.user ?? null;
  const isLoggedIn = auth.isAuthenticated;

  return (
    <UserContext.Provider value={{ user, setUser: () => {}, isLoggedIn, auth }}>
      {children}
    </UserContext.Provider>
  );
};

export const UserProvider = ({ children }) => (
  <AuthProvider userManager={userManager}>
    <UserSync>{children}</UserSync>
  </AuthProvider>
);