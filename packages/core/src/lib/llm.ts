import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface ExtractionResult {
  decision: string | null;
  scope: 'minor' | 'major' | 'architectural';
  tags: string[];
  confidence: number;
  reasoning: string;
}

export async function extractDecision(
  threadContext: string,
  userHint?: string,
  product?: string,
  feature?: string,
): Promise<ExtractionResult> {
  const mode = userHint ? 'polish' : 'extract';

  const prompt = `You are a product decision extraction assistant. Your job is to identify and articulate product decisions from team conversations.

${mode === 'extract' ? `Extract the key product decision from this thread conversation. Look for conclusions, agreements, or final directions the team settled on. If no clear decision was made, return decision as null.` : `Clean up and polish the following user-provided decision statement. Keep the meaning intact but make it crisp, clear, and imperative/declarative. Do not change the substance.

User's statement: "${userHint}"`}

Thread context:
${threadContext}

${product ? `Product: ${product}` : ''}
${feature ? `Feature: ${feature}` : ''}

Respond with JSON only:
{
  "decision": "The crisp decision statement, or null if no clear decision found",
  "scope": "minor|major|architectural — minor for small tweaks, major for significant changes to behavior/approach, architectural for system-wide or foundational decisions",
  "tags": ["1-3 relevant tags"],
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this was identified as the decision"
}`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(text);
    return {
      decision: parsed.decision ?? null,
      scope: ['minor', 'major', 'architectural'].includes(parsed.scope) ? parsed.scope : 'minor',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return { decision: null, scope: 'minor', tags: [], confidence: 0, reasoning: 'Failed to parse LLM response' };
  }
}

export interface ClassificationResult {
  relationship: 'no_relation' | 'related' | 'potential_conflict' | 'supersession';
  explanation: string;
}

export async function classifyRelationship(
  existingLock: { message: string; scope: string; context?: string | null; featureName: string },
  newLock: { message: string; scope: string; context?: string | null; featureName: string }
): Promise<ClassificationResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { relationship: 'no_relation', explanation: '' };
  }

  const prompt = `You are analyzing product decisions for conflicts.

Decision A (existing, ${existingLock.scope}): "${existingLock.message}"
  Context: ${existingLock.context || 'None'}
  Feature: ${existingLock.featureName}

Decision B (new, ${newLock.scope}): "${newLock.message}"
  Context: ${newLock.context || 'None'}
  Feature: ${newLock.featureName}

Classify the relationship as exactly one of:
- "no_relation" — these decisions are about different things
- "related" — these are about the same area but don't conflict
- "potential_conflict" — these decisions may contradict each other
- "supersession" — Decision B replaces/updates Decision A

Respond with JSON only: { "relationship": "...", "explanation": "..." }`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 256,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? '';

  try {
    return JSON.parse(text) as ClassificationResult;
  } catch {
    return { relationship: 'no_relation', explanation: '' };
  }
}
