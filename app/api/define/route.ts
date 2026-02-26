import { z } from "zod";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeTerm } from "@/lib/normalize";

export const runtime = "nodejs";
const ALLOWED_CATEGORIES = [
  "Models",
  "Compute",
  "Data",
  "Tooling & DevOps",
  "Applications",
  "Safety & Governance",
  "Business & Market Structure",
] as const;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

function coerceCategory(input: string): AllowedCategory {
  const s = (input || "").toLowerCase();

  if (s.includes("model")) return "Models";
  if (s.includes("compute") || s.includes("infra")) return "Compute";
  if (s.includes("data") || s.includes("database") || s.includes("vector")) return "Data";
  if (s.includes("tool") || s.includes("devops") || s.includes("platform")) return "Tooling & DevOps";
  if (s.includes("app")) return "Applications";
  if (s.includes("safety") || s.includes("govern")) return "Safety & Governance";
  if (s.includes("market") || s.includes("business")) return "Business & Market Structure";

  return "Tooling & DevOps";
}

const Body = z.object({
  term: z.string().min(1),
  user_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    console.log("DEFINE ROUTE HIT");

    const { term, user_id } = Body.parse(await req.json());
    console.log("Incoming term:", term);

    const normalized_name = normalizeTerm(term);

    // 1) Check if term exists
    const existing = await supabaseAdmin
      .from("terms")
      .select("id, canonical_name, normalized_name, current_version_id")
      .eq("normalized_name", normalized_name)
      .maybeSingle();

    if (existing.error) {
      console.error("Supabase existing lookup error:", existing.error);
      return Response.json({ error: existing.error.message }, { status: 500 });
    }

const exists = !!existing.data;
const term_id = existing.data?.id ?? null;

// 2) Call OpenAI (Structured JSON Mode - SDK Safe)
const resp = await openai.responses.create({
  model: "gpt-5.2",
  input: [
    {
      role: "system",
      content:
        "You are a senior AI industry analyst producing operator-grade strategic intelligence."
    },
    {
      role: "user",
      content: `
Define the AI ecosystem term: "${term}"

Return a JSON object with this exact structure:

{
  "term": {
    "canonical_name": string,
    "category_primary": string,
    "summary": string,
    "definition_md": string (max 750 words),
    "strategic_importance": string
  },
  "companies": [
    {
      "name": string,
      "public": boolean | null,
      "revenue_estimate": number | null,
      "funding_raised": number | null,
      "description": string
    }
  ]
}

If no companies apply, return an empty array.
Use inference where appropriate.
`
    }
  ]
});

const data = JSON.parse(resp.output_text || "{}");
const canonical_name = exists && existing.data
  ? String(existing.data.canonical_name ?? term).trim()
  : String(data.canonical_name ?? term).trim();
const summary = String(data.summary ?? "").trim();
// Generate embedding for semantic search
const category_primary = coerceCategory(data.category_primary ?? "");
    const definition_md = String(data.definition_md ?? "").trim();
// Generate embedding for semantic search
const embeddingResponse = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: `${canonical_name}\n\n${definition_md}`,
});

const embedding = embeddingResponse.data[0].embedding;
let finalTerm = existing?.data ?? null;

if (!exists) {
  // 3) Insert term
  const insertedTerm = await supabaseAdmin
    .from("terms")
    .insert({
      canonical_name,
      normalized_name,
      summary,
      category_primary,
      embedding,
created_by: user_id ?? null,
    })
    .select()
    .single();

  if (insertedTerm.error) {
    console.error("Supabase insert term error:", insertedTerm.error);
    return Response.json({ error: insertedTerm.error.message }, { status: 500 });
  }

  finalTerm = insertedTerm.data;
}
    // 4) Insert version
    const insertedVersion = await supabaseAdmin
      .from("term_versions")
      .insert({
        term_id: finalTerm!.id,
        editor_user_id: user_id ?? null,
        definition_md,
        summary,
        category_primary,
      })
      .select()
      .single();

    if (insertedVersion.error) {
      console.error("Supabase insert version error:", insertedVersion.error);
      return Response.json({ error: insertedVersion.error.message }, { status: 500 });
    }

    // 5) Update current_version_id + sync summary/category
    const updatedTerm = await supabaseAdmin
      .from("terms")
.update({
  current_version_id: insertedVersion.data.id,
  summary,
  category_primary,
  embedding,
})
      .eq("id", finalTerm!.id)
      .select()
      .single();

    if (updatedTerm.error) {
      console.error("Supabase update term error:", updatedTerm.error);
      return Response.json({ error: updatedTerm.error.message }, { status: 500 });
    }
// 5) Upsert companies and link to term
const companies = data.companies || [];

for (const company of companies) {
  if (!company?.name) continue;

  const normalizedCompany = company.name.trim().toLowerCase();

  // Upsert company
  const { data: upsertedCompany, error: companyError } =
    await supabaseAdmin
      .from("companies")
      .upsert(
        {
          name: company.name.trim(),
          normalized_name: normalizedCompany,
          public: company.public ?? null,
          revenue_estimate: company.revenue_estimate ?? null,
          funding_raised: company.funding_raised ?? null,
          description: company.description ?? null,
        },
        { onConflict: "normalized_name" }
      )
      .select()
      .single();

  if (companyError) {
    console.error("Company upsert error:", companyError);
    continue;
  }

  // Link term ↔ company
  await supabaseAdmin
    .from("term_companies")
    .upsert(
      {
        term_id: finalTerm!.id,
        company_id: upsertedCompany.id,
      },
      { onConflict: "term_id,company_id" }
    );
}

// 6) Fetch linked companies
const linkedCompanies = await supabaseAdmin
  .from("term_companies")
  .select(`
    company:companies (
      id,
      name,
      normalized_name,
      public,
      revenue_estimate,
      funding_total
    )
  `)
  .eq("term_id", finalTerm!.id);

if (linkedCompanies.error) {
  console.error("Error fetching linked companies:", linkedCompanies.error);
  return Response.json(
    { error: linkedCompanies.error.message },
    { status: 500 }
  );
}

const linkedCompanyRecords =
  linkedCompanies.data?.map((row: any) => row.company) ?? [];

return Response.json({
  ok: true,
  exists,
  term: updatedTerm.data,
  version: insertedVersion.data,
  companies: linkedCompanyRecords,
});
  } catch (err: any) {
    console.error("DEFINE route FULL ERROR:", err);
    return Response.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
