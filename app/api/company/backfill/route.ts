import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase/admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
  try {
    const { data: companies, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, description")
      .is("embedding", null);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    for (const company of companies ?? []) {
      const input = `${company.name}. ${company.description || ""}`;

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input,
      });

      const embedding = embeddingResponse.data[0].embedding;

      await supabaseAdmin
        .from("companies")
        .update({ embedding })
        .eq("id", company.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Backfill failed" },
      { status: 500 }
    );
  }
}
