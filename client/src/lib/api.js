const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || `HTTP_${res.status}`;
    const err = new Error(message);
    err.code = message;
    err.status = res.status;
    throw err;
  }
  return data;
}

