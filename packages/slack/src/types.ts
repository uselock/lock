export interface ParsedCommand {
  subcommand:
    | 'init'
    | 'log'
    | 'products'
    | 'features'
    | 'revert'
    | 'link'
    | 'search'
    | 'describe'
    | 'recap'
    | 'digest'
    | 'import'
    | 'knowledge'
    | 'commit';
  mode: 'explicit' | 'extract' | 'polish';
  message: string;
  flags: {
    scope?: 'minor' | 'major' | 'architectural';
    ticket?: string;
    tags: string[];
    also?: string;
    product?: string;
    feature?: string;
    type?: string;
    since?: string;
    schedule?: string;
    hour?: string;
    days?: string;
  };
  args: string[]; // positional arguments like short_id for revert/link
}

export interface ThreadContext {
  messages: { userId: string; text: string; userName?: string }[];
  participants: string[];
  permalink?: string;
  snippet: string;
}
