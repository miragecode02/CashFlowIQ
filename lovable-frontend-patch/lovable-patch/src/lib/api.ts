import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
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

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactionsApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    type?: string;
    month?: number;
    year?: number;
    category_id?: number;
  }) => api.get("/transactions", { params }),
  create: (data: {
    amount: number;
    type: string;
    description: string;
    note?: string;
    category_id?: number;
    date: string;
  }) => api.post("/transactions", data),
  update: (id: number, data: object) => api.patch(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  summary: (months = 6) => api.get("/analytics/summary", { params: { months } }),
  forecast: (days = 30) => api.get("/analytics/forecast", { params: { days } }),
  anomalies: () => api.get("/analytics/anomalies"),
};

// ── Budgets ───────────────────────────────────────────────────────────────────
export const budgetsApi = {
  list: (month?: number, year?: number) =>
    api.get("/budgets", { params: { month, year } }),
  upsert: (data: {
    amount: number;
    month: number;
    year: number;
    category_id?: number;
  }) => api.post("/budgets", data),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  send: (message: string) => api.post("/chat", { message }),
  history: (limit = 20) => api.get("/chat/history", { params: { limit } }),
  clearHistory: () => api.delete("/chat/history"),
};
