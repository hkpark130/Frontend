import api from './api';

/**
 * Fetch OpenStack instance information by floating IP.
 * @param {string} floatingIp - Complete floating IP (e.g. 192.168.3.42)
 * @returns {Promise<object>} Instance details returned by the backend.
 */
export const fetchInstanceByFloatingIp = async (floatingIp) => {
  const { data } = await api.post('/api/openstack/instance-by-floating-ip', {
    floatingIp,
  });
  return data;
};
