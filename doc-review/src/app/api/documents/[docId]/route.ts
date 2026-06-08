import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/guard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    await requireAuth();
    const { docId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    const { data: fields } = await supabase
      .from('extracted_fields')
      .select('*')
      .eq('document_id', docId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      data: {
        document,
        fields: fields ?? [],
      },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
