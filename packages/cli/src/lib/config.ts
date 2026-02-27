import fs from 'node:fs';
import path from 'node:path';
import type { ProjectConfig } from '../types.js';

const CONFIG_DIR = path.join(process.cwd(), '.lock');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function getConfig(): ProjectConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw) as ProjectConfig;
    if (config.product) {
      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: ProjectConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}
