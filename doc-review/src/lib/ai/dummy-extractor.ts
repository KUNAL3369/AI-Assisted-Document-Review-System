import type { ExtractionResult, ExtractedFieldInput } from './types';

const INVOICE_SEEDS: Record<string, ExtractedFieldInput[]> = {
  default: [
    { field_key: 'invoice_number', field_label: 'Invoice Number', field_type: 'text', value: 'INV-001', confidence: 0.97, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'vendor_name', field_label: 'Vendor Name', field_type: 'text', value: 'Acme Corp', confidence: 0.99, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'vendor_address', field_label: 'Vendor Address', field_type: 'text', value: '123 Business Blvd, Suite 400, New York, NY 10001', confidence: 0.88, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'invoice_date', field_label: 'Invoice Date', field_type: 'date', value: '2024-11-15', confidence: 0.95, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'due_date', field_label: 'Due Date', field_type: 'date', value: '2024-12-15', confidence: 0.94, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'po_number', field_label: 'PO Number', field_type: 'text', value: 'PO-8842-A', confidence: 0.85, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'subtotal', field_label: 'Subtotal', field_type: 'currency', value: '12500.00', confidence: 0.96, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'tax_amount', field_label: 'Tax Amount', field_type: 'currency', value: '1250.00', confidence: 0.93, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'total_amount', field_label: 'Total Amount', field_type: 'currency', value: '13750.00', confidence: 0.97, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'currency', field_label: 'Currency', field_type: 'text', value: 'USD', confidence: 0.99, page_reference: 1, source_hint: 'dummy' },
    { field_key: 'line_items', field_label: 'Line Items', field_type: 'text', value: JSON.stringify([{ description: 'Server Hardware', quantity: 2, unit_price: 6250.00, total: 12500.00 }]), confidence: 0.90, page_reference: 1, source_hint: 'dummy' },
  ],
};

export async function dummyExtract(documentId: string): Promise<ExtractionResult> {
  const fields = INVOICE_SEEDS.default.map((f) => ({
    ...f,
  }));

  const confidence_avg =
    fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;

  return {
    document_id: documentId,
    fields,
    model_used: 'dummy',
    token_count: 0,
    cost_usd: 0,
    confidence_avg: Math.round(confidence_avg * 1000) / 1000,
  };
}
