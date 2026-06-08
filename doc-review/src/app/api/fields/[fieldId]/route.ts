import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/guard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  try {
    await requireAuth();
    const { fieldId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: field, error } = await supabase
      .from('extracted_fields')
      .select('*, documents(*)')
      .eq('id', fieldId)
      .single();

    if (error || !field) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Field not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: field });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
