export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: me } = await auth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const db = supabase as any;

  const [postsResult, countResult, clerkUser, xpResult, subResult, followRow, followerCount, followingCount] = await Promise.all([
    supabase
      .from("community_posts")
      .select("*, community_reactions(emoji, user_id)")
      .eq("user_id", userId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    (async () => {
      try {
        const client = await clerkClient();
        return await client.users.getUser(userId);
      } catch {
        return null;
      }
    })(),
    db.from("user_xp").select("total_xp, display_name, handle").eq("user_id", userId).maybeSingle(),
    supabase.from("subscriptions").select("level").eq("user_id", userId).maybeSingle(),
    db.from("user_follows").select("id").eq("follower_id", me).eq("following_id", userId).maybeSingle(),
    db.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    db.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  const display_name = clerkUser
    ? (clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.firstName ?? clerkUser.username ?? "Student")
    : (xpResult.data?.display_name ?? null);

  const LEVEL_LABEL: Record<string, string> = {
    beginner: "Iniciante",
    intermediate: "Intermediário",
    advanced: "Avançado",
  };

  const profile = {
    display_name: display_name ?? "Student",
    avatar_url: clerkUser?.imageUrl ?? null,
    total_xp: xpResult.data?.total_xp ?? 0,
    level: subResult.data?.level ?? null,
    level_label: LEVEL_LABEL[subResult.data?.level ?? ""] ?? null,
    handle: xpResult.data?.handle ?? null,
    follower_count: followerCount.count ?? 0,
    following_count: followingCount.count ?? 0,
    is_following: !!followRow.data,
  };

  return NextResponse.json({
    posts: postsResult.data ?? [],
    profile,
    totalPosts: countResult.count ?? 0,
  });
}
