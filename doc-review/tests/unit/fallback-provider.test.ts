import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateContent = vi.fn();
const mockChatCompletionsCreate = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function MockGenAI() {
    return {
      getGenerativeModel: function () {
        return { generateContent: mockGenerateContent };
      },
    };
  }),
}));

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

function geminiSuccess() {
  return {
    response: {
      text: () => JSON.stringify({ fields: validFields, confidence_avg: 0.94, token_count: 100 }),
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 50, totalTokenCount: 100 },
    },
  };
}

function groqSuccess() {
  return {
    choices: [{ message: { content: JSON.stringify({ fields: validFields, confidence_avg: 0.94, token_count: 100 }) } }],
    usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
  };
}

describe('fallback provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-1.5-flash';
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
    process.env.AI_PROVIDER = 'gemini';
    process.env.FALLBACK_PROVIDER = 'groq';
    process.env.USE_DUMMY_AI = 'false';
  });

  it('uses primary provider when it succeeds', async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiSuccess());

    const { extractDocument } = await import('../../src/lib/ai/extractor');
    const result = await extractDocument('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(result.model_used).toBe('gemini-1.5-flash');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it('falls back to Groq after Gemini exhausts retries on 429', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }));
    mockChatCompletionsCreate.mockResolvedValueOnce(groqSuccess());

    const { extractDocument } = await import('../../src/lib/ai/extractor');
    const result = await extractDocument('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(result.model_used).toBe('llama-3.3-70b-versatile');
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
  }, 30000);

  it('falls back to Groq when Gemini exhausts retries on 503', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }));
    mockChatCompletionsCreate.mockResolvedValueOnce(groqSuccess());

    const { extractDocument } = await import('../../src/lib/ai/extractor');
    const result = await extractDocument('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(result.model_used).toBe('llama-3.3-70b-versatile');
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
  }, 30000);

  it('does not fall back on non-retryable error', async () => {
    mockGenerateContent.mockRejectedValueOnce(
      Object.assign(new Error('Bad Request: invalid model'), { status: 400 })
    );

    const { extractDocument } = await import('../../src/lib/ai/extractor');
    await expect(extractDocument('doc-1', 'invoice text')).rejects.toThrow(
      'Bad Request: invalid model'
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it('does not fall back when FALLBACK_PROVIDER is not set', async () => {
    delete process.env.FALLBACK_PROVIDER;
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('429 Too Many Requests'), { status: 429 }));

    const { extractDocument } = await import('../../src/lib/ai/extractor');
    await expect(extractDocument('doc-1', 'invoice text')).rejects.toThrow(
      '429 Too Many Requests'
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  }, 30000);

  it('uses Groq directly when AI_PROVIDER=groq', async () => {
    process.env.AI_PROVIDER = 'groq';
    mockChatCompletionsCreate.mockResolvedValueOnce(groqSuccess());

    const { extractDocument } = await import('../../src/lib/ai/extractor');
    const result = await extractDocument('doc-1', 'invoice text');
    expect(result.fields).toHaveLength(11);
    expect(result.model_used).toBe('llama-3.3-70b-versatile');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
  });
});
