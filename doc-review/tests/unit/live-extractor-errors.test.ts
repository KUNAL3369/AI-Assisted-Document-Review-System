import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function MockGenAI() {
    return {
      getGenerativeModel: function () {
        return {
          generateContent: mockGenerateContent,
        };
      },
    };
  }),
}));

process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-1.5-flash';

describe('liveExtract error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('throws error when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    await expect(liveExtract('doc-1', 'invoice text')).rejects.toThrow(
      'GEMINI_API_KEY not configured'
    );
  });

  it('catches malformed JSON response and throws descriptive error', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Not JSON at all',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      },
    });

    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    await expect(liveExtract('doc-1', 'invoice text')).rejects.toThrow(
      /Failed to parse Gemini response as JSON/
    );
  });

  it('catches empty response text and throws', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => '',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      },
    });

    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    await expect(liveExtract('doc-1', 'invoice text')).rejects.toThrow(
      /Failed to parse Gemini response/
    );
  });

  it('catches response missing fields array', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({ not_fields: true }),
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      },
    });

    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    await expect(liveExtract('doc-1', 'invoice text')).rejects.toThrow(
      /missing "fields" array/
    );
  });

  it('retries on 429 rate-limit error then succeeds', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            fields: [
              { field_key: 'invoice_number', field_label: 'Invoice Number', field_type: 'text', value: 'INV-001', confidence: 0.97, page_reference: 1 },
              { field_key: 'vendor_name', field_label: 'Vendor Name', field_type: 'text', value: 'Test Corp', confidence: 0.99, page_reference: 1 },
              { field_key: 'vendor_address', field_label: 'Vendor Address', field_type: 'text', value: '123 St', confidence: 0.88, page_reference: 1 },
              { field_key: 'invoice_date', field_label: 'Invoice Date', field_type: 'date', value: '2024-01-01', confidence: 0.95, page_reference: 1 },
              { field_key: 'due_date', field_label: 'Due Date', field_type: 'date', value: '2024-02-01', confidence: 0.94, page_reference: 1 },
              { field_key: 'po_number', field_label: 'PO Number', field_type: 'text', value: 'PO-123', confidence: 0.85, page_reference: 1 },
              { field_key: 'subtotal', field_label: 'Subtotal', field_type: 'currency', value: '1000.00', confidence: 0.96, page_reference: 1 },
              { field_key: 'tax_amount', field_label: 'Tax Amount', field_type: 'currency', value: '100.00', confidence: 0.93, page_reference: 1 },
              { field_key: 'total_amount', field_label: 'Total Amount', field_type: 'currency', value: '1100.00', confidence: 0.97, page_reference: 1 },
              { field_key: 'currency', field_label: 'Currency', field_type: 'text', value: 'USD', confidence: 0.99, page_reference: 1 },
              { field_key: 'line_items', field_label: 'Line Items', field_type: 'text', value: '[]', confidence: 0.90, page_reference: 1 },
            ],
            confidence_avg: 0.94,
            token_count: 100,
          }),
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 50, totalTokenCount: 100 },
        },
      });

    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    const result = await liveExtract('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(result.model_used).toBe('gemini-1.5-flash');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  }, 10000);

  it('throws after max retries on persistent 500', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }));

    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    await expect(liveExtract('doc-1', 'invoice text')).rejects.toThrow(
      'Service Unavailable'
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
  }, 25000);

  it('does not retry on non-retryable errors (400)', async () => {
    mockGenerateContent.mockRejectedValueOnce(
      Object.assign(new Error('Bad Request: invalid model'), { status: 400 })
    );

    const { liveExtract } = await import('../../src/lib/ai/live-extractor');
    await expect(liveExtract('doc-1', 'invoice text')).rejects.toThrow(
      'Bad Request: invalid model'
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
