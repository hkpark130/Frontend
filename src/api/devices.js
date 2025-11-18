import api from "./api";

// 장비 일괄 등록 (bulk)
export const bulkRegisterDevices = async (deviceList) => {
  const { data } = await api.post('/api/devices/bulk', deviceList);
  return data;
};

export const fetchAvailableDevices = async (params = {}) => {
  const { data } = await api.get("/api/available-devicelist", { params });
  return data;
};

export const fetchAvailableDeviceCounts = async () => {
  const { data } = await api.get("/api/available-devices/counts");
  return data;
};

export const fetchAdminDevices = async (params = {}) => {
  const { data } = await api.get("/api/admin/devices", { params });
  return data;
};

export const fetchDisposedDevices = async (params = {}) => {
  const { data } = await api.get("/api/admin/devices/disposed", { params });
  return data;
};

export const fetchMyDevices = async (params = {}) => {
  const { data } = await api.get("/api/my-devices", {
    params,
  });
  return data;
};

export const disposeDeviceByAdmin = async (deviceId, payload = {}) => {
  const { data } = await api.post(`/api/admin/devices/${deviceId}/dispose`, payload);
  return data;
};

export const recoverDeviceByAdmin = async (deviceId, payload = {}) => {
  const { data } = await api.post(`/api/admin/devices/${deviceId}/recover`, payload);
  return data;
};

export const forceReturnDeviceByAdmin = async (deviceId, payload = {}) => {
  const { data } = await api.post(`/api/admin/devices/${deviceId}/force-return`, payload);
  return data;
};

export const fetchDeviceDetail = async (deviceId) => {
  const { data } = await api.get(`/api/device/${deviceId}`);
  return data;
};

export const fetchDevicesByIds = async (ids = []) => {
  const params = new URLSearchParams();
  ids
    .map((id) => (id != null && typeof id.toString === "function" ? id.toString() : String(id ?? "")))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .forEach((value) => params.append("ids", value));

  if ([...params.keys()].length === 0) {
    return [];
  }

  const { data } = await api.get("/api/devices/lookup", { params });
  return data;
};

export const updateDevice = async (deviceId, payload) => {
  const { data } = await api.put(`/api/device/${deviceId}`, payload);
  return data;
};

export const updateMyDeviceMemo = async (deviceId, payload) => {
  const { data } = await api.patch(`/api/my-devices/${deviceId}`, payload);
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

