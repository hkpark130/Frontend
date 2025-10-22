// 장비 일괄 등록 (bulk)
export const bulkRegisterDevices = async (deviceList) => {
  const { data } = await api.post('/api/devices/bulk', deviceList);
  return data;
};
import api from "./api";

export const fetchAvailableDevices = async () => {
  const { data } = await api.get("/api/available-devicelist");
  return data;
};

export const fetchDeviceDetail = async (deviceId) => {
  const { data } = await api.get(`/api/device/${deviceId}`);
  return data;
};

export const updateDevice = async (deviceId, payload) => {
  const { data } = await api.put(`/api/device/${deviceId}`, payload);
  return data;
};

export const submitDeviceApplication = async (payload) => {
  const { data } = await api.post("/api/device-application", payload);
  return data;
};

export const fetchCategories = async () => {
  const { data } = await api.get("/api/categories");
  return data;
};

export const fetchDepartments = async () => {
  const { data } = await api.get("/api/departments");
  return data;
};

export const fetchProjects = async () => {
  const { data } = await api.get("/api/projects");
  return data;
};
