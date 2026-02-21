import { describe, it, expect } from 'vitest';
import { formatLockList, formatLock, formatConflicts, formatSupersession } from './formatters.js';

describe('formatLockList', () => {
  it('returns "No locks found." for empty array', () => {
    const result = formatLockList([]);
    expect(result).toContain('No locks found.');
  });

  it('shows short_id, scope, and message for locks', () => {
    const result = formatLockList([
      {
        short_id: 'l-abc123',
        message: 'Use Redis for caching',
        scope: 'major',
        status: 'active',
        author: { name: 'alice' },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(result).toContain('l-abc123');
    expect(result).toContain('major');
    expect(result).toContain('Use Redis for caching');
  });
});

describe('formatLock', () => {
  it('shows full detail for a lock with all fields', () => {
    const result = formatLock({
      short_id: 'l-abc123',
      message: 'Use Redis',
      scope: 'major',
      status: 'active',
      product: { slug: 'trading', name: 'Trading' },
      feature: { slug: 'cache', name: 'Cache' },
      author: { name: 'alice', source: 'slack' },
      tags: ['infra', 'cache'],
      links: [{ link_type: 'jira', link_ref: 'TRADE-1' }],
      source_context: 'Thread about caching',
      source_ref: 'https://slack.com/thread/123',
      supersedes_id: 'uuid-old',
      supersedes: { short_id: 'l-old111' },
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(result).toContain('l-abc123');
    expect(result).toContain('Trading');
    expect(result).toContain('Cache');
    expect(result).toContain('alice');
    expect(result).toContain('#infra');
    expect(result).toContain('#cache');
    expect(result).toContain('jira');
    expect(result).toContain('TRADE-1');
    expect(result).toContain('Supersedes');
    expect(result).toContain('l-old111');
  });

  it('shows decision_type when present', () => {
    const result = formatLock({
      short_id: 'l-typ123',
      message: 'Use Redis',
      scope: 'major',
      status: 'active',
      decision_type: 'technical',
      product: { slug: 'trading', name: 'Trading' },
      feature: { slug: 'cache', name: 'Cache' },
      author: { name: 'alice', source: 'slack' },
      tags: [],
      links: [],
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(result).toContain('Type:');
    expect(result).toContain('technical');
  });

  it('handles minimal data without crashing', () => {
    const result = formatLock({
      short_id: 'l-min000',
      message: 'Minimal lock',
      scope: 'minor',
      status: 'active',
      product: {},
      feature: {},
      author: {},
      tags: [],
      links: [],
      created_at: null,
    });
    expect(result).toContain('l-min000');
    expect(result).toContain('Minimal lock');
  });
});

describe('formatConflicts', () => {
  it('shows CONFLICT and lock details', () => {
    const result = formatConflicts([
      {
        lock: { short_id: 'l-xyz789', message: 'Use Memcached' },
        relationship: 'potential_conflict',
        explanation: 'Contradicts cache strategy',
      },
    ]);
    expect(result).toContain('CONFLICT');
    expect(result).toContain('l-xyz789');
    expect(result).toContain('Contradicts cache strategy');
  });

  it('returns empty string for empty conflicts', () => {
    expect(formatConflicts([])).toBe('');
  });
});

describe('formatSupersession', () => {
  it('shows supersession info when detected', () => {
    const result = formatSupersession({
      detected: true,
      supersedes: { short_id: 'l-old111', message: 'Old decision' },
      explanation: 'Replaces old decision',
    });
    expect(result).toContain('Supersedes');
    expect(result).toContain('l-old111');
  });

  it('returns empty string when not detected', () => {
    expect(formatSupersession({ detected: false })).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatSupersession(null)).toBe('');
  });
});
