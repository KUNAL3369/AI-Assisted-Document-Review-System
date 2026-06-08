import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from './prompts';
import type { ExtractionResult, ExtractedFieldInput } from './types';

const GEMINI_INPUT_RATE = 0.000000075;
const GEMINI_OUTPUT_RATE = 0.000000300;

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiResponse(text: string, modelName: string): {
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
      `Failed to parse Gemini response as JSON. Raw text: ${text.substring(0, 200)}...`
    );
  }

  console.log('[PARSED_RESPONSE]', JSON.stringify(parsed, null, 2));

  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    throw new Error('Gemini response missing "fields" array');
  }

  const fields: ExtractedFieldInput[] = parsed.fields.map((f: Record<string, unknown>) => {
    const mappedValue = String(f.value ?? '');
    const mappedConfidence = Number(f.confidence) || 0;

    console.log('[FIELD_TRACE]', JSON.stringify({
      raw_from_gemini: {
        field_key: f.field_key,
        field_label: f.field_label,
        field_type: f.field_type,
        value: f.value,
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
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  promptText: string,
  pdfText: string
): Promise<{ responseText: string; promptTokens: number; completionTokens: number; totalTokens: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent([
        { text: promptText },
        { text: `--- INVOICE TEXT ---\n${pdfText}` },
      ]);

      const response = result.response;
      const usage = response.usageMetadata;

      return {
        responseText: response.text(),
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      };
    } catch (err: any) {
      console.error("========== GEMINI ERROR ==========");
      console.error("ERROR:", err);
      console.error("MESSAGE:", err?.message);
      console.error("CAUSE:", err?.cause);

      if (err?.cause) {
        console.error("CAUSE CODE:", err.cause.code);
        console.error("CAUSE ERRNO:", err.cause.errno);
        console.error("CAUSE SYSCALL:", err.cause.syscall);
        console.error("CAUSE HOST:", err.cause.hostname);
      }

      console.error("=================================");

      lastError = err instanceof Error ? err : new Error(String(err));

      const isRateLimit =
        lastError.message.includes('429') ||
        lastError.message.includes('RESOURCE_EXHAUSTED') ||
        lastError.message.includes('Too Many Requests');

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`[EXTRACT] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error('Extraction failed after retries');
}

export async function liveExtract(
  documentId: string,
  pdfText: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log("USE_DUMMY_AI =", process.env.USE_DUMMY_AI);
  console.log("HAS_KEY =", !!process.env.GEMINI_API_KEY);
  console.log("KEY_PREFIX =", process.env.GEMINI_API_KEY?.slice(0, 10));

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  console.log("[MODEL_USED]", modelName);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const { responseText, promptTokens, completionTokens, totalTokens } =
    await generateWithRetry(model, SYSTEM_PROMPT, pdfText);

  console.log('[GEMINI_RAW_RESPONSE]', responseText);

  const cost_usd =
    promptTokens * GEMINI_INPUT_RATE + completionTokens * GEMINI_OUTPUT_RATE;

  const { fields, confidence_avg } = parseGeminiResponse(responseText, modelName);

  return {
    document_id: documentId,
    fields,
    model_used: modelName,
    token_count: totalTokens,
    cost_usd: Math.round(cost_usd * 1_000_000_000) / 1_000_000_000,
    confidence_avg,
  };
}
