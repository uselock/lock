import { extractDecision, extractDecisionsFromChunk, type ExtractionResult, type BatchDecision } from '../lib/llm.js';

export interface ExtractRequest {
  thread_context: string;
  user_hint?: string;
  product?: string;
  feature?: string;
}

export async function extractFromThread(req: ExtractRequest): Promise<ExtractionResult> {
  return extractDecision(
    req.thread_context,
    req.user_hint,
    req.product,
    req.feature,
  );
}

export interface BatchExtractRequest {
  messages: { text: string; author: string; timestamp: string }[];
  product?: string;
  feature?: string;
}

export interface ExtractedCandidate extends BatchDecision {
  source_messages?: string[];
}

export async function extractBatchDecisions(req: BatchExtractRequest): Promise<{ candidates: ExtractedCandidate[] }> {
  const { messages, product, feature } = req;

  // Chunk messages into groups of 15
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 15) {
    chunks.push(messages.slice(i, i + 15));
  }

  const allCandidates: ExtractedCandidate[] = [];

  for (const chunk of chunks) {
    const chunkContext = chunk
      .map((m) => `${m.author} (${m.timestamp}): ${m.text}`)
      .join('\n');

    const decisions = await extractDecisionsFromChunk(chunkContext, product, feature);

    for (const decision of decisions) {
      if (decision.confidence >= 0.6) {
        allCandidates.push(decision);
      }
    }
  }

  return { candidates: allCandidates };
}
