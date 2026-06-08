import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';
import { batchActionSchema } from '@/lib/validation/schemas';
import { logEvent } from '@/lib/audit/logger';
import { recalculateDocumentStatus } from '@/lib/update-document-status';

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('batch_action');
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const parsed = batchActionSchema.parse(body);

    const { data: fields } = await supabase
      .from('extracted_fields')
      .select('*')
      .in('id', parsed.field_ids);

    if (!fields || fields.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No fields found' } },
        { status: 404 }
      );
    }

    const invalidFields = fields.filter((f) => f.status !== 'pending_review');
    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot ${parsed.action} ${invalidFields.length} field(s) that are not in "pending_review" status`,
            details: invalidFields.map((f) => ({ id: f.id, status: f.status })),
          },
        },
        { status: 409 }
      );
    }

    const newStatus = parsed.action === 'approve' ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('extracted_fields')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: now,
        is_verified: parsed.action === 'approve',
      })
      .in('id', parsed.field_ids);

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: updateError.message } },
        { status: 500 }
      );
    }

    const reviewActions = fields.map((f) => ({
      field_id: f.id,
      document_id: f.document_id,
      action: parsed.action,
      user_id: user.id,
      previous_value: f.ai_value,
    }));

    await supabase.from('review_actions').insert(reviewActions);

    const eventType = parsed.action === 'approve' ? 'field.approved' : 'field.rejected';
    await logEvent({
      event_type: eventType,
      user_id: user.id,
      metadata: { field_ids: parsed.field_ids, count: parsed.field_ids.length, batch: true },
    });

    // Recalculate status for each unique document
    const docIds = new Set(fields.map((f) => f.document_id));
    await Promise.all([...docIds].map(recalculateDocumentStatus));

    return NextResponse.json({
      data: { action: parsed.action, count: parsed.field_ids.length },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
