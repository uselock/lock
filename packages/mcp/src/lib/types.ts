export interface LockAuthor {
  type: 'human' | 'agent';
  id: string;
  name: string;
  source: 'slack' | 'cli' | 'mcp' | 'api';
}

export interface LockSource {
  type: 'slack' | 'cli' | 'agent_session' | 'api';
  ref?: string;
  context?: string;
  participants?: string[];
}

export interface LockLink {
  type: 'jira' | 'figma' | 'github' | 'linear' | 'notion' | 'other';
  ref: string;
}

export interface Lock {
  id: string;
  short_id: string;
  message: string;
  product: { slug: string; name: string };
  feature: { slug: string; name: string };
  author: LockAuthor;
  scope: 'minor' | 'major' | 'architectural';
  status: 'active' | 'superseded' | 'reverted' | 'proposed' | 'auto';
  tags: string[];
  decision_type?: string;
  created_at: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description?: string;
  decision_count?: number;
  created_at: string;
}

export interface Feature {
  id: string;
  slug: string;
  name: string;
  description?: string;
  product_slug: string;
  created_at: string;
}

export interface ConflictResult {
  lock: {
    short_id: string;
    message: string;
    scope: string;
    feature: { slug: string; name: string };
    created_at: string;
  };
  relationship: 'potential_conflict' | 'related';
  explanation: string;
}

export interface CommitResponse {
  lock: Lock;
  conflicts: ConflictResult[];
  supersession?: {
    detected: boolean;
    supersedes?: {
      short_id: string;
      message: string;
    };
    explanation?: string;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
