import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/guard';
import { paginationSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const query = paginationSchema.parse({
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 20,
    });

    const status = searchParams.get('status');
    const documentId = searchParams.get('document_id');

    let dbQuery = supabase
      .from('extracted_fields')
      .select('*, documents!inner(filename)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (documentId) {
      dbQuery = dbQuery.eq('document_id', documentId);
    }

    const { data, count, error } = await dbQuery;

    if (error) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page: query.page,
      limit: query.limit,
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
