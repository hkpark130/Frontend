import api from './api';

export const fetchCategories = async () => {
  const { data } = await api.get('/api/categories');
  return Array.isArray(data) ? data : [];
};

export const createCategory = async ({ name, file }) => {
  const formData = new FormData();
  formData.append('name', name);
  if (file) formData.append('image', file);
  const { data } = await api.post('/api/categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
