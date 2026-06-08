'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UsageStats {
  total_docs: number;
  total_tokens: number;
  total_cost_usd: number;
  ai_calls_live: number;
  ai_calls_dummy: number;
  avg_tokens_per_doc: number;
}

interface DocCost {
  document_id: string;
  filename: string;
  model: string;
  tokens: number;
  cost_usd: number;
  dummy_mode: boolean;
}

export default function SettingsPage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [docCosts, setDocCosts] = useState<DocCost[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const [statsRes, docsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/documents?limit=100'),
      ]);

      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data);
      }

      if (docsRes.ok) {
        const json = await docsRes.json();
        const costs: DocCost[] = await Promise.all(
          json.data.map(async (doc: { id: string; filename: string }) => {
            const costRes = await fetch(`/api/extraction/${doc.id}/cost`);
            if (costRes.ok) {
              const costJson = await costRes.json();
              return costJson.data;
            }
            return null;
          })
        );
        setDocCosts(costs.filter(Boolean));
      }

      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings & AI Usage</h1>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Usage & Cost Dashboard</h2>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Documents Processed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_docs}</p>
            </div>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_tokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Estimated Cost</p>
              <p className="text-2xl font-bold text-gray-900">${stats.total_cost_usd.toFixed(6)}</p>
            </div>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">AI Calls</p>
              <p className="text-2xl font-bold text-gray-900">{stats.ai_calls_live} live / {stats.ai_calls_dummy} dummy</p>
            </div>
          </div>
        )}

        {stats && (
          <div className="text-xs text-gray-400 space-y-1 bg-gray-50 rounded-md p-4">
            <p><strong>Model:</strong> Gemini 1.5 Flash</p>
            <p><strong>Input rate:</strong> $0.075 / 1M tokens</p>
            <p><strong>Output rate:</strong> $0.300 / 1M tokens</p>
            <p><strong>Avg tokens/doc:</strong> {stats.avg_tokens_per_doc}</p>
            <p><strong>Avg cost/doc:</strong> ${(stats.total_docs > 0 ? stats.total_cost_usd / stats.total_docs : 0).toFixed(8)}</p>
            <p><strong>Mode:</strong> {process.env.NEXT_PUBLIC_USE_DUMMY_AI === 'true' ? 'Dummy (no real API calls)' : 'Live'}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Per-Document Cost Breakdown</h2>
        </div>

        {docCosts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No documents processed yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-medium text-gray-600">Document</th>
                <th className="p-3 text-left font-medium text-gray-600">Model</th>
                <th className="p-3 text-left font-medium text-gray-600">Tokens</th>
                <th className="p-3 text-left font-medium text-gray-600">Cost</th>
                <th className="p-3 text-left font-medium text-gray-600">Mode</th>
              </tr>
            </thead>
            <tbody>
              {docCosts.map((dc) => (
                <tr key={dc.document_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900 max-w-[200px] truncate">
                    {dc.filename}
                  </td>
                  <td className="p-3 text-gray-600">{dc.model}</td>
                  <td className="p-3 text-gray-600">{dc.tokens}</td>
                  <td className="p-3 text-gray-600 font-mono">${dc.cost_usd.toFixed(8)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      dc.dummy_mode ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {dc.dummy_mode ? 'Dummy' : 'Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
