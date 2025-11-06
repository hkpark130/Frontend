import api from "./api";

export const fetchPendingApprovals = async (params = {}) => {
  const { data } = await api.get("/api/approvals/pending", { params });
  return data;
};

export const fetchMyApprovals = async (username, params = {}) => {
  if (!username || typeof username !== "string") {
    throw new Error("username is required to fetch my approvals");
  }
  const encoded = encodeURIComponent(username.trim());
  const { data } = await api.get(`/api/my-approval-list/${encoded}`, { params });
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

export const updateApprovalComment = async (approvalId, commentId, payload) => {
  const { data } = await api.put(`/api/approvals/${approvalId}/comments/${commentId}`, payload);
  return data;
};

export const deleteApprovalComment = async (approvalId, commentId, username) => {
  const config = username ? { params: { username } } : {};
  await api.delete(`/api/approvals/${approvalId}/comments/${commentId}`, config);
};

export const fetchNotifications = async (receiver) => {
  const { data } = await api.get("/api/notifications", { params: { receiver } });
  return data;
};

export const markNotificationRead = async (notificationId) => {
  await api.post(`/api/notifications/${notificationId}/read`);
};

export const fetchDefaultApprovers = async () => {
  const { data } = await api.get("/api/approvals/default-approvers");
  return data;
};

export const cancelApproval = async (approvalId, username) => {
  const config = username ? { params: { username } } : undefined;
  const { data } = await api.delete(`/api/approval-device-cancel/${approvalId}`, config);
  return data;
};

export const updateApprovalReason = async (approvalId, payload) => {
  const { data } = await api.put(`/api/approvals/${approvalId}/reason`, payload);
  return data;
};

export const updateApprovalApplication = async (approvalId, payload) => {
  const { data } = await api.put(`/api/approvals/${approvalId}`, payload);
  return data;
};
