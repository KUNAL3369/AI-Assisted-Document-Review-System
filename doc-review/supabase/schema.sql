-- =====================================================
-- AI-Assisted Document Review System — Database Schema
-- =====================================================
-- Run this against Supabase SQL Editor or via:
--   supabase db push supabase/schema.sql
-- =====================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "moddatetime";

--------------------------------------------------------------
-- ENUMS
--------------------------------------------------------------
create type document_status as enum (
    'pending_extraction',
    'extracting',
    'pending_review',
    'approved',
    'rejected',
    'error'
);

create type field_status as enum (
    'pending_review',
    'approved',
    'edited',
    'rejected'
);

create type audit_event_type as enum (
    'document.uploaded',
    'document.deleted',
    'extraction.started',
    'extraction.completed',
    'extraction.failed',
    'field.approved',
    'field.edited',
    'field.rejected',
    'document.approved',
    'document.rejected',
    'user.login',
    'user.logout',
    'user.role_changed',
    'ai.usage_recorded'
);

create type user_role as enum ('operations_executive', 'team_lead', 'administrator');

--------------------------------------------------------------
-- TABLES
--------------------------------------------------------------

-- Documents (uploaded PDFs)
create table documents (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    filename        text not null,
    storage_path    text not null,
    file_size_bytes integer not null,
    mime_type       text not null default 'application/pdf',
    status          document_status not null default 'pending_extraction',
    page_count      smallint,
    ai_model_used   text,
    ai_token_count  integer,
    ai_cost_usd     numeric(12,8),
    dummy_mode      boolean not null default false,
    rejection_reason text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint filename_length check (char_length(filename) > 0 and char_length(filename) <= 512)
);

create index idx_documents_status on documents(status);
create index idx_documents_user_id on documents(user_id);

-- Extracted fields (AI output, reviewed by humans)
create table extracted_fields (
    id              uuid primary key default gen_random_uuid(),
    document_id     uuid not null references documents(id) on delete cascade,
    field_key       text not null,
    field_label     text not null,
    field_type      text not null default 'text',
    ai_value        text,
    -- future: add ai_value_json jsonb for structured field data (line_items, etc.)
    -- while keeping ai_value text for backward-compatible display
    confidence      numeric(4,3),
    status          field_status not null default 'pending_review',
    reviewed_by     uuid references auth.users(id),
    reviewed_at     timestamptz,
    human_value     text,
    source_hint     text,
    page_reference  smallint,
    bounding_box    jsonb,
    is_verified     boolean not null default false,
    rejection_comment text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (document_id, field_key)
);

create index idx_fields_document_id on extracted_fields(document_id);
create index idx_fields_status on extracted_fields(status);
create index idx_fields_doc_status on extracted_fields(document_id, status);

-- Review actions (append-only log of human decisions)
create table review_actions (
    id              uuid primary key default gen_random_uuid(),
    field_id        uuid not null references extracted_fields(id) on delete cascade,
    document_id     uuid not null references documents(id) on delete cascade,
    action          text not null check (action in ('approve', 'edit', 'reject')),
    user_id         uuid not null references auth.users(id),
    previous_value  text,
    new_value       text,
    comment         text,
    created_at      timestamptz not null default now()
);

create index idx_review_actions_field_id on review_actions(field_id);
create index idx_review_actions_user_id on review_actions(user_id);

-- Audit logs (every significant event)
create table audit_logs (
    id              uuid primary key default gen_random_uuid(),
    event_type      audit_event_type not null,
    user_id         uuid references auth.users(id),
    document_id     uuid references documents(id),
    field_id        uuid references extracted_fields(id),
    ip_address      inet,
    user_agent      text,
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);

create index idx_audit_logs_event_type on audit_logs(event_type);
create index idx_audit_logs_user_id on audit_logs(user_id);
create index idx_audit_logs_document_id on audit_logs(document_id);
create index idx_audit_logs_created_at on audit_logs(created_at desc);

--------------------------------------------------------------
-- TRIGGERS
--------------------------------------------------------------
create trigger handle_updated_at before update on documents
    for each row execute function moddatetime(updated_at);

create trigger handle_updated_at before update on extracted_fields
    for each row execute function moddatetime(updated_at);

--------------------------------------------------------------
-- ROW LEVEL SECURITY
--------------------------------------------------------------
alter table documents enable row level security;
alter table extracted_fields enable row level security;
alter table review_actions enable row level security;
alter table audit_logs enable row level security;

-- Documents: all authenticated users can view
create policy "Authenticated users can view documents"
    on documents for select using (auth.role() = 'authenticated');

-- Documents: any authenticated user can upload
create policy "Authenticated users can upload documents"
    on documents for insert with check (auth.role() = 'authenticated');

-- Documents: admin and team_lead can update
create policy "Admin and team_lead can update documents"
    on documents for update using (
        (auth.jwt() -> 'user_metadata' ->> 'role') in ('administrator', 'team_lead')
    );

-- Extracted fields: all authenticated users can view
create policy "Authenticated users can view extracted fields"
    on extracted_fields for select using (auth.role() = 'authenticated');

-- Extracted fields: admin and team_lead can insert (from extraction)
create policy "Admin and team_lead can insert extracted fields"
    on extracted_fields for insert with check (
        auth.jwt() -> 'user_metadata' ->> 'role' in ('administrator', 'team_lead')
    );

-- Extracted fields: all authenticated users can update (for review actions)
create policy "Authenticated users can update extracted fields"
    on extracted_fields for update using (auth.role() = 'authenticated');

-- Review actions: all authenticated users can insert
create policy "Authenticated users can insert review actions"
    on review_actions for insert with check (auth.role() = 'authenticated');

-- Review actions: all authenticated users can view
create policy "Authenticated users can view review actions"
    on review_actions for select using (auth.role() = 'authenticated');

-- Audit logs: admin and team_lead can insert
create policy "Admin and team_lead can insert audit logs"
    on audit_logs for insert with check (
        auth.jwt() -> 'user_metadata' ->> 'role' in ('administrator', 'team_lead')
    );

-- Audit logs: admin and team_lead can view
create policy "Admin and team_lead can view audit logs"
    on audit_logs for select using (
        auth.jwt() -> 'user_metadata' ->> 'role' in ('administrator', 'team_lead')
    );
