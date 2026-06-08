import { describe, it, expect } from 'vitest';
import { normalizeValue, parseValue, formatValueDisplay } from '../../src/lib/utils';

describe('normalizeValue', () => {
  it('handles null', () => {
    expect(normalizeValue(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(normalizeValue(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(normalizeValue('')).toBe('');
  });

  it('preserves plain string', () => {
    expect(normalizeValue('INV-2024-001')).toBe('INV-2024-001');
  });

  it('preserves numeric string', () => {
    expect(normalizeValue('12500.00')).toBe('12500.00');
  });

  it('converts number to string', () => {
    expect(normalizeValue(12500)).toBe('12500');
  });

  it('converts zero to string', () => {
    expect(normalizeValue(0)).toBe('0');
  });

  it('converts boolean to string', () => {
    expect(normalizeValue(true)).toBe('true');
    expect(normalizeValue(false)).toBe('false');
  });

  describe('single line item (array with 1 object)', () => {
    it('serializes to JSON string', () => {
      const value = [
        { description: 'Concrete Inspection Services', quantity: 5, unit_price: 1500, total: 7500 },
      ];
      const result = normalizeValue(value);
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].description).toBe('Concrete Inspection Services');
      expect(parsed[0].quantity).toBe(5);
    });
  });

  describe('multiple line items', () => {
    it('serializes all items', () => {
      const value = [
        { description: 'Item A', quantity: 2, unit_price: 100, total: 200 },
        { description: 'Item B', quantity: 3, unit_price: 50, total: 150 },
      ];
      const result = normalizeValue(value);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].description).toBe('Item A');
      expect(parsed[1].description).toBe('Item B');
    });
  });

  describe('empty array', () => {
    it('serializes to empty JSON array string', () => {
      expect(normalizeValue([])).toBe('[]');
    });
  });

  describe('nested objects', () => {
    it('serializes nested object', () => {
      const value = { address: { line1: '123 Street', city: 'NYC' }, contact: { name: 'John' } };
      const result = normalizeValue(value);
      const parsed = JSON.parse(result);
      expect(parsed.address.line1).toBe('123 Street');
      expect(parsed.contact.name).toBe('John');
    });
  });

  describe('mixed types in array', () => {
    it('preserves numeric and string types', () => {
      const value = [
        { description: 'Server', quantity: 2, unit_price: 2500.00, total: 5000.00 },
      ];
      const result = normalizeValue(value);
      const parsed = JSON.parse(result);
      expect(typeof parsed[0].quantity).toBe('number');
      expect(typeof parsed[0].description).toBe('string');
    });
  });

  describe('deeply nested array', () => {
    it('serializes nested arrays', () => {
      const value = { categories: [{ name: 'A', items: [{ id: 1 }, { id: 2 }] }] };
      const result = normalizeValue(value);
      const parsed = JSON.parse(result);
      expect(parsed.categories[0].items).toHaveLength(2);
    });
  });
});

describe('parseValue', () => {
  it('returns null for null input', () => {
    expect(parseValue(null)).toBeNull();
  });

  it('returns undefined for undefined/empty string', () => {
    expect(parseValue('')).toBe('');
  });

  it('parses JSON array', () => {
    const result = parseValue('[{"description":"Test"}]');
    expect(Array.isArray(result)).toBe(true);
    expect((result as Array<{ description: string }>)[0].description).toBe('Test');
  });

  it('returns raw string for non-JSON', () => {
    expect(parseValue('INV-001')).toBe('INV-001');
  });
});

describe('formatValueDisplay', () => {
  it('returns — for null', () => {
    expect(formatValueDisplay(null)).toBe('—');
  });

  it('returns — for empty string', () => {
    expect(formatValueDisplay('')).toBe('—');
  });

  it('shows plain value for non-array type', () => {
    expect(formatValueDisplay('INV-001', 'text')).toBe('INV-001');
  });

  it('shows item count for array with items', () => {
    const json = JSON.stringify([{ description: 'A' }, { description: 'B' }, { description: 'C' }]);
    expect(formatValueDisplay(json, 'array')).toBe('3 items');
  });

  it('shows "1 item" for single-item array', () => {
    const json = JSON.stringify([{ description: 'A' }]);
    expect(formatValueDisplay(json, 'array')).toBe('1 item');
  });

  it('shows "1 item" for object type', () => {
    const json = JSON.stringify({ key: 'value' });
    expect(formatValueDisplay(json, 'object')).toBe('1 item');
  });

  it('falls back to raw value for invalid JSON', () => {
    expect(formatValueDisplay('not-json', 'array')).toBe('not-json');
  });
});
