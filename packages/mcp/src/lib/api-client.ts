import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ApiResponse } from './types.js';

let _config: { apiUrl: string; apiKey: string; accessToken: string; workspaceId: string } | null = null;

function getConfig(): { apiUrl: string; apiKey: string; accessToken: string; workspaceId: string } {
  if (_config) return _config;

  const envUrl = process.env.LOCK_API_URL;
  const envKey = process.env.LOCK_API_KEY;

  // Skip file read when both env vars are present
  if (envUrl && envKey) {
    _config = { apiUrl: envUrl, apiKey: envKey, accessToken: '', workspaceId: '' };
    return _config;
  }

  let fileCreds: { api_url?: string; api_key?: string; access_token?: string; workspace_id?: string } = {};
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.lock', 'credentials'), 'utf-8');
    fileCreds = JSON.parse(raw);
  } catch {
    // File doesn't exist — fall through to defaults
  }

  _config = {
    apiUrl: envUrl ?? fileCreds.api_url ?? 'https://api.uselock.ai',
    apiKey: envKey ?? fileCreds.api_key ?? '',
    accessToken: fileCreds.access_token ?? '',
    workspaceId: fileCreds.workspace_id ?? '',
  };
  return _config;
}

function headers(): Record<string, string> {
  const { apiKey, accessToken, workspaceId } = getConfig();

  const hdrs: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    hdrs['Authorization'] = `Bearer ${accessToken}`;
  } else if (apiKey) {
    hdrs['Authorization'] = `Bearer ${apiKey}`;
  }

  if (workspaceId) {
    hdrs['X-Workspace-Id'] = workspaceId;
  }

  return hdrs;
}

function requireAuth(): void {
  const { apiKey, accessToken } = getConfig();
  if (!apiKey && !accessToken) {
    throw new Error(
      'No Lock credentials found. Run `lock login` in your terminal to authenticate, ' +
      'or set LOCK_API_URL and LOCK_API_KEY environment variables in your MCP config.',
    );
  }
}

function handleResponse<T>(response: Response, method: string, path: string): Promise<T> {
  if (response.status === 401) {
    throw new Error(
      'Lock authentication failed. Your API key or token may be expired. ' +
      'Run `lock login` to re-authenticate.',
    );
  }

  if (!response.ok) {
    return response.text().then((body) => {
      throw new Error(`API ${method} ${path} failed (${response.status}): ${body}`);
    });
  }

  return response.json().then((json: ApiResponse<T>) => {
    if (json.error) {
      throw new Error(`API error: ${json.error.code} - ${json.error.message}`);
    }
    return json.data as T;
  });
}

function connectionError(): Error {
  return new Error(
    `Cannot reach Lock API at ${getConfig().apiUrl}. ` +
    `Is the server running? If self-hosting, check your LOCK_API_URL.`,
  );
}

export async function apiGet<T>(path: string): Promise<T> {
  requireAuth();

  let response: Response;
  try {
    response = await fetch(`${getConfig().apiUrl}${path}`, {
      method: 'GET',
      headers: headers(),
    });
  } catch {
    throw connectionError();
  }

  return handleResponse<T>(response, 'GET', path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  requireAuth();

  let response: Response;
  try {
    response = await fetch(`${getConfig().apiUrl}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
  } catch {
    throw connectionError();
  }

  return handleResponse<T>(response, 'POST', path);
}
