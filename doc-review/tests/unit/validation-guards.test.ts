import { describe, it, expect } from 'vitest';
import { requireFieldStatus, requireDocumentStatus } from '../../src/lib/validation/guards';

describe('requireFieldStatus', () => {
  it('returns null when field has expected status', () => {
    const result = requireFieldStatus('pending_review', 'pending_review', 'approve');
    expect(result).toBeNull();
  });

  it('returns error response when field has different status', async () => {
    const result = requireFieldStatus('approved', 'pending_review', 'approve');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(409);
    const body = await result!.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('approved');
  });
});

describe('requireDocumentStatus', () => {
  it('returns null when document has expected status', () => {
    const result = requireDocumentStatus('pending_review', 'pending_review', 're-extract');
    expect(result).toBeNull();
  });

  it('returns error response when document has different status', async () => {
    const result = requireDocumentStatus('completed', 'pending_review', 're-extract');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(409);
    const body = await result!.json();
    expect(body.error.code).toBe('CONFLICT');
  });
});
