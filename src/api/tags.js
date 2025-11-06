import api from "./api";

export const fetchTags = async () => {
  const { data } = await api.get("/api/tags");
  return data;
};
