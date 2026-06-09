import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChatCompletionsCreate = vi.fn();

vi.mock('groq-sdk', () => ({
  default: vi.fn(function MockGroq() {
    return {
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    };
  }),
}));

process.env.GROQ_API_KEY = 'test-groq-key';
process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';

const validFields = [
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
];

function makeValidResponse(overrides = {}) {
  return {
    choices: [{ message: { content: JSON.stringify({ fields: validFields, confidence_avg: 0.94, token_count: 100, ...overrides }) } }],
    usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
  };
}

describe('groqExtract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
  });

  it('throws error when GROQ_API_KEY is not configured', async () => {
    delete process.env.GROQ_API_KEY;
    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    await expect(groqExtract('doc-1', 'invoice text')).rejects.toThrow(
      'GROQ_API_KEY not configured'
    );
  });

  it('extracts all 11 fields successfully', async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce(makeValidResponse());

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    const result = await groqExtract('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(result.model_used).toBe('llama-3.3-70b-versatile');
    expect(result.document_id).toBe('doc-1');
    expect(result.confidence_avg).toBeGreaterThan(0);
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
  });

  it('catches malformed JSON response', async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Not JSON at all' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    await expect(groqExtract('doc-1', 'invoice text')).rejects.toThrow(
      /Failed to parse Groq response as JSON/
    );
  });

  it('catches response missing fields array', async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ not_fields: true }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    await expect(groqExtract('doc-1', 'invoice text')).rejects.toThrow(
      /missing "fields" array/
    );
  });

  it('retries on 429 then succeeds', async () => {
    mockChatCompletionsCreate
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockResolvedValueOnce(makeValidResponse());

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    const result = await groqExtract('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
  }, 10000);

  it('does not retry on non-retryable errors (400)', async () => {
    mockChatCompletionsCreate.mockRejectedValueOnce(
      Object.assign(new Error('Bad Request: invalid model'), { status: 400 })
    );

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    await expect(groqExtract('doc-1', 'invoice text')).rejects.toThrow(
      'Bad Request: invalid model'
    );
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
  });

  it('uses default model when GROQ_MODEL is not set', async () => {
    delete process.env.GROQ_MODEL;
    mockChatCompletionsCreate.mockResolvedValueOnce(makeValidResponse());

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    const result = await groqExtract('doc-1', 'invoice text');
    expect(result.model_used).toBe('llama-3.3-70b-versatile');
  });

  it('handles code-fenced JSON in response', async () => {
    const fenced = '```json\n' + JSON.stringify({ fields: validFields, confidence_avg: 0.94, token_count: 100 }) + '\n```';
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: fenced } }],
      usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
    });

    const { groqExtract } = await import('../../src/lib/ai/groq-extractor');
    const result = await groqExtract('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
  });
});
