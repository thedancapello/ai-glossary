import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return Response.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("terms")
      .select("*")
      .or(
        `canonical_name.ilike.%${query}%,summary.ilike.%${query}%`
      )
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      count: data?.length ?? 0,
      results: data ?? [],
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Search failed" },
      { status: 500 }
    );
  }
}
