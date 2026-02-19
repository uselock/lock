import { describe, it, expect } from 'vitest';
import { generateShortId } from './id.js';

describe('generateShortId', () => {
  it('starts with l-', () => {
    const id = generateShortId();
    expect(id.startsWith('l-')).toBe(true);
  });

  it('is exactly 8 characters', () => {
    const id = generateShortId();
    expect(id.length).toBe(8);
  });

  it('hex portion is valid lowercase hex', () => {
    const id = generateShortId();
    const hex = id.slice(2);
    expect(hex).toMatch(/^[0-9a-f]{6}$/);
  });

  it('generates unique IDs across 100 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    expect(ids.size).toBe(100);
  });
});
