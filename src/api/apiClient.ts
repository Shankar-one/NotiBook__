export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed with status ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (error: any) {
    // If running in client-only preview or endpoint unavailable, log and rethrow
    console.warn(`[API] request to ${endpoint} failed:`, error.message);
    throw error;
  }
}
