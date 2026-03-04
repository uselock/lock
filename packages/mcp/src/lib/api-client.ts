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
    apiUrl: envUrl ?? fileCreds.api_url ?? 'https://api.uselock.dev',
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

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${getConfig().apiUrl}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: headers(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API GET ${path} failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.error) {
    throw new Error(`API error: ${json.error.code} - ${json.error.message}`);
  }

  return json.data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${getConfig().apiUrl}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API POST ${path} failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.error) {
    throw new Error(`API error: ${json.error.code} - ${json.error.message}`);
  }

  return json.data as T;
}
