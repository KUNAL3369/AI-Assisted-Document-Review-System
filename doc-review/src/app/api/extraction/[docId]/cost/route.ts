import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    await requirePermission('view_cost');
    const { docId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('ai_model_used, ai_token_count, ai_cost_usd, dummy_mode, filename')
      .eq('id', docId)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        document_id: docId,
        filename: doc.filename,
        model: doc.ai_model_used,
        tokens: doc.ai_token_count ?? 0,
        cost_usd: doc.ai_cost_usd ?? 0,
        dummy_mode: doc.dummy_mode,
      },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
