import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // 1️⃣ Embed the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // 2️⃣ Vector similarity search
    const { data, error } = await supabaseAdmin.rpc(
      "match_companies",
      {
        query_embedding: embedding,
        match_threshold: 0.0,
        match_count: 5,
      }
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ results: [] });
    }

    const enhancedResults = data.map((item: any) => {
      let confidence = "low";

      if (item.similarity > 0.85) confidence = "high";
      else if (item.similarity > 0.5) confidence = "medium";

      return {
        ...item,
        confidence,
      };
    });

    return NextResponse.json({ results: enhancedResults });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Company search failed" },
      { status: 500 }
    );
  }
}
