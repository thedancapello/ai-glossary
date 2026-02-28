AI Glossary Builder — Project State
📍 Project Overview

Production semantic glossary search system built with:

Next.js (App Router)

OpenAI embeddings (text-embedding-3-small)

Supabase (Postgres + pgvector)

Vercel (Production deployment)

System performs vector similarity search over glossary terms.

🧠 Architecture Overview
Query Flow

User hits:

/api/search?q=...

Server:

Embeds query using OpenAI

Calls Supabase RPC function match_terms

Returns ranked similarity results

Adds confidence band (high / medium / low)

🔢 Embedding Details

Model: text-embedding-3-small

Dimension: 1536

Confirmed via:

select atttypmod
from pg_attribute
where attrelid = 'terms'::regclass
and attname = 'embedding';

→ 1536

🗄 Database Structure
Table: terms

Important columns:

id

canonical_name

summary

embedding (vector(1536))

⚙ RPC Function

Function name:

match_terms

Parameters:

query_embedding

match_threshold

match_count

Currently configured in API:

match_threshold: 0.0,
match_count: 5

Threshold temporarily set to 0.0 for full ranking visibility.

🌐 Production Deployment

Primary production URL:

https://ai-glossary-zeta.vercel.app

Search endpoint:

/api/search?q=YourQueryHere
🔐 Environment Variables (Vercel)

OPENAI_API_KEY

SUPABASE_URL

SUPABASE_SECRET_KEY

Server-side only. Not exposed to client.

✅ Confirmed Working

Embeddings generate correctly

Vector similarity search works

Similarity ranking verified (0.96 for exact match)

Threshold logic works

Confidence bands added

Vercel deploy is green

Supabase RPC operational

Backfilled embeddings partially complete

🚧 Current State

Threshold temporarily set to 0.0 for tuning

Confidence band logic added

Some terms previously had null embeddings (backfill in progress)

Frontend UI not yet fully built

No hybrid keyword + vector search yet

📌 Next Planned Improvements

Restore production threshold (likely 0.5)

Build polished search UI

Add hybrid search (vector + keyword)

Add auto-embedding trigger for new terms

Add search analytics logging

Generate summaries for empty entries

Add caching for embeddings

Improve ranking diagnostics

🔁 Recovery Instructions

If restarting development:

Pull latest repo

Ensure .env.local has:

OPENAI_API_KEY

SUPABASE_URL

SUPABASE_SECRET_KEY

Run:

npm install
npm run dev

Confirm:

/api/search?q=test
🏁 Current Stability

System is:

Architecturally sound

Production deployed

Vector search functioning

Safe in GitHub + Vercel + Supabase

🧭 Project Phase

Transitioning from:

Infrastructure wiring

To:

Feature expansion + UX polish
---

## 2026-02-28 – Production Hardening Complete

### Completed Today
- Added duplicate detection to company create endpoint (normalized_name check)
- Enforced idempotent company creation
- Added company update endpoint with automatic re-embedding
- Confirmed embedding storage and similarity search in production
- Validated full create → embed → search flow via browser testing

### Architecture Status
- Companies are first-class semantic entities
- Embeddings auto-generated on create/update
- Vector search returns ranked + confidence-scored results
- Canonical and normalized name enforcement active
- Production deployment stable on Vercel

### Planned (Next Iteration)
- Bulk ingestion endpoint (batch company inserts)
- Background queue-based embedding pipeline
- API key protection for create/update routes
- Admin UI for company management
- Automatic term ↔ company relationship linking
