import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

import type { DecisionType } from '../types.js';
import { VALID_DECISION_TYPES } from '../types.js';

// --- Provider abstraction ---

type LLMProvider = 'anthropic' | 'openai';

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getProvider(): LLMProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

export function hasLLM(): boolean {
  return getProvider() !== null;
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Strip markdown code fences from LLM response (Claude often wraps JSON in ```json ... ```).
 */
function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

/**
 * Unified chat completion that routes to the available provider.
 * Returns the raw text response (JSON-ready).
 */
async function chatComplete(prompt: string, maxTokens: number): Promise<string> {
  const provider = getProvider();
  if (!provider) return '';

  if (provider === 'anthropic') {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '';
    return stripCodeFences(text);
  }

  // OpenAI
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content ?? '';
}

// --- Exported LLM functions ---

export interface ExtractionResult {
  decision: string | null;
  scope: 'minor' | 'major' | 'architectural';
  tags: string[];
  decision_type?: string;
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
  "decision_type": "product|technical|business|design|process — product for user-facing features/behavior, technical for engineering/infra, business for pricing/strategy/metrics, design for UI/UX, process for team workflow/tooling",
  "tags": ["1-3 relevant tags"],
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this was identified as the decision"
}`;

  const text = await chatComplete(prompt, 512);

  try {
    const parsed = JSON.parse(text);
    return {
      decision: parsed.decision ?? null,
      scope: ['minor', 'major', 'architectural'].includes(parsed.scope) ? parsed.scope : 'minor',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      decision_type: VALID_DECISION_TYPES.includes(parsed.decision_type) ? parsed.decision_type : undefined,
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
  if (!hasLLM()) {
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

  const text = await chatComplete(prompt, 256);

  try {
    return JSON.parse(text) as ClassificationResult;
  } catch {
    return { relationship: 'no_relation', explanation: '' };
  }
}

export interface TypeInferenceResult {
  decision_type: DecisionType;
  confidence: number;
}

export async function inferDecisionType(
  message: string,
  context?: string | null,
  product?: string,
  feature?: string,
): Promise<TypeInferenceResult> {
  if (!hasLLM()) {
    return { decision_type: 'product', confidence: 0 };
  }

  const prompt = `Classify this product decision into exactly one type.

Decision: "${message}"
${context ? `Context: ${context}` : ''}
${product ? `Product: ${product}` : ''}
${feature ? `Feature: ${feature}` : ''}

Types:
- "product" — user-facing features, behavior, requirements, UX flows
- "technical" — engineering, infrastructure, architecture, tooling, performance
- "business" — pricing, strategy, metrics, KPIs, partnerships
- "design" — UI/UX, visual design, branding, layout
- "process" — team workflow, methodology, communication, documentation

Respond with JSON only: { "decision_type": "...", "confidence": 0.0-1.0 }`;

  try {
    const text = await chatComplete(prompt, 128);
    const parsed = JSON.parse(text);
    const dt = VALID_DECISION_TYPES.includes(parsed.decision_type) ? parsed.decision_type : 'product';
    return {
      decision_type: dt,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch {
    return { decision_type: 'product', confidence: 0 };
  }
}

export interface BatchDecision {
  decision: string;
  scope: 'minor' | 'major' | 'architectural';
  decision_type?: string;
  tags: string[];
  confidence: number;
  reasoning: string;
}

export async function extractDecisionsFromChunk(
  chunkContext: string,
  product?: string,
  feature?: string,
): Promise<BatchDecision[]> {
  if (!hasLLM()) {
    return [];
  }

  const prompt = `You are a product decision extraction assistant. Analyze this conversation chunk and find ALL product decisions — agreements, choices, constraints, or direction changes.

Do NOT include: questions, opinions without agreement, status updates, or general discussion.

Conversation:
${chunkContext}

${product ? `Product: ${product}` : ''}
${feature ? `Feature: ${feature}` : ''}

Respond with JSON only:
{
  "decisions": [
    {
      "decision": "The crisp decision statement",
      "scope": "minor|major|architectural",
      "decision_type": "product|technical|business|design|process",
      "tags": ["1-3 relevant tags"],
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation"
    }
  ]
}

If no decisions found, return { "decisions": [] }.`;

  try {
    const text = await chatComplete(prompt, 2048);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.decisions) ? parsed.decisions : [];
  } catch {
    return [];
  }
}
