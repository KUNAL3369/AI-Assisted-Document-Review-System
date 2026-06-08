import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * After a field review action, check if all pending_review fields
 * for the document have been resolved. If so, update the document
 * status to `approved`.
 */
export async function recalculateDocumentStatus(
  documentId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { count } = await supabase
    .from('extracted_fields')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('status', 'pending_review');

  if (count === 0) {
    await supabase
      .from('documents')
      .update({ status: 'approved' })
      .eq('id', documentId);
  }
}
