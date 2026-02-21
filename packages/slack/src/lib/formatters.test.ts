import { describe, it, expect } from 'vitest';
import {
  formatLockList,
  formatLockCommit,
  formatProductList,
  formatFeatureList,
  formatRecap,
  formatRecapDigest,
  formatImportCandidates,
  formatError,
  formatSuccess,
  formatExtractionPreview,
} from './formatters.js';

function blocksText(blocks: any[]): string {
  return JSON.stringify(blocks);
}

describe('formatLockList', () => {
  it('shows "No locks found" for empty array', () => {
    const blocks = formatLockList([]);
    expect(blocksText(blocks)).toContain('No locks found');
  });

  it('shows short_id and message for a single lock', () => {
    const blocks = formatLockList([
      {
        short_id: 'l-abc123',
        message: 'Use Redis',
        scope: 'minor',
        status: 'active',
        product: { slug: 'trading' },
        feature: { slug: 'cache' },
        author: { name: 'alice' },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const text = blocksText(blocks);
    expect(text).toContain('l-abc123');
    expect(text).toContain('Use Redis');
    expect(text).toContain(':small_blue_diamond:');
  });

  it('shows strikethrough for superseded lock', () => {
    const blocks = formatLockList([
      {
        short_id: 'l-abc123',
        message: 'Old decision',
        scope: 'major',
        status: 'superseded',
        product: { slug: 'p' },
        feature: { slug: 'f' },
        author: { name: 'bob' },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(blocksText(blocks)).toContain('~superseded~');
  });
});

describe('formatLockCommit', () => {
  const baseLock = {
    short_id: 'l-abc123',
    message: 'Use Redis for caching',
    scope: 'minor',
    status: 'active',
    product: { slug: 'trading', name: 'Trading' },
    feature: { slug: 'cache', name: 'Cache' },
    author: { name: 'alice', source: 'slack' },
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
  };

  it('shows short_id and scope in basic commit', () => {
    const blocks = formatLockCommit({
      lock: baseLock,
      conflicts: [],
      supersession: { detected: false },
    });
    const text = blocksText(blocks);
    expect(text).toContain('l-abc123');
    expect(text).toContain(':small_blue_diamond:');
  });

  it('shows conflict warnings when conflicts present', () => {
    const blocks = formatLockCommit({
      lock: baseLock,
      conflicts: [
        {
          lock: { short_id: 'l-xyz789', message: 'Use Memcached' },
          relationship: 'potential_conflict',
          explanation: 'Contradicting cache strategy',
        },
      ],
      supersession: { detected: false },
    });
    const text = blocksText(blocks);
    expect(text).toContain(':warning:');
    expect(text).toContain('l-xyz789');
    expect(text).toContain('Contradicting cache strategy');
  });

  it('shows supersession info when detected', () => {
    const blocks = formatLockCommit({
      lock: baseLock,
      conflicts: [],
      supersession: {
        detected: true,
        supersedes: { short_id: 'l-old111', message: 'Use Memcached' },
        explanation: 'Redis replaces Memcached decision',
      },
    });
    const text = blocksText(blocks);
    expect(text).toContain('l-old111');
    expect(text).toContain('Supersedes');
    expect(text).toContain('Redis replaces Memcached decision');
  });

  it('includes enrichment actions block', () => {
    const blocks = formatLockCommit({
      lock: baseLock,
      conflicts: [],
      supersession: { detected: false },
    });
    const enrichment = blocks.find(
      (b: any) => b.block_id && b.block_id.startsWith('enrichment_')
    );
    expect(enrichment).toBeDefined();
    expect(enrichment.type).toBe('actions');
    const changeScope = enrichment.elements.find(
      (e: any) => e.action_id === 'change_scope'
    );
    expect(changeScope).toBeDefined();
  });
});

describe('formatProductList', () => {
  it('shows "No products found" for empty array', () => {
    const blocks = formatProductList([]);
    expect(blocksText(blocks)).toContain('No products found');
  });

  it('shows name, slug, and lock_count', () => {
    const blocks = formatProductList([
      { name: 'Trading', slug: 'trading', lock_count: 5 },
    ]);
    const text = blocksText(blocks);
    expect(text).toContain('Trading');
    expect(text).toContain('trading');
    expect(text).toContain('5 lock');
  });
});

describe('formatFeatureList', () => {
  it('shows "No features found" for empty array', () => {
    const blocks = formatFeatureList([]);
    expect(blocksText(blocks)).toContain('No features found');
  });

  it('shows name, slug, and product scope', () => {
    const blocks = formatFeatureList([
      {
        name: 'Cache',
        slug: 'cache',
        product: { slug: 'trading' },
        lock_count: 3,
      },
    ]);
    const text = blocksText(blocks);
    expect(text).toContain('Cache');
    expect(text).toContain('trading/cache');
    expect(text).toContain('3 lock');
  });
});

describe('formatRecap', () => {
  it('shows "No active decisions" for empty array', () => {
    const blocks = formatRecap([], 'trading');
    expect(blocksText(blocks)).toContain('No active decisions');
  });

  it('groups locks by feature with dividers', () => {
    const locks = [
      {
        short_id: 'l-111',
        message: 'Decision A',
        scope: 'minor',
        feature: { slug: 'f1', name: 'Feature 1' },
        product: { name: 'Trading' },
        author: { name: 'alice' },
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        short_id: 'l-222',
        message: 'Decision B',
        scope: 'major',
        feature: { slug: 'f2', name: 'Feature 2' },
        product: { name: 'Trading' },
        author: { name: 'bob' },
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const blocks = formatRecap(locks, 'trading');
    const text = blocksText(blocks);
    expect(text).toContain('Feature 1');
    expect(text).toContain('Feature 2');
    const dividers = blocks.filter((b: any) => b.type === 'divider');
    expect(dividers.length).toBe(2);
  });

  it('sorts architectural before major before minor within a group', () => {
    const locks = [
      {
        short_id: 'l-m1',
        message: 'Minor thing',
        scope: 'minor',
        feature: { slug: 'f1', name: 'F1' },
        product: { name: 'P' },
        author: { name: 'a' },
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        short_id: 'l-a1',
        message: 'Arch thing',
        scope: 'architectural',
        feature: { slug: 'f1', name: 'F1' },
        product: { name: 'P' },
        author: { name: 'a' },
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        short_id: 'l-j1',
        message: 'Major thing',
        scope: 'major',
        feature: { slug: 'f1', name: 'F1' },
        product: { name: 'P' },
        author: { name: 'a' },
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const blocks = formatRecap(locks, 'p');
    // Find the lock section blocks (those containing short_ids)
    const lockBlocks = blocks.filter(
      (b: any) => b.type === 'section' && b.text?.text?.includes('l-')
    );
    const ids = lockBlocks.map((b: any) => {
      const match = b.text.text.match(/l-\w+/);
      return match?.[0];
    });
    expect(ids).toEqual(['l-a1', 'l-j1', 'l-m1']);
  });
});

describe('formatError', () => {
  it('contains code and message', () => {
    const blocks = formatError('TEST_ERR', 'Something went wrong');
    const text = blocksText(blocks);
    expect(text).toContain('TEST_ERR');
    expect(text).toContain('Something went wrong');
  });
});

describe('formatSuccess', () => {
  it('contains checkmark and message', () => {
    const blocks = formatSuccess('Done!');
    const text = blocksText(blocks);
    expect(text).toContain(':white_check_mark:');
    expect(text).toContain('Done!');
  });
});

describe('formatLockCommit decision_type', () => {
  it('shows type badge when decision_type is present', () => {
    const blocks = formatLockCommit({
      lock: {
        short_id: 'l-typ456',
        message: 'Use Redis',
        scope: 'major',
        status: 'active',
        decision_type: 'technical',
        product: { slug: 'trading', name: 'Trading' },
        feature: { slug: 'cache', name: 'Cache' },
        author: { name: 'alice', source: 'slack' },
        tags: [],
        created_at: '2026-01-01T00:00:00Z',
      },
      conflicts: [],
      supersession: { detected: false },
    });
    const text = blocksText(blocks);
    expect(text).toContain(':label: technical');
  });
});

describe('formatRecapDigest', () => {
  it('shows "No decisions" for empty recap', () => {
    const blocks = formatRecapDigest({
      period: { from: '2026-01-01T00:00:00Z', to: '2026-01-08T00:00:00Z' },
      summary: { total_decisions: 0, by_scope: {}, by_type: {}, by_product: [], reverts: 0, supersessions: 0 },
      decisions: [],
      top_contributors: [],
    });
    expect(blocksText(blocks)).toContain('No decisions');
  });

  it('shows stats and key decisions', () => {
    const blocks = formatRecapDigest({
      period: { from: '2026-01-01T00:00:00Z', to: '2026-01-08T00:00:00Z' },
      summary: {
        total_decisions: 3,
        by_scope: { major: 2, minor: 1 },
        by_type: { technical: 2, product: 1 },
        by_product: [],
        reverts: 0,
        supersessions: 1,
      },
      decisions: [
        {
          short_id: 'l-111',
          message: 'Use Redis',
          scope: 'major',
          decision_type: 'technical',
          author: { name: 'alice' },
          feature: { name: 'Cache' },
        },
      ],
      top_contributors: [{ name: 'alice', count: 3 }],
    }, 'trading');
    const text = blocksText(blocks);
    expect(text).toContain('Recap');
    expect(text).toContain('3 decision');
    expect(text).toContain('alice');
    expect(text).toContain('Use Redis');
  });
});

describe('formatImportCandidates', () => {
  it('shows candidates with commit/skip buttons', () => {
    const blocks = formatImportCandidates(
      [
        {
          decision: 'Use Redis for caching',
          scope: 'major',
          confidence: 0.85,
          reasoning: 'Team agreed on Redis',
          tags: ['cache'],
        },
      ],
      { product: 'trading', feature: 'cache' },
    );
    const text = blocksText(blocks);
    expect(text).toContain('Found 1 potential decision');
    expect(text).toContain('Use Redis for caching');
    expect(text).toContain('85%');
    expect(text).toContain('import_commit');
    expect(text).toContain('import_skip');
  });
});

describe('formatExtractionPreview', () => {
  const baseExtraction = {
    decision: 'Use Redis for caching',
    scope: 'minor',
    confidence: 0.85,
    tags: ['cache'],
  };
  const metadata = {
    product: 'trading',
    feature: 'cache',
    author: { name: 'alice' },
    source: { type: 'slack' },
  };

  it('shows decision text, confidence, and action buttons', () => {
    const blocks = formatExtractionPreview(baseExtraction, metadata);
    const text = blocksText(blocks);
    expect(text).toContain('Use Redis for caching');
    expect(text).toContain('85%');
    // Check for Commit, Edit, Cancel buttons
    const actionsBlock = blocks.find((b: any) => b.block_id === 'extraction_actions');
    expect(actionsBlock).toBeDefined();
    const actionIds = actionsBlock.elements.map((e: any) => e.action_id);
    expect(actionIds).toContain('confirm_commit');
    expect(actionIds).toContain('edit_decision');
    expect(actionIds).toContain('cancel_extract');
  });

  it('shows reasoning text when present', () => {
    const blocks = formatExtractionPreview(
      { ...baseExtraction, reasoning: 'Thread discussed caching strategy' },
      metadata
    );
    const text = blocksText(blocks);
    expect(text).toContain('Thread discussed caching strategy');
  });
});
