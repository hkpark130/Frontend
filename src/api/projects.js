import api from './api';

export const fetchProjects = async () => {
  const { data } = await api.get('/api/projects');
  return data;
};

export const getProjectByCode = async (code) => {
  const { data } = await api.get(`/api/projects/code/${encodeURIComponent(code)}`);
  return data;
};

export const createProject = async ({ name, code }) => {
  const { data } = await api.post('/api/projects', { name, code });
  return data;
};

export const updateProject = async ({ id, name, code }) => {
  const { data } = await api.put(`/api/projects/${id}`, { name, code });
  return data;
};

export const deleteProject = async (id) => {
  await api.delete(`/api/projects/${id}`);
  return true;
};
