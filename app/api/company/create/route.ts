import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase/admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, website, industry, description } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const canonical_name = name.trim();
    const normalized_name = name.toLowerCase().trim();

    // 🔥 Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `${canonical_name}. ${description || ""}`,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // 🚀 Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from("companies")
      .insert({
        name: canonical_name,
        canonical_name,
        normalized_name,
        website,
        industry,
        description,
        embedding,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ company: data });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Company creation failed" },
      { status: 500 }
    );
  }
}
