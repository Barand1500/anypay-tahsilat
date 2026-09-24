type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

/** Statik yayın / API yok — yanıt JSON değil */
export class ApiUnavailableError extends Error {
  constructor(message = 'API kullanılamıyor') {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiUnavailableError();
  }

  const text = await res.text();
  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    // SPA / nginx HTML döndü — gerçek API yok
    throw new ApiUnavailableError();
  }

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

  patch: <T,>(path: string, body?: unknown, token?: string | null) =>
    request<T>(
      path,
      {
        method: 'PATCH',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      token,
    ),

  delete: <T,>(path: string, token?: string | null, body?: unknown) =>
    request<T>(
      path,
      {
        method: 'DELETE',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      token,
    ),
};