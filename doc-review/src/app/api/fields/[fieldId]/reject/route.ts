import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';
import { rejectFieldSchema } from '@/lib/validation/schemas';
import { logEvent } from '@/lib/audit/logger';
import { recalculateDocumentStatus } from '@/lib/update-document-status';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  try {
    const user = await requirePermission('reject_field');
    const { fieldId } = await params;
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const parsed = rejectFieldSchema.parse(body);

    const { data: field } = await supabase
      .from('extracted_fields')
      .select('*')
      .eq('id', fieldId)
      .single();

    if (!field) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Field not found' } },
        { status: 404 }
      );
    }

    if (field.status !== 'pending_review') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: `Cannot reject: field status is "${field.status}", expected "pending_review"` } },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from('extracted_fields')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_comment: parsed.comment ?? null,
      })
      .eq('id', fieldId);

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: updateError.message } },
        { status: 500 }
      );
    }

    await supabase.from('review_actions').insert({
      field_id: fieldId,
      document_id: field.document_id,
      action: 'reject',
      user_id: user.id,
      previous_value: field.ai_value,
      comment: parsed.comment ?? null,
    });

    await logEvent({
      event_type: 'field.rejected',
      user_id: user.id,
      document_id: field.document_id,
      field_id: fieldId,
      metadata: { field_key: field.field_key, comment: parsed.comment },
    });

    await recalculateDocumentStatus(field.document_id);

    return NextResponse.json({
      data: { id: fieldId, status: 'rejected' },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
