# AI-Assisted Document Review System

A human-in-the-loop document processing application. Upload PDFs, AI extracts structured fields, human reviewers approve/edit/reject, and only approved data proceeds.

## Stack

- **Frontend:** Next.js 14 App Router, React, Tailwind CSS
- **Backend:** Next.js API Routes (no separate server)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Google Gemini 1.5 Flash (with dummy mode for development)
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI (optional, for local development)
- A Supabase project (free tier)

### Setup

1. **Clone and install**

```bash
git clone <repo-url> doc-review
cd doc-review
npm install
```

2. **Environment variables**

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required values:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase service-role key (admin)

Optional:
- `USE_DUMMY_AI=true` — Set to `true` to bypass Gemini and use seeded dummy data
- `GEMINI_API_KEY` — Only needed when `USE_DUMMY_AI=false`

3. **Database setup**

Run the schema against your Supabase database:

```bash
# Option A: Supabase Dashboard
# Open your Supabase project → SQL Editor → Paste contents of supabase/schema.sql → Run

# Option B: Supabase CLI
supabase db push supabase/schema.sql
```

4. **Supabase email confirmation (local dev)**

By default, Supabase requires email confirmation before users can log in. For local development, disable this:

1. Go to your Supabase Dashboard → **Authentication** → **Settings**
2. Under **Email Confirmations**, turn off **Enable email confirmations**
3. Click **Save**

(If you leave it enabled, after signup you must check the user's email inbox and click the confirmation link before logging in.)

---

5. **Create your first user**

Start the app:

```bash
npm run dev
```

Visit `http://localhost:3000/signup` and create an account. Then promote yourself to administrator by running this SQL in the Supabase SQL Editor:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "administrator"}'::jsonb
WHERE email = 'your@email.com';
```

6. **Seed dummy data (optional)**

```bash
npx tsx scripts/seed.ts
```

This creates 5 sample invoices with varying statuses for testing.

7. **Start developing**

```bash
npm run dev
```

## Architecture

### Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup pages
│   ├── (dashboard)/     # Protected pages (dashboard, upload, review, etc.)
│   └── api/             # All API routes
├── components/
│   ├── ui/              # Atomic UI components
│   ├── layout/          # Sidebar, topbar, shell
│   ├── review/          # Review-specific components
│   └── ...              # Feature-specific components
├── lib/
│   ├── supabase/        # Supabase client factories
│   ├── ai/              # AI extraction (dummy + Gemini)
│   ├── auth/            # Auth guards, session helpers
│   ├── audit/           # Audit logger
│   └── validation/      # Zod schemas
└── styles/
```

### Key Design Decisions

- **No separate backend** — Next.js API routes handle everything
- **Supabase Auth** — email/password with session cookies via `@supabase/ssr`
- **Row Level Security** — enforced at the database level; API routes also check permissions
- **Dual-mode AI** — `USE_DUMMY_AI=true` returns seeded data; `false` calls Gemini 1.5 Flash
- **Audit trail** — every significant event logged to `audit_logs` table
- **Cost tracking** — token count and estimated cost stored per document

### Roles

| Role | Capabilities |
|---|---|
| Operations Executive | Upload, view, approve/edit/reject individual fields |
| Team Lead | All above + batch actions, document rejection, re-extraction, view logs/cost |
| Administrator | All above + user management, document deletion |

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/upload` | Upload PDF |
| GET | `/api/documents` | List documents |
| GET | `/api/documents/[id]` | Document detail + fields |
| POST | `/api/documents/[id]/reject` | Reject entire document |
| GET | `/api/fields` | List extracted fields |
| GET | `/api/fields/[id]` | Field detail |
| POST | `/api/fields/[id]/approve` | Approve field |
| PUT | `/api/fields/[id]/edit` | Edit field value |
| POST | `/api/fields/[id]/reject` | Reject field |
| POST | `/api/fields/batch` | Batch approve/reject |
| POST | `/api/extraction/[id]` | Trigger AI extraction |
| GET | `/api/extraction/[id]/cost` | Per-document cost breakdown |
| GET | `/api/logs` | Audit trail |
| GET/PUT | `/api/team` | User management (admin) |
| GET | `/api/stats` | Dashboard statistics |

## Deployment

1. Push to GitHub
2. Import to Vercel
3. Set all environment variables in Vercel Dashboard
4. Deploy

Ensure your Supabase project's IP is allowlisted if needed, and run `supabase/schema.sql` against the production database before deploying.
