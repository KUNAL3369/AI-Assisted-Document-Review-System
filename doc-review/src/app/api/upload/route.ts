import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/guard';
import { logEvent } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Only PDF files are allowed' } },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File size must be under 10MB' } },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename: remove path separators, replace special chars
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\./g, '');
    const fileName = `${crypto.randomUUID()}-${safeName}`;

    const { error: storageError } = await adminClient.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Failed to upload file' } },
        { status: 500 }
      );
    }

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.name,
        storage_path: fileName,
        file_size_bytes: file.size,
        mime_type: file.type,
        status: 'pending_extraction',
        dummy_mode: process.env.USE_DUMMY_AI === 'true',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Failed to create document record' } },
        { status: 500 }
      );
    }

    await logEvent({
      event_type: 'document.uploaded',
      user_id: user.id,
      document_id: doc.id,
      metadata: { filename: file.name, size: file.size },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
