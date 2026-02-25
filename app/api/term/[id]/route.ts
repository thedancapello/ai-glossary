import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
)
 {
  try {
const { id: termId } = await params;
    // 1) Term
    const term = await supabaseAdmin
      .from("terms")
      .select("*")
      .eq("id", termId)
      .single();

    if (term.error) {
      return Response.json({ error: term.error.message }, { status: 500 });
    }

    // 2) Versions (newest first)
    const versions = await supabaseAdmin
      .from("term_versions")
      .select("*")
      .eq("term_id", termId)
      .order("created_at", { ascending: false });

    if (versions.error) {
      return Response.json({ error: versions.error.message }, { status: 500 });
    }
// 3) Optional diff between newest 2 versions
    let latestDiff: any = null;

    if ((versions.data?.length ?? 0) >= 2) {
      const newest = versions.data![0].definition_md ?? "";
      const previous = versions.data![1].definition_md ?? "";

      latestDiff = {
        newestLength: newest.length,
        previousLength: previous.length,
        delta: newest.length - previous.length,
      };
    }
return Response.json({
  ok: true,
  term: term.data,
  versions: versions.data ?? [],
  latestDiff,
});
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
