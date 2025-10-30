import api from "./api";

export const fetchNotifications = async (receiver) => {
  if (!receiver) return [];
  const { data } = await api.get("/api/notifications", { params: { receiver } });
  return data;
};

export const markNotificationAsRead = async (notificationId) => {
  if (!notificationId) return;
  await api.post(`/api/notifications/${notificationId}/read`);
};

export const deleteNotification = async (notificationId, receiver) => {
  if (!notificationId) return;
  const config = receiver ? { params: { receiver } } : {};
  await api.delete(`/api/notifications/${notificationId}`, config);
};
