'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/shared/Button';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const checkDuplicate = useCallback(async (fileName: string) => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const res = await fetch(`/api/documents?limit=100`);
    if (res.ok) {
      const json = await res.json();
      const exists = json.data.some(
        (d: { filename: string; status: string }) =>
          d.filename === fileName && d.status !== 'rejected'
      );
      if (exists) {
        setDuplicateWarning(`A document named "${fileName}" already exists in your history. You may be uploading a duplicate.`);
      } else {
        setDuplicateWarning('');
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? 'Upload failed');
        setUploading(false);
        return;
      }

      setSuccess('Document uploaded! Starting extraction...');

      const extractionRes = await fetch(`/api/extraction/${json.data.id}`, {
        method: 'POST',
      });

      if (extractionRes.ok) {
        setSuccess('Document uploaded and extraction complete!');
      } else {
        setSuccess('Document uploaded. Extraction queued.');
      }

      setTimeout(() => router.push('/review'), 1500);
    } catch {
      setError('Network error. Please try again.');
    }

    setUploading(false);
  }

  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Upload Document</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-3">
              {success}
            </div>
          )}

          {duplicateWarning && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-md p-3">
              ⚠ {duplicateWarning}
            </div>
          )}

          <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected) {
                    checkDuplicate(selected.name);
                  } else {
                    setDuplicateWarning('');
                  }
                }}
              />

              {file ? (
                <div>
                  <p className="text-lg font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setDuplicateWarning('');
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-4xl mb-2">📄</p>
                  <p className="text-lg font-medium text-gray-900">
                    Drop a PDF here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum file size: 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={!file || uploading}
            size="lg"
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload & Extract'}
          </Button>
        </form>
      </div>
    </div>
  );
}
