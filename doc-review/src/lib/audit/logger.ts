import { createAdminClient } from '@/lib/supabase/server';
import type { AuditEventType } from '@/lib/types';

interface LogEventParams {
  event_type: AuditEventType;
  user_id?: string;
  document_id?: string;
  field_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_logs').insert({
      event_type: params.event_type,
      user_id: params.user_id ?? null,
      document_id: params.document_id ?? null,
      field_id: params.field_id ?? null,
      ip_address: params.ip_address ?? null,
      user_agent: params.user_agent ?? null,
      metadata: params.metadata ?? {},
    });

    if (error) {
      console.error('Failed to write audit log:', error.message);
    }
  } catch (err) {
    console.error('Audit logger error:', err);
  }
}
