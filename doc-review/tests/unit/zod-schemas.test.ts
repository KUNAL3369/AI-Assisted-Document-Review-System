import { describe, it, expect } from 'vitest';
import {
  editFieldSchema,
  approveFieldSchema,
  rejectFieldSchema,
  batchActionSchema,
  updateRoleSchema,
} from '../../src/lib/validation/schemas';

describe('editFieldSchema', () => {
  it('accepts valid input', () => {
    const result = editFieldSchema.safeParse({ value: 'INV-001' });
    expect(result.success).toBe(true);
  });

  it('rejects empty value', () => {
    const result = editFieldSchema.safeParse({ value: '' });
    expect(result.success).toBe(false);
  });
});

describe('approveFieldSchema', () => {
  it('rejects empty object (field_id required)', () => {
    const result = approveFieldSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('rejectFieldSchema', () => {
  it('accepts empty object (comment optional)', () => {
    const result = rejectFieldSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid comment', () => {
    const result = rejectFieldSchema.safeParse({ comment: 'Wrong value' });
    expect(result.success).toBe(true);
  });
});

describe('batchActionSchema', () => {
  const UUID = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts approve action with field_ids', () => {
    const result = batchActionSchema.safeParse({ action: 'approve', field_ids: [UUID] });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = batchActionSchema.safeParse({ action: 'delete', field_ids: [UUID] });
    expect(result.success).toBe(false);
  });

  it('rejects missing field_ids', () => {
    const result = batchActionSchema.safeParse({ action: 'approve' });
    expect(result.success).toBe(false);
  });

  it('rejects empty field_ids', () => {
    const result = batchActionSchema.safeParse({ action: 'approve', field_ids: [] });
    expect(result.success).toBe(false);
  });
});

describe('updateRoleSchema', () => {
  it('accepts valid role', () => {
    const result = updateRoleSchema.safeParse({ user_id: '550e8400-e29b-41d4-a716-446655440000', role: 'team_lead' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = updateRoleSchema.safeParse({ user_id: '550e8400-e29b-41d4-a716-446655440000', role: 'super_admin' });
    expect(result.success).toBe(false);
  });
});
