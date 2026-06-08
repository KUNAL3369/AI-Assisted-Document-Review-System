import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';
import { logsQuerySchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('view_logs');
    console.log('[api/logs] session.user_metadata:', { id: session.id, role: session.role, email: session.email });
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const query = logsQuerySchema.parse({
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 50,
      event_type: searchParams.get('event_type') ?? undefined,
      document_id: searchParams.get('document_id') ?? undefined,
    });

    let dbQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (query.event_type) {
      dbQuery = dbQuery.eq('event_type', query.event_type);
    }

    if (query.document_id) {
      dbQuery = dbQuery.eq('document_id', query.document_id);
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
