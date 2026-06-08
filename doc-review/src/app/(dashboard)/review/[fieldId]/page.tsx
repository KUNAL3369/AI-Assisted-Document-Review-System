'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatConfidence, confidenceColor } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import type { ExtractedField, Document } from '@/lib/types';

interface FieldDetail extends ExtractedField {
  documents: Document;
}

export default function FieldReviewPage() {
  const params = useParams<{ fieldId: string }>();
  const router = useRouter();
  const [field, setField] = useState<FieldDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const loadField = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const res = await fetch(`/api/fields/${params.fieldId}`);
    if (res.ok) {
      const json = await res.json();
      setField(json.data);
      setEditValue(json.data.ai_value ?? '');
      setFetchError('');
    } else {
      const json = await res.json().catch(() => ({}));
      setFetchError(json.error?.message ?? 'Failed to load field');
    }
    setLoading(false);
  }, [params.fieldId]);

  useEffect(() => {
    loadField();
  }, [loadField]);

  async function handleApprove() {
    const res = await fetch(`/api/fields/${params.fieldId}/approve`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setActionMsg('Field approved!');
      setActionError('');
      setTimeout(() => router.push('/review'), 1000);
    } else {
      setActionError(json.error?.message ?? 'Approval failed');
    }
  }

  async function handleEdit() {
    const res = await fetch(`/api/fields/${params.fieldId}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: editValue }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setActionMsg('Field edited and approved!');
      setActionError('');
      setEditing(false);
      setTimeout(() => router.push('/review'), 1000);
    } else {
      setActionError(json.error?.message ?? 'Edit failed');
    }
  }

  async function handleReject() {
    const res = await fetch(`/api/fields/${params.fieldId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: rejectComment || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setActionMsg('Field rejected!');
      setActionError('');
      setTimeout(() => router.push('/review'), 1000);
    } else {
      setActionError(json.error?.message ?? 'Rejection failed');
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (fetchError || !field) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/review')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
          ← Back to Review Queue
        </button>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-lg font-medium text-gray-900">
            {fetchError || 'Field not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.push('/review')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Back to Review Queue
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Field</h1>
      <p className="text-sm text-gray-500 mb-6">
        Document: {field.documents?.filename}
      </p>

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

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Field</p>
            <p className="text-lg font-semibold text-gray-900">{field.field_label}</p>
            <p className="text-xs text-gray-400">{field.field_key}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</p>
            <p className="text-sm text-gray-900">{field.field_type}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Confidence</p>
            <p className={`text-lg font-bold ${confidenceColor(field.confidence)}`}>
              {formatConfidence(field.confidence)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Source</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${field.source_hint === 'dummy' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
              {field.source_hint ?? '—'}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          {!editing ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                AI Extracted Value
              </p>
              <div className="bg-gray-50 rounded-md p-3 font-mono text-sm text-gray-900 mb-4">
                {field.ai_value ?? '—'}
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button variant="success" onClick={handleApprove}>
                  Approve
                </Button>
                <Button variant="primary" onClick={() => setEditing(true)}>
                  Edit Value
                </Button>
                <Button variant="danger" onClick={handleReject}>
                  Reject
                </Button>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Rejection Comment (optional)
                </p>
                <input
                  type="text"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Edit Value
              </p>
              <div className="mb-2">
                <p className="text-xs text-gray-400 mb-1">AI value: {field.ai_value}</p>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="primary" onClick={handleEdit}>
                  Save & Approve
                </Button>
                <Button variant="secondary" onClick={() => {
                  setEditing(false);
                  setEditValue(field.ai_value ?? '');
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Field Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Status</dt>
          <dd className="text-gray-900 capitalize">{field.status.replace(/_/g, ' ')}</dd>
          <dt className="text-gray-500">Created</dt>
          <dd className="text-gray-900">{formatDate(field.created_at)}</dd>
          <dt className="text-gray-500">Page Reference</dt>
          <dd className="text-gray-900">{field.page_reference ?? 'N/A'}</dd>
          <dt className="text-gray-500">Verified</dt>
          <dd className="text-gray-900">{field.is_verified ? 'Yes' : 'No'}</dd>
        </dl>
      </div>
    </div>
  );
}
