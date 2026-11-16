const TOKEN_KEY = 'slidecraft_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let extra: any = {};
    if (contentType.includes('application/json')) {
      const errJson = await res.json().catch(() => ({}));
      message = errJson.error || message;
      extra = errJson;
    } else {
      const text = await res.text().catch(() => '');
      if (text) message = text;
    }
    const error = new Error(message) as Error & { status?: number; data?: any };
    error.status = res.status;
    error.data = extra;
    throw error;
  }

  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export async function downloadPresentationFile(
  presentationId: string,
  format: 'pptx' | 'pdf' | 'txt',
  filenameBase: string
) {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/presentations/${presentationId}/export/${format}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Failed to export ${format.toUpperCase()}`);
  }

  const blob = await res.blob();
  const safeBase =
    filenameBase.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'presentation';
  const ext = format === 'txt' ? '_outline.txt' : `.${format}`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${safeBase}${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
