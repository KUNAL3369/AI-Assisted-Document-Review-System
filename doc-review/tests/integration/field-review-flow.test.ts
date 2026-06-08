import { describe, it, expect, vi, beforeEach } from 'vitest';

class MockUnauthorizedError extends Error { name = 'UnauthorizedError' }

vi.mock('../../src/lib/auth/guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', role: 'operations_executive' }),
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', role: 'operations_executive' }),
  UnauthorizedError: MockUnauthorizedError,
  handleApiError: (error: unknown) => {
    if (error instanceof MockUnauthorizedError) {
      return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: error.message } }), { status: 401 });
    }
    if (error instanceof Error && (error.name === 'ForbiddenError' || error.message.includes('Missing permission'))) {
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: error.message } }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal server error' } }), { status: 500 });
  },
}));

vi.mock('../../src/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('../../src/lib/audit/logger', () => ({
  logEvent: vi.fn(),
}));

import { createServerSupabaseClient } from '../../src/lib/supabase/server';
import { logEvent } from '../../src/lib/audit/logger';

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as any);
});

describe('POST /api/fields/[fieldId]/approve', () => {
  it('returns 404 when field does not exist', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const { POST } = await import('../../src/app/api/fields/[fieldId]/approve/route');
    const req = new Request('http://localhost/api/fields/nonexistent/approve', { method: 'POST' });
    const params = Promise.resolve({ fieldId: 'nonexistent' });
    const response = await POST(req, { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when field is not pending_review', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { id: 'field-1', document_id: 'doc-1', status: 'approved', field_key: 'total', confidence: 0.95 },
      error: null,
    });

    const { POST } = await import('../../src/app/api/fields/[fieldId]/approve/route');
    const req = new Request('http://localhost/api/fields/field-1/approve', { method: 'POST' });
    const params = Promise.resolve({ fieldId: 'field-1' });
    const response = await POST(req, { params });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('approved');
  });
});

describe('POST /api/fields/batch', () => {
  it('returns 409 when some fields are not pending_review', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [
        { id: '550e8400-e29b-41d4-a716-446655440001', document_id: 'doc-1', status: 'pending_review', field_key: 'k1', ai_value: 'v1' },
        { id: '550e8400-e29b-41d4-a716-446655440002', document_id: 'doc-1', status: 'approved', field_key: 'k2', ai_value: 'v2' },
      ],
      error: null,
    });

    const UUID1 = '550e8400-e29b-41d4-a716-446655440001';
    const UUID2 = '550e8400-e29b-41d4-a716-446655440002';

    const { POST } = await import('../../src/app/api/fields/batch/route');
    const req = new Request('http://localhost/api/fields/batch', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', field_ids: [UUID1, UUID2] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.details).toHaveLength(1);
    expect(body.error.details[0].id).toBe(UUID2);
  });
});
