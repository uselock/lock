export interface Credentials {
  api_url: string;
  api_key?: string;           // API key auth (self-hosted)
  access_token?: string;      // JWT auth (hosted)
  refresh_token?: string;     // token refresh (hosted)
  workspace_id?: string;      // active workspace (hosted)
  email?: string;             // user email (from browser login)
  name?: string;              // user display name (from browser login)
}

export interface ProjectConfig {
  product: string;
  feature?: string;
}
