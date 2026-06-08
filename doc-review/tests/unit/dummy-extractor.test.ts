import { describe, it, expect } from 'vitest';
import { dummyExtract } from '../../src/lib/ai/dummy-extractor';

describe('dummyExtract', () => {
  const DOCUMENT_ID = 'test-doc-id-123';

  it('returns correct output shape', async () => {
    const result = await dummyExtract(DOCUMENT_ID);

    expect(result).toHaveProperty('document_id', DOCUMENT_ID);
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('model_used', 'dummy');
    expect(result).toHaveProperty('token_count', 0);
    expect(result).toHaveProperty('cost_usd', 0);
    expect(result).toHaveProperty('confidence_avg');
  });

  it('returns exactly 11 fields', async () => {
    const result = await dummyExtract(DOCUMENT_ID);
    expect(result.fields).toHaveLength(11);
  });

  it('returns all required field keys', async () => {
    const result = await dummyExtract(DOCUMENT_ID);
    const fieldKeys = result.fields.map((f) => f.field_key);

    const expectedKeys = [
      'invoice_number',
      'vendor_name',
      'vendor_address',
      'invoice_date',
      'due_date',
      'po_number',
      'subtotal',
      'tax_amount',
      'total_amount',
      'currency',
      'line_items',
    ];

    expectedKeys.forEach((key) => {
      expect(fieldKeys).toContain(key);
    });
  });

  it('each field has correct type structure', async () => {
    const result = await dummyExtract(DOCUMENT_ID);

    result.fields.forEach((field) => {
      expect(field).toHaveProperty('field_key');
      expect(field).toHaveProperty('field_label');
      expect(field).toHaveProperty('field_type');
      expect(field).toHaveProperty('value');
      expect(field).toHaveProperty('confidence');
      expect(field).toHaveProperty('page_reference');
      expect(field).toHaveProperty('source_hint', 'dummy');

      expect(typeof field.field_key).toBe('string');
      expect(typeof field.field_label).toBe('string');
      expect(typeof field.value).toBe('string');
      expect(typeof field.confidence).toBe('number');
      expect(['text', 'number', 'currency', 'date']).toContain(field.field_type);
    });
  });

  it('all confidence values are between 0.7 and 0.99', async () => {
    const result = await dummyExtract(DOCUMENT_ID);

    result.fields.forEach((field) => {
      expect(field.confidence).toBeGreaterThanOrEqual(0.7);
      expect(field.confidence).toBeLessThanOrEqual(0.99);
    });
  });

  it('computes confidence_avg correctly', async () => {
    const result = await dummyExtract(DOCUMENT_ID);

    const manualAvg =
      result.fields.reduce((sum, f) => sum + f.confidence, 0) /
      result.fields.length;

    // Rounded to 3 decimal places
    expect(result.confidence_avg).toBe(Math.round(manualAvg * 1000) / 1000);
  });

  it('field types match expected schema', async () => {
    const result = await dummyExtract(DOCUMENT_ID);

    const typeMap: Record<string, string> = {
      invoice_number: 'text',
      vendor_name: 'text',
      vendor_address: 'text',
      invoice_date: 'date',
      due_date: 'date',
      po_number: 'text',
      subtotal: 'currency',
      tax_amount: 'currency',
      total_amount: 'currency',
      currency: 'text',
      line_items: 'text',
    };

    result.fields.forEach((field) => {
      expect(field.field_type).toBe(typeMap[field.field_key]);
    });
  });

  it('all page_reference values are 1', async () => {
    const result = await dummyExtract(DOCUMENT_ID);

    result.fields.forEach((field) => {
      expect(field.page_reference).toBe(1);
    });
  });
});
