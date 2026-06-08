import type { ExtractedFieldInput, ExtractionResult } from '@/lib/types';

export type { ExtractedFieldInput, ExtractionResult };

export interface Extractor {
  extract(documentId: string, pdfText: string): Promise<ExtractionResult>;
}
