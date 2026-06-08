'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatConfidence, confidenceColor, formatValueDisplay } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import type { ExtractedField } from '@/lib/types';

interface FieldWithDoc extends ExtractedField {
  documents?: { filename: string };
}

export default function ReviewQueuePage() {
  const [fields, setFields] = useState<FieldWithDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const loadFields = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const res = await fetch('/api/fields?status=pending_review&limit=50');
    if (res.ok) {
      const json = await res.json();
      setFields(json.data);
      setFetchError('');
    } else {
      const json = await res.json().catch(() => ({}));
      setFetchError(json.error?.message ?? 'Failed to load pending reviews');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBatch(action: 'approve' | 'reject') {
    if (selected.size === 0) return;

    const res = await fetch('/api/fields/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, field_ids: Array.from(selected) }),
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      setActionMsg(`${selected.size} field${selected.size > 1 ? 's' : ''} ${action}d`);
      setActionError('');
      setSelected(new Set());
      await loadFields();
      setTimeout(() => setActionMsg(''), 3000);
    } else {
      setActionError(json.error?.message ?? `Batch ${action} failed`);
      setTimeout(() => setActionError(''), 5000);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        {fields.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="success"
              onClick={() => handleBatch('approve')}
              disabled={selected.size === 0}
            >
              Approve Selected ({selected.size})
            </Button>
            <Button
              variant="danger"
              onClick={() => handleBatch('reject')}
              disabled={selected.size === 0}
            >
              Reject Selected ({selected.size})
            </Button>
          </div>
        )}
      </div>

      {actionMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-3 mb-4">
          {actionMsg}
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {actionError}
        </div>
      )}

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {fetchError}
        </div>
      )}

      {!fetchError && fields.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-lg font-medium text-gray-900">No pending reviews</p>
          <p className="text-sm text-gray-500 mt-1">
            All extracted fields have been reviewed.
          </p>
          <Link href="/upload" className="mt-4 inline-block text-blue-600 hover:text-blue-500 text-sm font-medium">
            Upload a new document →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 p-3 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(fields.map((f) => f.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    checked={selected.size === fields.length && fields.length > 0}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="p-3 text-left font-medium text-gray-600">Field</th>
                <th className="p-3 text-left font-medium text-gray-600">Document</th>
                <th className="p-3 text-left font-medium text-gray-600">AI Value</th>
                <th className="p-3 text-left font-medium text-gray-600">Confidence</th>
                <th className="p-3 text-left font-medium text-gray-600">Source</th>
                <th className="p-3 text-left font-medium text-gray-600">Date</th>
                <th className="p-3 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(field.id)}
                      onChange={() => toggleSelect(field.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-gray-900">{field.field_label}</span>
                    <span className="text-gray-400 ml-1 text-xs">{field.field_key}</span>
                  </td>
                  <td className="p-3 text-gray-600 max-w-[200px] truncate">
                    {field.documents?.filename ?? '—'}
                  </td>
                  <td className="p-3 text-gray-900 font-mono text-xs max-w-[200px] truncate"
                      title={field.ai_value ?? ''}>
                    {field.field_type === 'array' || field.field_type === 'object' ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                        {formatValueDisplay(field.ai_value, field.field_type)}
                      </span>
                    ) : (
                      field.ai_value ?? '—'
                    )}
                  </td>
                  <td className={`p-3 font-medium ${confidenceColor(field.confidence)}`}>
                    {formatConfidence(field.confidence)}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${field.source_hint === 'dummy' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                      {field.source_hint ?? '—'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {formatDate(field.created_at)}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/review/${field.id}`}
                      className="inline-flex items-center justify-center rounded-md font-medium transition-colors px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
