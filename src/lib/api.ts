export const API_BASE = (import.meta.env.VITE_MPESA_API_URL || "https://webazi-digital-solutions.onrender.com").replace(/\/$/, "");
const KEY = "northstar_fx_session";
export const getToken = () => typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
export const setToken = (value: string) => window.localStorage.setItem(KEY, value);
export const clearToken = () => window.localStorage.removeItem(KEY);
