export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FREE_POST_LIMIT = 1;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: posts } = await supabase
    .from("community_posts")
    .select("*, community_reactions(emoji, user_id)")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ posts: posts ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty post" }, { status: 400 });

  const [user, sub] = await Promise.all([
    currentUser(),
    supabase.from("subscriptions").select("plan").eq("user_id", userId).single(),
  ]);

  const isPro = sub.data?.plan === "pro" || sub.data?.plan === "combo";

  if (!isPro) {
    const { count } = await supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((count ?? 0) >= FREE_POST_LIMIT) {
      return NextResponse.json({ error: "free_limit", message: "Limite do plano free atingido" }, { status: 403 });
    }
  }

  // Validate English with AI
  const check = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{
      role: "user",
      content: `Is this text written in English? Reply only "yes" or "no".\n\nText: "${content.slice(0, 300)}"`,
    }],
  });

  const isEnglish = (check.content[0] as { text: string }).text.toLowerCase().includes("yes");
  if (!isEnglish) {
    return NextResponse.json({ error: "not_english", message: "Please write your post in English! 🇺🇸" }, { status: 422 });
  }

  const displayName = user?.firstName ?? user?.username ?? "Student";
  const avatarUrl = user?.imageUrl ?? null;

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({ user_id: userId, display_name: displayName, avatar_url: avatarUrl, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post });
}
