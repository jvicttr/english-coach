export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function checkEnglish(text: string): Promise<boolean> {
  if (!text.trim()) return true;
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{ role: "user", content: `Is this text written in English? Reply only "yes" or "no".\n\nText: "${text.slice(0, 300)}"` }],
  });
  return (res.content[0] as { text: string }).text.toLowerCase().includes("yes");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "Empty content" }, { status: 400 });

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const english = await checkEnglish(content);
  if (!english) return NextResponse.json({ error: "not_english" }, { status: 422 });

  const { data: updated } = await supabase
    .from("community_posts")
    .update({ content: content.trim() })
    .eq("id", postId)
    .select()
    .single();

  return NextResponse.json({ post: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("community_posts").delete().eq("id", postId);

  return NextResponse.json({ ok: true });
}
