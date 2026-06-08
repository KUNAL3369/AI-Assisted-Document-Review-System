'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/lib/types';

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const loadLogs = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const url = eventFilter ? `/api/logs?event_type=${eventFilter}&limit=100` : '/api/logs?limit=100';
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      setLogs(json.data);
      setFetchError('');
    } else {
      const json = await res.json().catch(() => ({}));
      setFetchError(json.error?.message ?? 'Failed to load audit logs');
    }
    setLoading(false);
  }, [eventFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const sortedLogs = [...logs].sort((a, b) => {
    const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortAsc ? cmp : -cmp;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const eventTypes = [
    '', 'document.uploaded', 'extraction.started', 'extraction.completed',
    'extraction.failed', 'field.approved', 'field.edited', 'field.rejected',
    'document.approved', 'document.rejected',
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          {sortAsc ? '↑ Oldest first' : '↓ Newest first'}
        </button>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {fetchError}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {eventTypes.map((et) => (
          <button
            key={et}
            onClick={() => setEventFilter(et)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              eventFilter === et
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {et ? et : 'All Events'}
          </button>
        ))}
      </div>

      {!fetchError && sortedLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-medium text-gray-900">No audit logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {sortedLogs.map((log) => {
              const isDummy = log.metadata?.dummy_mode === true || log.metadata?.model_used === 'dummy';
              return (
                <div key={log.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {log.event_type}
                        </span>
                        {log.metadata && (log.metadata.model_used || log.metadata.dummy_mode !== undefined) && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${isDummy ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                            {isDummy ? 'Dummy' : 'Live'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {log.user_id ? `User: ${log.user_id.substring(0, 8)}...` : 'System'}
                        {log.document_id && ` · Doc: ${log.document_id.substring(0, 8)}...`}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="text-xs text-gray-400 mt-1 bg-gray-50 p-2 rounded max-w-xl overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 1)}
                        </pre>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
