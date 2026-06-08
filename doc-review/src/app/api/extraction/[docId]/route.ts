import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';
import { logEvent } from '@/lib/audit/logger';
import { extractDocument } from '@/lib/ai/extractor';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await requirePermission('re_extract');
    const { docId } = await params;
    const supabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (!doc) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    if (doc.status !== 'pending_extraction' && doc.status !== 'error') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: `Cannot extract: document status is "${doc.status}", expected "pending_extraction" or "error"` } },
        { status: 409 }
      );
    }

    // Delete existing fields if re-extracting
    if (doc.status === 'error') {
      await supabase.from('extracted_fields').delete().eq('document_id', docId);
    }

    await supabase
      .from('documents')
      .update({ status: 'extracting' })
      .eq('id', docId);

    await logEvent({
      event_type: 'extraction.started',
      user_id: user.id,
      document_id: docId,
      metadata: { dummy_mode: process.env.USE_DUMMY_AI === 'true' },
    });

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', docId);

      await logEvent({
        event_type: 'extraction.failed',
        user_id: user.id,
        document_id: docId,
        metadata: { error: 'Failed to download file from storage' },
      });

      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Failed to download file' } },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    let pdfText: string;
    try {
      const { PDFParse } = await import('pdf-parse');
      const pdf = new PDFParse({ data: buffer });
      const textResult = await pdf.getText();
      pdfText = textResult.text;
      pdf.destroy();
    } catch {
      pdfText = `[PDF text extraction placeholder for: ${doc.filename}]`;
    }

    try {
      const result = await extractDocument(docId, pdfText);

      const fieldsToInsert = result.fields.map((f) => {
        const record = {
          document_id: docId,
          field_key: f.field_key,
          field_label: f.field_label,
          field_type: f.field_type,
          ai_value: f.value,
          confidence: f.confidence,
          page_reference: f.page_reference,
          source_hint: f.source_hint,
          status: 'pending_review' as const,
        };

        console.log('[FIELD_TO_DB]', JSON.stringify({
          field_key: f.field_key,
          ai_value: record.ai_value,
          ai_value_length: String(record.ai_value).length,
          confidence: record.confidence,
          source_hint: record.source_hint,
        }));

        return record;
      });

      console.log('[FIELDS_PREPARED]', JSON.stringify(fieldsToInsert, null, 2));

      const { error: insertError } = await supabase
        .from('extracted_fields')
        .upsert(fieldsToInsert, { onConflict: 'document_id,field_key' });

      console.log('[DB_INSERT_RESULT]', insertError ? `ERROR: ${insertError.message}` : 'SUCCESS');

      if (insertError) {
        throw new Error(`Failed to insert fields: ${insertError.message}`);
      }

      await supabase
        .from('documents')
        .update({
          status: 'pending_review',
          ai_model_used: result.model_used,
          ai_token_count: result.token_count,
          ai_cost_usd: result.cost_usd,
          dummy_mode: process.env.USE_DUMMY_AI === 'true',
        })
        .eq('id', docId);

      await logEvent({
        event_type: 'extraction.completed',
        user_id: user.id,
        document_id: docId,
        metadata: {
          model_used: result.model_used,
          field_count: result.fields.length,
          avg_confidence: result.confidence_avg,
          token_count: result.token_count,
          cost_usd: result.cost_usd,
        },
      });

      return NextResponse.json({
        data: {
          document_id: docId,
          field_count: result.fields.length,
          confidence_avg: result.confidence_avg,
          model_used: result.model_used,
        },
      }, { status: 200 });
    } catch (error) {
      console.error(error);

      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', docId);

      await logEvent({
        event_type: 'extraction.failed',
        user_id: user.id,
        document_id: docId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Extraction failed"
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
