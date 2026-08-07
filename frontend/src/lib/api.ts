import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8001/api/v1";
export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post("/auth/register", data),

  login: async (data: { email: string; password: string }) => {
    const formData = new URLSearchParams();
    formData.append("username", data.email);
    formData.append("password", data.password);

    return api.post("/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  },
};

export const transactionsApi = {
  list: (params?: { skip?: number; limit?: number; type?: string; month?: number; year?: number; category_id?: number; }) =>
    api.get("/transactions", { params }),
  create: (data: { amount: number; type: string; description: string; note?: string; category_id?: number; date: string; }) =>
    api.post("/transactions", data),
  update: (id: number, data: object) => api.patch(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

export const analyticsApi = {
  summary: (months = 6) => api.get("/analytics/summary", { params: { months } }),
  forecast: (days = 30) => api.get("/analytics/forecast", { params: { days } }),
  anomalies: () => api.get("/analytics/anomalies"),
};

export const budgetsApi = {
  list: (month?: number, year?: number) => api.get("/budgets", { params: { month, year } }),
  upsert: (data: { amount: number; month: number; year: number; category_id?: number }) =>
    api.post("/budgets", data),
};

export const fixedExpensesApi = {
  list: () => api.get("/fixed-expenses"),
  create: (data: { name: string; amount: number; frequency: string; entry_type?: string; category: string; emoji: string; }) =>
    api.post("/fixed-expenses", data),
  update: (id: number, data: object) => api.patch(`/fixed-expenses/${id}`, data),
  delete: (id: number) => api.delete(`/fixed-expenses/${id}`),
  applyMonthly: () => api.post("/fixed-expenses/apply-monthly"),
  applyStatus: () => api.get("/fixed-expenses/apply-monthly/status"),
};

export const chatApi = {
  send: (message: string) => api.post("/chat", { message }),
  history: (limit = 20) => api.get("/chat/history", { params: { limit } }),
  clearHistory: () => api.delete("/chat/history"),
};

export const fixedIncomesApi = {
  list: () => api.get("/fixed-incomes"),
  create: (data: { name: string; amount: number; frequency: string; category: string; emoji: string; }) =>
    api.post("/fixed-incomes", data),
  update: (id: number, data: object) => api.patch(`/fixed-incomes/${id}`, data),
  delete: (id: number) => api.delete(`/fixed-incomes/${id}`),
};