import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';
import { rejectDocumentSchema } from '@/lib/validation/schemas';
import { logEvent } from '@/lib/audit/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await requirePermission('reject_document');
    const { docId } = await params;
    const supabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();

    const body = await request.json();
    const parsed = rejectDocumentSchema.parse(body);

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (!doc) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    if (doc.status !== 'pending_review') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: `Cannot reject: document status is "${doc.status}", expected "pending_review"` } },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'rejected', rejection_reason: parsed.reason })
      .eq('id', docId);

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: updateError.message } },
        { status: 500 }
      );
    }

    await supabase
      .from('extracted_fields')
      .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('document_id', docId)
      .eq('status', 'pending_review');

    await logEvent({
      event_type: 'document.rejected',
      user_id: user.id,
      document_id: docId,
      metadata: { reason: parsed.reason },
    });

    return NextResponse.json({
      data: { id: docId, status: 'rejected' },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
