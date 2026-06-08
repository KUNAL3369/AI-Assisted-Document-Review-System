import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseValue(value: string | null): unknown {
  if (!value) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function formatValueDisplay(value: string | null, fieldType?: string): string {
  if (!value) return '—';

  if (fieldType === 'array' || fieldType === 'object') {
    const parsed = parseValue(value);
    if (Array.isArray(parsed)) {
      return `${parsed.length} item${parsed.length !== 1 ? 's' : ''}`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return '1 item';
    }
  }

  return value;
}

export function formatConfidence(score: number | null): string {
  if (score === null) return 'N/A';
  return `${(score * 100).toFixed(0)}%`;
}

export function confidenceColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 0.9) return 'text-green-600';
  if (score >= 0.7) return 'text-yellow-600';
  return 'text-red-600';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending_review':
    case 'pending_extraction':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'extracting':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'edited':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
