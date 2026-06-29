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
  const { content = "", audioUrl = null, imageUrl = null, transcript = null, validateOnly = false, parentId = null, isShare = false } = body;

  if (!content.trim() && !audioUrl && !imageUrl) {
    return NextResponse.json({ error: "Empty post" }, { status: 400 });
  }

  // Skip English validation for auto-generated share posts
  if (content.trim() && !isShare) {
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

  // Share posts bypass the free post limit
  if (!isPro && !parentId && !isShare) {
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
    .insert({ user_id: userId, display_name: displayName, avatar_url: avatarUrl, content: content.trim(), audio_url: audioUrl, image_url: imageUrl, transcript: transcript ?? null, parent_id: parentId ?? null })
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

  // Notify mentioned users (@handle or @name) — resolve each mention to a user_id
  const mentionedNames = [...new Set((content.match(/@([\wÀ-ɏḀ-ỿ]+)/g) ?? []).map((m: string) => m.slice(1)))];
  const seen = new Set<string>();
  for (const name of mentionedNames) {
    // 1. Exact handle match (unambiguous — handles are unique)
    const { data: handleUser } = await supabase
      .from("user_xp")
      .select("user_id")
      .ilike("handle", name)
      .maybeSingle();

    let mentionedUserId = handleUser?.user_id ?? null;

    // 2. Fallback: display_name prefix (legacy posts without handle)
    if (!mentionedUserId) {
      const { data: xpUser } = await supabase
        .from("user_xp")
        .select("user_id")
        .ilike("display_name", `${name}%`)
        .limit(1)
        .maybeSingle();
      mentionedUserId = xpUser?.user_id ?? null;
    }

    // 3. Last resort: community_posts
    if (!mentionedUserId) {
      const { data: postUser } = await supabase
        .from("community_posts")
        .select("user_id")
        .ilike("display_name", `${name}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      mentionedUserId = postUser?.user_id ?? null;
    }

    if (!mentionedUserId || mentionedUserId === userId || seen.has(mentionedUserId)) continue;
    seen.add(mentionedUserId);
    await supabase.from("notifications").insert({
      user_id: mentionedUserId,
      type: "mention",
      post_id: post.id,
      from_user_id: userId,
      from_display_name: displayName,
      from_avatar_url: avatarUrl,
    });
    // Push notification via OneSignal
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
      fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}` },
        body: JSON.stringify({
          app_id: process.env.ONESIGNAL_APP_ID,
          include_aliases: { external_id: [mentionedUserId] },
          target_channel: "push",
          headings: { en: `${displayName} te marcou!`, pt: `${displayName} te marcou!` },
          contents: { en: content.slice(0, 100), pt: content.slice(0, 100) },
          url: `https://www.faleinglesjv.com/app/comunidade#post-${post.id}`,
          web_url: `https://www.faleinglesjv.com/app/comunidade#post-${post.id}`,
          chrome_web_icon: avatarUrl || "https://www.faleinglesjv.com/favicon.png",
        }),
      }).catch(() => {});
    }
  }

  // Community badges: check post count (only for original posts, not replies)
  if (!parentId) {
    try {
      const { count: postCount } = await supabase
        .from("community_posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("parent_id", null);

      const { data: xpRow } = await supabase.from("user_xp").select("total_xp").eq("user_id", userId).maybeSingle();
      const currentXp = xpRow?.total_xp ?? 0;
      let bonusXp = 0;

      const earnedBadges = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
      const earnedSet = new Set((earnedBadges.data ?? []).map((b: { badge_id: string }) => b.badge_id));

      if ((postCount ?? 0) === 1 && !earnedSet.has("community_first_post")) {
        await supabase.from("user_badges").insert({ user_id: userId, badge_id: "community_first_post" });
        bonusXp += 20;
      }
      if ((postCount ?? 0) >= 10 && !earnedSet.has("community_10_posts")) {
        await supabase.from("user_badges").insert({ user_id: userId, badge_id: "community_10_posts" });
        bonusXp += 80;
      }
      if (bonusXp > 0) {
        await supabase.from("user_xp").upsert({ user_id: userId, total_xp: currentXp + bonusXp, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      }
    } catch { /* badges are non-critical */ }
  }

  return NextResponse.json({ post });
}
