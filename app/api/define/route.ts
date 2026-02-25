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

    // 2) Call OpenAI (Responses API)
    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input:
        `Return JSON only with keys: canonical_name, category_primary, summary, definition_md.\n\n` +
        `Define the AI ecosystem term: ${term}\n` +
        `Constraints: <= 750 words; operator-grade; include commercial landscape briefly.`,
    });

const raw = resp.output_text?.trim();

if (!raw) {
  throw new Error("Empty OpenAI response");
}

function stripJsonFences(s: string) {
  let t = (s || "").trim();
  t = t.replace(/^\s*```(?:json)?\s*/i, "");
  t = t.replace(/\s*```\s*$/i, "");
  return t.trim();
}

const cleaned = stripJsonFences(raw);
let data: any;

try {
  data = JSON.parse(cleaned);
} catch (err) {
  console.error("Failed to parse JSON:", cleaned);
  return Response.json(
    { error: "Model did not return valid JSON", raw: cleaned },
    { status: 500 }
  );
}
const canonical_name = exists && existing.data
  ? String(existing.data.canonical_name ?? term).trim()
  : String(data.canonical_name ?? term).trim();
const summary = String(data.summary ?? "").trim();
const category_primary = coerceCategory(data.category_primary ?? "");
    const definition_md = String(data.definition_md ?? "").trim();
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
        term_id: finalTerm.id,
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
      })
      .eq("id", finalTerm.id)
      .select()
      .single();

    if (updatedTerm.error) {
      console.error("Supabase update term error:", updatedTerm.error);
      return Response.json({ error: updatedTerm.error.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      exists,
      term: updatedTerm.data,
      version: insertedVersion.data,
    });
  } catch (err: any) {
    console.error("DEFINE route FULL ERROR:", err);
    return Response.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
