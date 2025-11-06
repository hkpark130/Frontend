import api from "./api";

export const lookupKeycloakUser = async (username) => {
  const trimmed = typeof username === "string" ? username.trim() : "";
  if (!trimmed) {
    return { lookupAvailable: true, exists: false, username: null, displayName: null, email: null };
  }
  const { data } = await api.get("/api/admin/keycloak-users/lookup", {
    params: { username: trimmed },
  });
  return data;
};
