import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from './prompts';
import { normalizeValue } from '@/lib/utils';
import type { ExtractionResult, ExtractedFieldInput } from './types';

const GROQ_INPUT_RATE = 0.00000059;
const GROQ_OUTPUT_RATE = 0.00000079;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGroqResponse(text: string, modelName: string): {
  fields: ExtractedFieldInput[];
  token_count: number;
  confidence_avg: number;
} {
  let jsonStr = text.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  if (!jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse Groq response as JSON. Raw text: ${text.substring(0, 200)}...`
    );
  }

  console.log('[PARSED_RESPONSE]', JSON.stringify(parsed, null, 2));

  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    throw new Error('Groq response missing "fields" array');
  }

  const fields: ExtractedFieldInput[] = parsed.fields.map((f: Record<string, unknown>) => {
    const isArray = Array.isArray(f.value);
    const isObject = !isArray && typeof f.value === 'object' && f.value !== null;

    if (isArray) {
      console.log('[LINE_ITEMS_RAW]', JSON.stringify(f.value));
    }

    const mappedValue = normalizeValue(f.value);
    const mappedConfidence = Number(f.confidence) || 0;

    if (isArray || isObject) {
      console.log('[STRUCTURED_VALUE_NORMALIZED]', mappedValue);
    }

    console.log('[FIELD_TRACE]', JSON.stringify({
      raw_from_groq: {
        field_key: f.field_key,
        field_label: f.field_label,
        field_type: f.field_type,
        value: f.value,
        value_type: Array.isArray(f.value) ? 'array' : typeof f.value,
        confidence: f.confidence,
        confidence_type: typeof f.confidence,
        page_reference: f.page_reference,
      },
      after_mapping: {
        value: mappedValue,
        confidence: mappedConfidence,
      },
      has_value: f.value !== undefined && f.value !== null && f.value !== '',
      has_confidence: f.confidence !== undefined && f.confidence !== null,
    }, null, 2));

    return {
      field_key: String(f.field_key),
      field_label: String(f.field_label),
      field_type: (f.field_type as ExtractedFieldInput['field_type']) ?? 'text',
      value: mappedValue,
      confidence: mappedConfidence,
      page_reference: f.page_reference ? Number(f.page_reference) : null,
      source_hint: modelName,
    };
  });

  const token_count = Number(parsed.token_count) || 0;
  const confidence_avg = Number(parsed.confidence_avg) ||
    (fields.length > 0
      ? fields.reduce((s, f) => s + f.confidence, 0) / fields.length
      : 0);

  return { fields, token_count, confidence_avg: Math.round(confidence_avg * 1000) / 1000 };
}

async function generateWithRetry(
  client: Groq,
  modelName: string,
  pdfText: string
): Promise<{ responseText: string; promptTokens: number; completionTokens: number; totalTokens: number }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[GROQ_ATTEMPT] Attempt ${attempt}/${MAX_ATTEMPTS}`);

    try {
      const result = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `--- INVOICE TEXT ---\n${pdfText}` },
        ],
      });

      const content = result.choices?.[0]?.message?.content ?? '';
      const usage = result.usage;

      console.log('[GROQ_SUCCESS]', JSON.stringify({
        attempt,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokenCount: usage?.total_tokens ?? 0,
      }));

      return {
        responseText: content,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      };
    } catch (err: any) {
      const statusCode = err?.status ?? 0;
      const errorMessage = err?.message ?? String(err);

      console.log('[GROQ_STATUS]', statusCode);
      console.error('[GROQ_ERROR_DETAIL]', JSON.stringify({
        status: statusCode,
        message: errorMessage.substring(0, 300),
        attempt,
      }));

      lastError = err instanceof Error ? err : new Error(errorMessage);

      const isRetryable = RETRYABLE_STATUSES.has(statusCode) ||
        [429, 500, 502, 503, 504].some((code) => errorMessage.startsWith(String(code)));

      if (isRetryable && attempt < MAX_ATTEMPTS) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1];
        console.log(`[GROQ_RETRY] Attempt ${attempt} failed (${statusCode}), retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error('Groq extraction failed after retries');
}

export async function groqExtract(
  documentId: string,
  pdfText: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const modelName = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  console.log("[PROVIDER] groq");
  console.log("[MODEL_USED]", modelName);

  const client = new Groq({ apiKey });

  const { responseText, promptTokens, completionTokens, totalTokens } =
    await generateWithRetry(client, modelName, pdfText);

  console.log('[GROQ_RAW_RESPONSE]', responseText);

  const cost_usd =
    promptTokens * GROQ_INPUT_RATE + completionTokens * GROQ_OUTPUT_RATE;

  const { fields, confidence_avg } = parseGroqResponse(responseText, modelName);

  return {
    document_id: documentId,
    fields,
    model_used: modelName,
    token_count: totalTokens,
    cost_usd: Math.round(cost_usd * 1_000_000_000) / 1_000_000_000,
    confidence_avg,
  };
}
