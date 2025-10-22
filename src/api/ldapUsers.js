import api from './api';

export const fetchLdapUsers = async () => {
  const { data } = await api.get('/api/ldap-users');
  return data ?? [];
};

export const addLdapUser = async (payload) => {
  const { data } = await api.post('/api/ldap-user', payload);
  return data;
};

export const deleteLdapUser = async (cn) => {
  const { data } = await api.delete(`/api/ldap-user/${encodeURIComponent(cn)}`);
  return data;
};

export const reissueLdapPassword = async (cn) => {
  const { data } = await api.get(`/api/reissue-password/${encodeURIComponent(cn)}`);
  return data;
};

export const checkLdapCnAvailable = async (cn) => {
  const { data } = await api.get(`/api/check-ldap-user-cn/${encodeURIComponent(cn)}`);
  return data;
};

export const checkLdapUidNumberAvailable = async (uidNumber) => {
  const { data } = await api.get(`/api/check-ldap-user-uidnum/${encodeURIComponent(uidNumber)}`);
  return data;
};
