'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatFileSize, getStatusColor } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import type { Document } from '@/lib/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadDocuments = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const url = statusFilter ? `/api/documents?status=${statusFilter}` : '/api/documents';
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      setDocuments(json.data);
      setFetchError('');
    } else {
      const json = await res.json().catch(() => ({}));
      setFetchError(json.error?.message ?? 'Failed to load documents');
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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

  const statuses = ['', 'pending_extraction', 'pending_review', 'approved', 'rejected', 'error'];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <Link href="/upload">
          <Button variant="primary">Upload New</Button>
        </Link>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {fetchError}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {!fetchError && documents.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-lg font-medium text-gray-900">No documents found</p>
          <Link href="/upload" className="mt-4 inline-block text-blue-600 hover:text-blue-500 text-sm font-medium">
            Upload your first document →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-medium text-gray-600">Filename</th>
                <th className="p-3 text-left font-medium text-gray-600">Status</th>
                <th className="p-3 text-left font-medium text-gray-600">Size</th>
                <th className="p-3 text-left font-medium text-gray-600">Mode</th>
                <th className="p-3 text-left font-medium text-gray-600">Uploaded</th>
                <th className="p-3 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900 max-w-[250px] truncate">
                    {doc.filename}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                      {doc.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{formatFileSize(doc.file_size_bytes)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${doc.dummy_mode ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                      {doc.dummy_mode ? 'Dummy' : 'Live'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{formatDate(doc.created_at)}</td>
                  <td className="p-3">
                    <Link href={`/documents/${doc.id}`}>
                      <Button variant="primary" size="sm">View</Button>
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
