export const API_BASE = (import.meta.env.VITE_MPESA_API_URL || "https://webazi-digital-solutions.onrender.com").replace(/\/$/, "");
const KEY = "northstar_fx_session";
export const getToken = () => typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
export const setToken = (value: string) => window.localStorage.setItem(KEY, value);
export const clearToken = () => window.localStorage.removeItem(KEY);

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The service could not complete your request.");
  return data as T;
}
