'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatFileSize, getStatusColor, formatConfidence, confidenceColor } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import type { Document, ExtractedField } from '@/lib/types';

export default function DocumentDetailPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const [doc, setDocument] = useState<Document | null>(null);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const res = await fetch(`/api/documents/${params.docId}`);
    if (res.ok) {
      const json = await res.json();
      setDocument(json.data.document);
      setFields(json.data.fields);
      setFetchError('');
    } else {
      const json = await res.json().catch(() => ({}));
      setFetchError(json.error?.message ?? 'Failed to load document');
    }
    setLoading(false);
  }, [params.docId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReject() {
    if (!rejectReason.trim()) return;

    const res = await fetch(`/api/documents/${params.docId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      setDocument((prev) => prev ? { ...prev, status: 'rejected', rejection_reason: rejectReason } : null);
      setActionMsg('Document rejected');
      setActionError('');
      setShowRejectModal(false);
      setRejectReason('');
    } else {
      setActionError(json.error?.message ?? 'Failed to reject document');
    }
  }

  async function handleReExtract() {
    const res = await fetch(`/api/extraction/${params.docId}`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      setActionMsg('Re-extraction started! Refreshing...');
      setActionError('');
      setTimeout(() => router.refresh(), 1000);
    } else {
      setActionError(json.error?.message ?? 'Re-extraction failed');
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

  if (fetchError || !doc) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/documents')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
          ← Back to Documents
        </button>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-lg font-medium text-gray-900">
            {fetchError || 'Document not found'}
          </p>
        </div>
      </div>
    );
  }

  const isCompleted = doc.status === 'approved' || doc.status === 'rejected';

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.push('/documents')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Back to Documents
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{doc.filename}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Uploaded {formatDate(doc.created_at)} · {formatFileSize(doc.file_size_bytes)}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(doc.status)}`}>
          {doc.status.replace(/_/g, ' ')}
        </span>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pages</p>
          <p className="text-lg font-semibold text-gray-900">{doc.page_count ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">AI Model</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${doc.dummy_mode ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
            {doc.ai_model_used ?? (doc.dummy_mode ? 'dummy' : '—')}
          </span>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Tokens</p>
          <p className="text-lg font-semibold text-gray-900">{doc.ai_token_count ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Cost</p>
          <p className="text-lg font-semibold text-gray-900">
            {doc.ai_cost_usd ? `$${doc.ai_cost_usd.toFixed(8)}` : '—'}
          </p>
        </div>
      </div>

      {isCompleted ? (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-4 mb-6 text-center">
          {doc.status === 'approved'
            ? 'All fields have been reviewed and the document is approved.'
            : 'This document has been rejected.'}
        </div>
      ) : (
        <div className="flex gap-3 mb-6">
          {doc.status === 'pending_review' && (
            <Button variant="danger" onClick={() => setShowRejectModal(true)}>
              Reject Document
            </Button>
          )}
          <Button variant="warning" onClick={handleReExtract}>
            Re-Extract
          </Button>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reject Document</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will reject the document and all its pending fields. This action cannot be undone.
            </p>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleReject} disabled={!rejectReason.trim()}>
                Confirm Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      {doc.rejection_reason && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-6">
          Rejection reason: {doc.rejection_reason}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Extracted Fields ({fields.length})</h2>
        </div>

        {fields.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No fields extracted yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-medium text-gray-600">Field</th>
                <th className="p-3 text-left font-medium text-gray-600">AI Value</th>
                <th className="p-3 text-left font-medium text-gray-600">Human Value</th>
                <th className="p-3 text-left font-medium text-gray-600">Confidence</th>
                <th className="p-3 text-left font-medium text-gray-600">Status</th>
                <th className="p-3 text-left font-medium text-gray-600">Source</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <span className="font-medium text-gray-900">{f.field_label}</span>
                    <span className="text-gray-400 ml-1 text-xs">{f.field_key}</span>
                  </td>
                  <td className="p-3 text-gray-900 font-mono text-xs max-w-[150px] truncate">
                    {f.ai_value ?? '—'}
                  </td>
                  <td className="p-3 text-gray-900 font-mono text-xs max-w-[150px] truncate">
                    {f.human_value ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className={`p-3 font-medium ${confidenceColor(f.confidence)}`}>
                    {formatConfidence(f.confidence)}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(f.status)}`}>
                      {f.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${f.source_hint === 'dummy' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                      {f.source_hint ?? '—'}
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
