export type UserRole = 'operations_executive' | 'team_lead' | 'administrator';

export type DocumentStatus =
  | 'pending_extraction'
  | 'extracting'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'error';

export type FieldStatus =
  | 'pending_review'
  | 'approved'
  | 'edited'
  | 'rejected';

export type AuditEventType =
  | 'document.uploaded'
  | 'document.deleted'
  | 'extraction.started'
  | 'extraction.completed'
  | 'extraction.failed'
  | 'field.approved'
  | 'field.edited'
  | 'field.rejected'
  | 'document.approved'
  | 'document.rejected'
  | 'user.login'
  | 'user.logout'
  | 'user.role_changed'
  | 'ai.usage_recorded';

export type FieldType = 'text' | 'number' | 'currency' | 'date';

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  status: DocumentStatus;
  page_count: number | null;
  ai_model_used: string | null;
  ai_token_count: number | null;
  ai_cost_usd: number | null;
  dummy_mode: boolean;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractedField {
  id: string;
  document_id: string;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  ai_value: string | null;
  confidence: number | null;
  status: FieldStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  human_value: string | null;
  source_hint: string | null;
  page_reference: number | null;
  bounding_box: Record<string, unknown> | null;
  is_verified: boolean;
  rejection_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewAction {
  id: string;
  field_id: string;
  document_id: string;
  action: 'approve' | 'edit' | 'reject';
  user_id: string;
  previous_value: string | null;
  new_value: string | null;
  comment: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  user_id: string | null;
  document_id: string | null;
  field_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface ExtractedFieldInput {
  field_key: string;
  field_label: string;
  field_type: FieldType;
  value: string;
  confidence: number;
  page_reference: number | null;
  source_hint: string;
}

export interface ExtractionResult {
  document_id: string;
  fields: ExtractedFieldInput[];
  model_used: string;
  token_count: number;
  cost_usd: number;
  confidence_avg: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
