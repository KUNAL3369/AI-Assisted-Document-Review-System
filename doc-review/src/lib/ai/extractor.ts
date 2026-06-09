import { dummyExtract } from './dummy-extractor';
import { liveExtract } from './live-extractor';
import type { ExtractionResult } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PROVIDER_HANDLERS: Record<string, (documentId: string, pdfText: string) => Promise<ExtractionResult>> = {
  gemini: liveExtract,
};

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

  const provider = process.env.AI_PROVIDER ?? 'gemini';
  console.log(`[EXTRACT] Provider="${provider}" Live mode — for ${documentId}`);

  const handler = PROVIDER_HANDLERS[provider];
  if (!handler) {
    throw new Error(`Unsupported AI_PROVIDER "${provider}". Supported: ${Object.keys(PROVIDER_HANDLERS).join(', ')}`);
  }

  return handler(documentId, pdfText);
}
