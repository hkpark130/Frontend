import api from './api';

export const fetchDepartments = async () => {
  const { data } = await api.get('/api/departments'); // MetaController provides list
  return data;
};

export const createDepartment = async ({ name }) => {
  const { data } = await api.post('/api/departments', { name });
  return data;
};

export const updateDepartment = async ({ id, name }) => {
  const { data } = await api.put(`/api/departments/${id}`, { name });
  return data;
};

export const deleteDepartment = async (id) => {
  await api.delete(`/api/departments/${id}`);
  return true;
};
