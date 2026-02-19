import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { input, password } from '@inquirer/prompts';
import type { Credentials } from '../types.js';

const CREDENTIALS_DIR = path.join(os.homedir(), '.lock');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials');

export async function getCredentials(): Promise<Credentials> {
  // Try to read existing credentials
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const creds = JSON.parse(raw) as Credentials;
    if (creds.api_url && creds.api_key) {
      return creds;
    }
  } catch {
    // Credentials file doesn't exist or is invalid — prompt the user
  }

  console.log('No credentials found. Let\'s set up your Lock CLI.\n');

  const api_url = await input({
    message: 'Lock API URL:',
    default: 'http://localhost:3000',
  });

  const api_key = await password({
    message: 'API key:',
    mask: '*',
  });

  const creds: Credentials = { api_url, api_key };
  await saveCredentials(creds);

  console.log('\nCredentials saved to ~/.lock/credentials\n');
  return creds;
}

export function credentialsExist(): boolean {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const creds = JSON.parse(raw);
    return Boolean(creds.api_url && creds.api_key);
  } catch {
    return false;
  }
}

export function deleteCredentials(): void {
  try {
    fs.unlinkSync(CREDENTIALS_PATH);
  } catch {
    // File doesn't exist — no-op
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2) + '\n', {
    mode: 0o600,
  });
}
