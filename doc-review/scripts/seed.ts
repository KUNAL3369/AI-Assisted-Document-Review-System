/**
 * Seed script — inserts 5 dummy documents + extracted fields.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires these env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The script uses the service-role key to bypass RLS.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// We need a real user to set as user_id. Use the first user from auth.users,
// or create a placeholder reference. For seed purposes, we'll query an existing user.
async function getOrCreateSeedUser(): Promise<string> {
  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (!error && users?.users && users.users.length > 0) {
    return users.users[0].id;
  }

  // If no users exist, create one
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email: 'seed@docreview.local',
    password: 'seedpassword123',
    email_confirm: true,
    user_metadata: { role: 'administrator' },
  });

  if (createError || !data?.user) {
    throw new Error(`Failed to create seed user: ${createError?.message ?? 'unknown'}`);
  }

  return data.user.id;
}

interface SeedField {
  field_key: string;
  field_label: string;
  field_type: string;
  value: string;
  confidence: number;
}

interface SeedDocument {
  filename: string;
  status: string;
  fields: SeedField[];
  rejection_reason?: string;
}

const SEED_DATA: SeedDocument[] = [
  {
    // Doc 1 — freshly uploaded, no extraction yet
    filename: 'invoice_acme_corp.pdf',
    status: 'pending_extraction',
    fields: [],
  },
  {
    // Doc 2 — standard pending review
    filename: 'invoice_globex_inc.pdf',
    status: 'pending_review',
    fields: [
      { field_key: 'invoice_number', field_label: 'Invoice Number', field_type: 'text', value: 'GLX-2024-0891', confidence: 0.97 },
      { field_key: 'vendor_name', field_label: 'Vendor Name', field_type: 'text', value: 'Globex Inc.', confidence: 0.99 },
      { field_key: 'vendor_address', field_label: 'Vendor Address', field_type: 'text', value: '4510 Market St, San Francisco, CA 94102', confidence: 0.88 },
      { field_key: 'invoice_date', field_label: 'Invoice Date', field_type: 'date', value: '2024-11-15', confidence: 0.95 },
      { field_key: 'due_date', field_label: 'Due Date', field_type: 'date', value: '2024-12-15', confidence: 0.94 },
      { field_key: 'po_number', field_label: 'PO Number', field_type: 'text', value: 'PO-8842-A', confidence: 0.85 },
      { field_key: 'subtotal', field_label: 'Subtotal', field_type: 'currency', value: '12500.00', confidence: 0.96 },
      { field_key: 'tax_amount', field_label: 'Tax Amount', field_type: 'currency', value: '1250.00', confidence: 0.93 },
      { field_key: 'total_amount', field_label: 'Total Amount', field_type: 'currency', value: '13750.00', confidence: 0.97 },
      { field_key: 'currency', field_label: 'Currency', field_type: 'text', value: 'USD', confidence: 0.99 },
      { field_key: 'line_items', field_label: 'Line Items', field_type: 'text', value: JSON.stringify([{ description: 'Server Hardware', quantity: 2, unit_price: 6250.00, total: 12500.00 }]), confidence: 0.90 },
    ],
  },
  {
    // Doc 3 — low confidence, needs careful review
    filename: 'invoice_initech_ltd.pdf',
    status: 'pending_review',
    fields: [
      { field_key: 'invoice_number', field_label: 'Invoice Number', field_type: 'text', value: '404-INT-22', confidence: 0.72 },
      { field_key: 'vendor_name', field_label: 'Vendor Name', field_type: 'text', value: 'Initech Ltd', confidence: 0.95 },
      { field_key: 'vendor_address', field_label: 'Vendor Address', field_type: 'text', value: '742 Evergreen Terr, Austin, TX', confidence: 0.78 },
      { field_key: 'invoice_date', field_label: 'Invoice Date', field_type: 'date', value: '2024-10-01', confidence: 0.85 },
      { field_key: 'due_date', field_label: 'Due Date', field_type: 'date', value: '2024-10-31', confidence: 0.82 },
      { field_key: 'po_number', field_label: 'PO Number', field_type: 'text', value: '', confidence: 0.65 },
      { field_key: 'subtotal', field_label: 'Subtotal', field_type: 'currency', value: '8750.00', confidence: 0.91 },
      { field_key: 'tax_amount', field_label: 'Tax Amount', field_type: 'currency', value: '700.00', confidence: 0.88 },
      { field_key: 'total_amount', field_label: 'Total Amount', field_type: 'currency', value: '9450.00', confidence: 0.90 },
      { field_key: 'currency', field_label: 'Currency', field_type: 'text', value: 'USD', confidence: 0.98 },
      { field_key: 'line_items', field_label: 'Line Items', field_type: 'text', value: JSON.stringify([{ description: 'Software Licenses', quantity: 10, unit_price: 875.00, total: 8750.00 }]), confidence: 0.75 },
    ],
  },
  {
    // Doc 4 — already fully approved
    filename: 'invoice_umbrella_corp.pdf',
    status: 'approved',
    fields: [
      { field_key: 'invoice_number', field_label: 'Invoice Number', field_type: 'text', value: 'UC-2024-772', confidence: 0.98 },
      { field_key: 'vendor_name', field_label: 'Vendor Name', field_type: 'text', value: 'Umbrella Corporation', confidence: 0.99 },
      { field_key: 'vendor_address', field_label: 'Vendor Address', field_type: 'text', value: '100 Raccoon St, Raccoon City, MI', confidence: 0.92 },
      { field_key: 'invoice_date', field_label: 'Invoice Date', field_type: 'date', value: '2024-09-01', confidence: 0.97 },
      { field_key: 'due_date', field_label: 'Due Date', field_type: 'date', value: '2024-10-01', confidence: 0.96 },
      { field_key: 'po_number', field_label: 'PO Number', field_type: 'text', value: 'PO-5512-B', confidence: 0.88 },
      { field_key: 'subtotal', field_label: 'Subtotal', field_type: 'currency', value: '22000.00', confidence: 0.97 },
      { field_key: 'tax_amount', field_label: 'Tax Amount', field_type: 'currency', value: '2200.00', confidence: 0.94 },
      { field_key: 'total_amount', field_label: 'Total Amount', field_type: 'currency', value: '24200.00', confidence: 0.98 },
      { field_key: 'currency', field_label: 'Currency', field_type: 'text', value: 'USD', confidence: 0.99 },
      { field_key: 'line_items', field_label: 'Line Items', field_type: 'text', value: JSON.stringify([{ description: 'Biochemical Analyzer', quantity: 1, unit_price: 22000.00, total: 22000.00 }]), confidence: 0.93 },
    ],
  },
  {
    // Doc 5 — rejected
    filename: 'invoice_cyberdyne.pdf',
    status: 'rejected',
    rejection_reason: 'Duplicate invoice — already paid under PO-9012',
    fields: [
      { field_key: 'invoice_number', field_label: 'Invoice Number', field_type: 'text', value: 'CYD-2024-003', confidence: 0.96 },
      { field_key: 'vendor_name', field_label: 'Vendor Name', field_type: 'text', value: 'Cyberdyne Systems', confidence: 0.99 },
      { field_key: 'vendor_address', field_label: 'Vendor Address', field_type: 'text', value: '742 Skynet Ave, Palo Alto, CA', confidence: 0.87 },
      { field_key: 'invoice_date', field_label: 'Invoice Date', field_type: 'date', value: '2024-08-15', confidence: 0.94 },
      { field_key: 'due_date', field_label: 'Due Date', field_type: 'date', value: '2024-09-14', confidence: 0.93 },
      { field_key: 'po_number', field_label: 'PO Number', field_type: 'text', value: 'PO-9012', confidence: 0.91 },
      { field_key: 'subtotal', field_label: 'Subtotal', field_type: 'currency', value: '15000.00', confidence: 0.96 },
      { field_key: 'tax_amount', field_label: 'Tax Amount', field_type: 'currency', value: '1500.00', confidence: 0.92 },
      { field_key: 'total_amount', field_label: 'Total Amount', field_type: 'currency', value: '16500.00', confidence: 0.97 },
      { field_key: 'currency', field_label: 'Currency', field_type: 'text', value: 'USD', confidence: 0.99 },
      { field_key: 'line_items', field_label: 'Line Items', field_type: 'text', value: JSON.stringify([{ description: 'AI Processor Unit', quantity: 3, unit_price: 5000.00, total: 15000.00 }]), confidence: 0.88 },
    ],
  },
];

async function seed() {
  console.log('Starting seed...\n');

  const userId = await getOrCreateSeedUser();
  console.log(`Using user: ${userId}\n`);

  // Create documents and their fields
  for (const [index, seedDoc] of SEED_DATA.entries()) {
    console.log(`[${index + 1}/${SEED_DATA.length}] Creating: ${seedDoc.filename}`);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        filename: seedDoc.filename,
        storage_path: `seed/${seedDoc.filename}`,
        file_size_bytes: 1024 * 50, // 50KB placeholder
        mime_type: 'application/pdf',
        status: seedDoc.status,
        dummy_mode: true,
        page_count: 1,
        ai_model_used: seedDoc.fields.length > 0 ? 'dummy' : null,
        ai_token_count: 0,
        ai_cost_usd: 0,
        rejection_reason: seedDoc.rejection_reason ?? null,
      })
      .select()
      .single();

    if (docError) {
      console.error(`  Failed to create document: ${docError.message}`);
      continue;
    }

    console.log(`  Document ID: ${doc.id}`);

    // Insert extracted fields if any
    if (seedDoc.fields.length > 0) {
      const now = new Date().toISOString();
      const isReviewed = seedDoc.status === 'approved' || seedDoc.status === 'rejected';
      const fieldStatus = seedDoc.status === 'pending_review' ? 'pending_review'
        : seedDoc.status === 'approved' ? 'approved'
        : 'rejected';

      const fieldsToInsert = seedDoc.fields.map((f) => ({
        document_id: doc.id,
        field_key: f.field_key,
        field_label: f.field_label,
        field_type: f.field_type,
        ai_value: f.value || null,
        confidence: f.confidence,
        status: fieldStatus,
        source_hint: 'dummy',
        page_reference: 1,
        reviewed_by: isReviewed ? userId : null,
        reviewed_at: isReviewed ? now : null,
        is_verified: isReviewed,
      }));

      const { error: fieldsError } = await supabase
        .from('extracted_fields')
        .insert(fieldsToInsert);

      if (fieldsError) {
        console.error(`  Failed to insert fields: ${fieldsError.message}`);
      } else {
        console.log(`  Inserted ${seedDoc.fields.length} fields`);
      }

      // Insert review actions for approved/rejected docs
      if (isReviewed) {
        const reviewActions = seedDoc.fields.map((f) => ({
          field_id: '', // will be set below
          document_id: doc.id,
          action: seedDoc.status === 'approved' ? 'approve' : 'reject',
          user_id: userId,
          previous_value: f.value || null,
          comment: seedDoc.status === 'rejected' ? seedDoc.rejection_reason ?? 'Document rejected' : null,
        }));

        const { data: insertedFields } = await supabase
          .from('extracted_fields')
          .select('id')
          .eq('document_id', doc.id);

        if (insertedFields) {
          reviewActions.forEach((ra, i) => {
            ra.field_id = insertedFields[i]?.id ?? '';
          });

          const { error: actionError } = await supabase
            .from('review_actions')
            .insert(reviewActions);

          if (actionError) {
            console.error(`  Failed to insert review actions: ${actionError.message}`);
          } else {
            console.log(`  Inserted ${reviewActions.length} review actions`);
          }
        }
      }
    }

    console.log('');
  }

  console.log('Seed complete!');
  console.log('\nCreated 5 documents:');
  SEED_DATA.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.filename} — ${d.status}${d.fields.length > 0 ? ` (${d.fields.length} fields)` : ' (no fields)'}`);
  });
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
