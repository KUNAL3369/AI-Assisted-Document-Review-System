'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';

interface DashboardStats {
  total_docs: number;
  status_breakdown: Record<string, number>;
  total_tokens: number;
  total_cost_usd: number;
  ai_calls_live: number;
  ai_calls_dummy: number;
  avg_tokens_per_doc: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadStats = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const res = await fetch('/api/stats');
    if (res.ok) {
      const json = await res.json();
      setStats(json.data);
      setFetchError('');
    } else {
      const json = await res.json().catch(() => ({}));
      setFetchError(json.error?.message ?? 'Failed to load dashboard stats');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pendingReview = stats?.status_breakdown?.pending_review ?? 0;
  const totalDocs = stats?.total_docs ?? 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {fetchError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Documents</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalDocs}</p>
        </div>

        <Link href="/review" className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:border-blue-400 transition-colors block">
          <p className="text-sm font-medium text-gray-500">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingReview}</p>
          <p className="text-xs text-gray-400 mt-1">Click to review →</p>
        </Link>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <p className="text-sm font-medium text-gray-500">AI Usage</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats?.total_tokens ?? 0} tokens</p>
          <p className="text-xs text-gray-400">
            ${(stats?.total_cost_usd ?? 0).toFixed(6)} · {stats?.ai_calls_live ?? 0} live / {stats?.ai_calls_dummy ?? 0} dummy
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/upload" className="block w-full">
              <Button variant="primary" size="lg" className="w-full">Upload New Document</Button>
            </Link>
            <Link href="/review" className="block w-full">
              <Button variant={pendingReview > 0 ? 'primary' : 'secondary'} size="lg" className="w-full">
                {pendingReview > 0 ? `Review ${pendingReview} Pending Field${pendingReview > 1 ? 's' : ''}` : 'Review Queue'}
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h2>
          {stats?.status_breakdown && Object.keys(stats.status_breakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.status_breakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">{status.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No documents yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
