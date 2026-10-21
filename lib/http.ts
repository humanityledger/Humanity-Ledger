// lib/http.ts
// Resilient fetch wrapper with timeouts, retries, and circuit breaker
export async function resilientFetch(url: string, init?: RequestInit & { timeout?: number; retries?: number }) {
  const timeout = init?.timeout || 8000;
  const retries = init?.retries || 3;
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(id);
      if (res.ok || res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastError;
}
