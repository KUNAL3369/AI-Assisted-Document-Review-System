import { dummyExtract } from './dummy-extractor';
import { liveExtract } from './live-extractor';
import { groqExtract } from './groq-extractor';
import type { ExtractionResult } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PROVIDER_HANDLERS: Record<string, (documentId: string, pdfText: string) => Promise<ExtractionResult>> = {
  gemini: liveExtract,
  groq: groqExtract,
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function isRetryableError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  const statusCode = e?.status ?? 0;
  const message = e?.message ?? String(err ?? '');
  return RETRYABLE_STATUSES.has(statusCode) ||
    [429, 500, 502, 503, 504].some((code) => message.startsWith(String(code)));
}

export async function extractDocument(
  documentId: string,
  pdfText: string
): Promise<ExtractionResult> {
  const useDummy = process.env.USE_DUMMY_AI === 'true';

  if (useDummy) {
    console.log(`[EXTRACT] Dummy mode — returning seeded data for ${documentId}`);
    await sleep(800);
    return dummyExtract(documentId);
  }

  const primaryProvider = process.env.AI_PROVIDER ?? process.env.PRIMARY_PROVIDER ?? 'gemini';
  const fallbackProvider = process.env.FALLBACK_PROVIDER;

  console.log(`[EXTRACT] Primary="${primaryProvider}"${fallbackProvider ? ` Fallback="${fallbackProvider}"` : ''} Live mode — for ${documentId}`);

  const primaryHandler = PROVIDER_HANDLERS[primaryProvider];
  if (!primaryHandler) {
    throw new Error(`Unsupported AI_PROVIDER "${primaryProvider}". Supported: ${Object.keys(PROVIDER_HANDLERS).join(', ')}`);
  }

  try {
    return await primaryHandler(documentId, pdfText);
  } catch (err: unknown) {
    const isRetryable = isRetryableError(err);

    if (isRetryable && fallbackProvider) {
      const fallbackHandler = PROVIDER_HANDLERS[fallbackProvider];
      if (fallbackHandler) {
        const statusCode = (err as { status?: number })?.status ?? 0;
        console.log('[FALLBACK_TRIGGERED]', JSON.stringify({
          primary: primaryProvider,
          fallback: fallbackProvider,
          status: statusCode,
          message: (err as Error)?.message?.substring(0, 200) ?? '',
        }));
        console.log('[FALLBACK_PROVIDER]', fallbackProvider);
        return await fallbackHandler(documentId, pdfText);
      }
    }

    throw err;
  }
}
