type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const json = (await res.json()) as ApiEnvelope<T>;

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'İstek başarısız');
  }

  return json.data as T;
}

export const api = {
  get: <T,>(path: string, token?: string | null) =>
    request<T>(path, { method: 'GET' }, token),

  post: <T,>(path: string, body?: unknown, token?: string | null) =>
    request<T>(
      path,
      {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      token,
    ),
};
