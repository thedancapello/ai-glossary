import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "../../../lib/supabase/admin";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    // 1️⃣ Embed the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // 2️⃣ Run vector similarity search
    const { data, error } = await supabaseAdmin.rpc(
      "match_terms",
      {
        query_embedding: embedding,
        match_threshold: 0.75,
        match_count: 5,
      }
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ results: data });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Search failed" },
      { status: 500 }
    );
  }
}
