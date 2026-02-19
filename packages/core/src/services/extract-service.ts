import { extractDecision, type ExtractionResult } from '../lib/llm.js';

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
