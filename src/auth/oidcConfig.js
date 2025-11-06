import { UserManager, WebStorageStateStore, Log } from 'oidc-client-ts';

export const KEYCLOAK_URL = 'https://keycloak.direa.synology.me';
export const REALM = 'sso';
export const CLIENT_ID = 'backoffice-web';
const AUTHORITY = `${KEYCLOAK_URL}/realms/${REALM}`;

export const OIDC_STORAGE_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;

export const userManager = new UserManager({
  authority: AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}${window.location.pathname}`,
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  monitorSession: true,
  automaticSilentRenew: true,
});
