export const API_BASE = (import.meta.env.VITE_MPESA_API_URL || "https://webazi-digital-solutions.onrender.com").replace(/\/$/, "");
const KEY = "northstar_fx_session";
export const getToken = () => typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
export const setToken = (value: string) => window.localStorage.setItem(KEY, value);
export const clearToken = () => window.localStorage.removeItem(KEY);

type RequestOptions = {
  /** Give up after this many milliseconds. Free hosting can take about a minute to wake up. */
  timeoutMs?: number;
};

/**
 * Ping the API so a sleeping host starts waking before the person needs it.
 * `no-cors` makes this a fire-and-forget request that never throws a CORS error.
 */
export function wakeServer() {
  if (typeof window === "undefined") return;
  void fetch(`${API_BASE}/health`, { mode: "no-cors", cache: "no-store" }).catch(() => undefined);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The server is taking too long to respond. It may still be starting up, so try again in a moment.");
    }
    // The browser reports blocked cross-origin requests and lost connections the same way.
    throw new Error(`Could not reach the Northstar server. Check your internet connection. If it is fine, the server may not allow this site address yet (${window.location.origin}).`);
  } finally {
    window.clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The service could not complete your request.");
  return data as T;
}
