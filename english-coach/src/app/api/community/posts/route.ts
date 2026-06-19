export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FREE_POST_LIMIT = 1;

async function checkEnglish(text: string): Promise<boolean> {
  if (!text.trim()) return true;
  const check = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{ role: "user", content: `Is this text written in English? Reply only "yes" or "no".\n\nText: "${text.slice(0, 300)}"` }],
  });
  return (check.content[0] as { text: string }).text.toLowerCase().includes("yes");
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: posts } = await supabase
    .from("community_posts")
    .select("*, community_reactions(emoji, user_id)")
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!posts?.length) return NextResponse.json({ posts: [] });

  const ids = posts.map(p => p.id);
  const { data: replies } = await supabase
    .from("community_posts")
    .select("parent_id")
    .in("parent_id", ids);

  const countMap: Record<string, number> = {};
  replies?.forEach(r => { countMap[r.parent_id] = (countMap[r.parent_id] ?? 0) + 1; });

  return NextResponse.json({ posts: posts.map(p => ({ ...p, reply_count: countMap[p.id] ?? 0 })) });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { content = "", audioUrl = null, imageUrl = null, validateOnly = false, parentId = null } = body;

  if (!content.trim() && !audioUrl && !imageUrl) {
    return NextResponse.json({ error: "Empty post" }, { status: 400 });
  }

  if (content.trim()) {
    const english = await checkEnglish(content);
    if (!english) {
      return NextResponse.json({ error: "not_english", message: "Please write in English! 🇺🇸" }, { status: 422 });
    }
  }

  if (validateOnly) return NextResponse.json({ ok: true });

  const [user, sub] = await Promise.all([
    currentUser(),
    supabase.from("subscriptions").select("plan").eq("user_id", userId).single(),
  ]);

  const isPro = sub.data?.plan === "pro" || sub.data?.plan === "combo";

  if (!isPro && !parentId) {
    const { count } = await supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("parent_id", null);
    if ((count ?? 0) >= FREE_POST_LIMIT) {
      return NextResponse.json({ error: "free_limit" }, { status: 403 });
    }
  }

  const displayName = user?.firstName ?? user?.username ?? "Student";
  const avatarUrl = user?.imageUrl ?? null;

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({ user_id: userId, display_name: displayName, avatar_url: avatarUrl, content: content.trim(), audio_url: audioUrl, image_url: imageUrl, parent_id: parentId ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the parent post's author (skip if replying to own post)
  if (parentId) {
    const { data: parent } = await supabase
      .from("community_posts")
      .select("user_id")
      .eq("id", parentId)
      .single();
    if (parent && parent.user_id !== userId) {
      await supabase.from("notifications").insert({
        user_id: parent.user_id,
        type: "reply",
        post_id: parentId,
        from_user_id: userId,
        from_display_name: displayName,
        from_avatar_url: avatarUrl,
      });
    }
  }

  return NextResponse.json({ post });
}
