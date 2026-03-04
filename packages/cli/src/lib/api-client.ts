import { getCredentials, saveCredentials } from './credentials.js';
import type { Credentials } from '../types.js';

class ApiError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function buildHeaders(creds: Credentials): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (creds.access_token) {
    headers['Authorization'] = `Bearer ${creds.access_token}`;
  } else if (creds.api_key) {
    headers['Authorization'] = `Bearer ${creds.api_key}`;
  }

  if (creds.workspace_id) {
    headers['X-Workspace-Id'] = creds.workspace_id;
  }

  return headers;
}

async function refreshTokens(creds: Credentials): Promise<Credentials | null> {
  if (!creds.refresh_token) return null;

  try {
    const res = await fetch(`${creds.api_url}/auth/cli/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: creds.refresh_token }),
    });

    if (!res.ok) return null;

    const json = await res.json() as { access_token: string; refresh_token: string };
    const updated: Credentials = {
      ...creds,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    };
    await saveCredentials(updated);
    return updated;
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let creds = await getCredentials();
  const url = `${creds.api_url}${path}`;

  let res = await fetch(url, {
    method,
    headers: buildHeaders(creds),
    body: body != null ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401 if we have a refresh token (one retry only)
  if (res.status === 401 && creds.refresh_token) {
    const refreshed = await refreshTokens(creds);
    if (refreshed) {
      creds = refreshed;
      res = await fetch(url, {
        method,
        headers: buildHeaders(creds),
        body: body != null ? JSON.stringify(body) : undefined,
      });
    }
  }

  const json = await res.json() as { data?: T; error?: { code: string; message: string } };

  if (!res.ok) {
    const errCode = json.error?.code ?? 'UNKNOWN_ERROR';
    const errMsg = json.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, errCode, errMsg);
  }

  return json.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}
