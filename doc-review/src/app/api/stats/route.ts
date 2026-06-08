import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/guard';

export async function GET() {
  try {
    await requireAuth();
    const adminClient = createAdminClient();

    const [docCount, statusCounts, extractionStats] = await Promise.all([
      adminClient.from('documents').select('*', { count: 'exact', head: true }),
      adminClient.from('documents')
        .select('status')
        .then((r: { data: { status: string }[] | null }) => {
          const counts: Record<string, number> = {};
          (r.data ?? []).forEach((d: { status: string }) => {
            counts[d.status] = (counts[d.status] ?? 0) + 1;
          });
          return counts;
        }),
      adminClient.from('documents')
        .select('ai_token_count, ai_cost_usd, dummy_mode'),
    ]);

    const totalDocs = docCount.count ?? 0;
    const totalTokens = (extractionStats.data ?? []).reduce(
      (s: number, d: { ai_token_count: number | null }) => s + (d.ai_token_count ?? 0),
      0
    );
    const totalCost = (extractionStats.data ?? []).reduce(
      (s: number, d: { ai_cost_usd: number | null }) => s + (d.ai_cost_usd ?? 0),
      0
    );
    const dummyCount = (extractionStats.data ?? []).filter(
      (d: { dummy_mode: boolean }) => d.dummy_mode
    ).length;
    const liveCount = (extractionStats.data ?? []).filter(
      (d: { dummy_mode: boolean }) => !d.dummy_mode
    ).length;

    return NextResponse.json({
      data: {
        total_docs: totalDocs,
        status_breakdown: statusCounts,
        total_tokens: totalTokens,
        total_cost_usd: Math.round(totalCost * 1_000_000_000) / 1_000_000_000,
        ai_calls_live: liveCount,
        ai_calls_dummy: dummyCount,
        avg_tokens_per_doc: totalDocs > 0 ? Math.round(totalTokens / totalDocs) : 0,
      },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
