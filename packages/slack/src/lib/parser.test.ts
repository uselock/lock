import { describe, it, expect } from 'vitest';
import { parseCommand } from './parser.js';

describe('parseCommand', () => {
  // --- Subcommand detection ---

  it('strips bot mention and detects subcommand', () => {
    const result = parseCommand('<@U123> log');
    expect(result.subcommand).toBe('log');
  });

  it('treats unknown first word as commit message', () => {
    const result = parseCommand('<@U123> Use Redis');
    expect(result.subcommand).toBe('commit');
    expect(result.message).toBe('Use Redis');
  });

  it('parses init with product and feature flags', () => {
    const result = parseCommand('<@U123> init --product trading --feature margin');
    expect(result.subcommand).toBe('init');
    expect(result.flags.product).toBe('trading');
    expect(result.flags.feature).toBe('margin');
  });

  // --- Flags ---

  it('parses --scope major', () => {
    const result = parseCommand('<@U123> Use Redis --scope major');
    expect(result.flags.scope).toBe('major');
  });

  it('ignores invalid scope value', () => {
    const result = parseCommand('<@U123> Use Redis --scope huge');
    expect(result.flags.scope).toBeUndefined();
  });

  it('parses --ticket flag', () => {
    const result = parseCommand('<@U123> Use Redis --ticket TRADE-1');
    expect(result.flags.ticket).toBe('TRADE-1');
  });

  it('parses multiple --tag flags', () => {
    const result = parseCommand('<@U123> Use Redis --tag cache --tag perf');
    expect(result.flags.tags).toEqual(['cache', 'perf']);
  });

  it('parses --product and --feature on log', () => {
    const result = parseCommand('<@U123> log --product trading --feature margin');
    expect(result.subcommand).toBe('log');
    expect(result.flags.product).toBe('trading');
    expect(result.flags.feature).toBe('margin');
  });

  it('parses --type flag', () => {
    const result = parseCommand('<@U123> Use Redis --type technical');
    expect(result.flags.type).toBe('technical');
    expect(result.message).toBe('Use Redis');
  });

  it('parses --since flag on recap', () => {
    const result = parseCommand('<@U123> recap --since 7d');
    expect(result.subcommand).toBe('recap');
    expect(result.flags.since).toBe('7d');
  });

  it('parses --days flag on import', () => {
    const result = parseCommand('<@U123> import --days 14');
    expect(result.subcommand).toBe('import');
    expect(result.flags.days).toBe('14');
  });

  it('parses digest with --schedule and --hour', () => {
    const result = parseCommand('<@U123> digest --schedule weekly --hour 9');
    expect(result.subcommand).toBe('digest');
    expect(result.flags.schedule).toBe('weekly');
    expect(result.flags.hour).toBe('9');
  });

  it('handles quoted message', () => {
    const result = parseCommand('<@U123> "Use Redis for caching"');
    expect(result.subcommand).toBe('commit');
    expect(result.message).toBe('Use Redis for caching');
  });

  // --- Positional args (revert, link) ---

  it('parses revert with short_id and reason', () => {
    const result = parseCommand('<@U123> revert l-abc123 "bad decision"');
    expect(result.subcommand).toBe('revert');
    expect(result.args).toEqual(['l-abc123']);
    expect(result.message).toBe('bad decision');
  });

  it('parses link with short_id and reference', () => {
    const result = parseCommand('<@U123> link l-abc123 TRADE-1');
    expect(result.subcommand).toBe('link');
    expect(result.args).toEqual(['l-abc123', 'TRADE-1']);
  });

  // --- Mode detection ---

  it('extract mode: bare mention', () => {
    const result = parseCommand('<@U123>');
    expect(result.subcommand).toBe('commit');
    expect(result.mode).toBe('extract');
    expect(result.message).toBe('');
  });

  it('extract mode: "this"', () => {
    const result = parseCommand('<@U123> this');
    expect(result.mode).toBe('extract');
  });

  it('extract mode: "that"', () => {
    const result = parseCommand('<@U123> that');
    expect(result.mode).toBe('extract');
  });

  it('extract mode: "it"', () => {
    const result = parseCommand('<@U123> it');
    expect(result.mode).toBe('extract');
  });

  it('polish mode: "the fact that ..."', () => {
    const result = parseCommand('<@U123> the fact that we use Redis');
    expect(result.mode).toBe('polish');
    expect(result.message).toBe('we use Redis');
  });

  it('polish mode: "the decision that ..."', () => {
    const result = parseCommand('<@U123> the decision that X');
    expect(result.mode).toBe('polish');
    expect(result.message).toBe('X');
  });

  it('explicit mode: normal message', () => {
    const result = parseCommand('<@U123> Use Redis');
    expect(result.mode).toBe('explicit');
  });

  // --- Other subcommands ---

  it('parses recap with --product', () => {
    const result = parseCommand('<@U123> recap --product trading');
    expect(result.subcommand).toBe('recap');
    expect(result.flags.product).toBe('trading');
  });

  it('parses describe with --product and message', () => {
    const result = parseCommand('<@U123> describe --product trading "A trading platform"');
    expect(result.subcommand).toBe('describe');
    expect(result.message).toBe('A trading platform');
  });

  // --- Flag extraction from message ---

  it('extracts flags mixed with message words', () => {
    const result = parseCommand('<@U123> Use Redis --scope major for caching');
    expect(result.message).toBe('Use Redis for caching');
    expect(result.flags.scope).toBe('major');
  });
});
