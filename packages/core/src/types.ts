export type DecisionType = 'product' | 'technical' | 'business' | 'design' | 'process';
export const VALID_DECISION_TYPES: DecisionType[] = ['product', 'technical', 'business', 'design', 'process'];

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

export const DEFAULT_FEATURE = 'main';

export interface CreateLockRequest {
  message: string;
  product: string;
  feature?: string;
  scope?: 'minor' | 'major' | 'architectural';
  tags?: string[];
  decision_type?: DecisionType;
  author: LockAuthor;
  source: LockSource;
  links?: LockLink[];
}

export interface RevertLockRequest {
  message: string;
  author: LockAuthor;
}

export interface AddLinkRequest {
  link_type: string;
  link_ref: string;
}

export interface SearchLocksRequest {
  query: string;
  product?: string;
  feature?: string;
}

export interface ListLocksQuery {
  product?: string;
  feature?: string;
  scope?: string;
  status?: string;
  author?: string;
  tags?: string[];
  decision_type?: string;
  limit?: number;
  offset?: number;
}

export interface ConflictResult {
  lock: {
    short_id: string;
    message: string;
    scope: string;
    feature: { slug: string; name: string };
    created_at: Date;
  };
  relationship: 'potential_conflict' | 'related';
  explanation: string;
}

export interface SupersessionResult {
  detected: boolean;
  supersedes?: {
    short_id: string;
    message: string;
  };
  explanation?: string;
}

export type KnowledgeFacet = 'summary' | 'principles' | 'tensions' | 'trajectory';
export const KNOWLEDGE_FACETS: KnowledgeFacet[] = ['summary', 'principles', 'tensions', 'trajectory'];

export interface KnowledgeEntry {
  facet: KnowledgeFacet;
  content: string;
  version: number;
  lock_count_at_generation: number;
  updated_at: string;
}

export interface KnowledgeResponse {
  product: { slug: string; name: string };
  feature?: { slug: string; name: string };
  facets: KnowledgeEntry[];
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
