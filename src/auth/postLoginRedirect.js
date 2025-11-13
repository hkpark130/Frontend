const STORAGE_KEY = "post-login-return-path";

const safePath = (path) => {
  if (typeof path !== "string" || !path.startsWith("/")) {
    return "/";
  }
  return path;
};

export const rememberPostLoginPath = (path) => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, safePath(path));
  } catch {
    /* ignore storage errors */
  }
};

export const consumePostLoginPath = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  try {
    const path = window.sessionStorage.getItem(STORAGE_KEY);
    if (path) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return safePath(path);
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
};

export const getCurrentLocationPath = () => {
  if (typeof window === "undefined") {
    return "/";
  }
  const { pathname, search, hash } = window.location;
  return `${pathname || "/"}${search || ""}${hash || ""}`;
};
