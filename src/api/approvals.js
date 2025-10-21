import api from "./api";

export const fetchPendingApprovals = async () => {
  const { data } = await api.get("/api/approvals/pending");
  return data;
};

export const approveApproval = async (approvalId, payload) => {
  const { data } = await api.post(`/api/approvals/${approvalId}/approve`, payload);
  return data;
};

export const rejectApproval = async (approvalId, payload) => {
  const { data } = await api.post(`/api/approvals/${approvalId}/reject`, payload);
  return data;
};

export const fetchApprovalDetail = async (approvalId) => {
  const { data } = await api.get(`/api/approvals/${approvalId}`);
  return data;
};

export const updateApprovers = async (approvalId, payload) => {
  const { data } = await api.put(`/api/approvals/${approvalId}/approvers`, payload);
  return data;
};

export const fetchApprovalComments = async (approvalId) => {
  const { data } = await api.get(`/api/approvals/${approvalId}/comments`);
  return data;
};

export const addApprovalComment = async (approvalId, payload) => {
  const { data } = await api.post(`/api/approvals/${approvalId}/comments`, payload);
  return data;
};

export const fetchNotifications = async (receiver) => {
  const { data } = await api.get("/api/notifications", { params: { receiver } });
  return data;
};

export const markNotificationRead = async (notificationId) => {
  await api.post(`/api/notifications/${notificationId}/read`);
};
