import { dummyExtract } from './dummy-extractor';
import { liveExtract } from './live-extractor';
import type { ExtractionResult } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  console.log(`[EXTRACT] Live mode — calling Gemini for ${documentId}`);
  return liveExtract(documentId, pdfText);
}
