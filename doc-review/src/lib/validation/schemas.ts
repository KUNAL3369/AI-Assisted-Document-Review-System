import { z } from 'zod';

export const approveFieldSchema = z.object({
  field_id: z.string().uuid(),
}).strict();

export const editFieldSchema = z.object({
  value: z.string().min(1, 'Value cannot be empty'),
}).strict();

export const rejectFieldSchema = z.object({
  comment: z.string().optional(),
}).strict();

export const batchActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  field_ids: z.array(z.string().uuid()).min(1, 'At least one field required'),
}).strict();

export const rejectDocumentSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
}).strict();

export const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['operations_executive', 'team_lead', 'administrator']),
}).strict();

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict();

export const logsQuerySchema = paginationSchema.extend({
  event_type: z.string().optional(),
  document_id: z.string().uuid().optional(),
}).strict();

export type EditFieldInput = z.infer<typeof editFieldSchema>;
export type RejectFieldInput = z.infer<typeof rejectFieldSchema>;
export type BatchActionInput = z.infer<typeof batchActionSchema>;
export type RejectDocumentInput = z.infer<typeof rejectDocumentSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
