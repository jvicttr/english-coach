export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: me } = await auth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const { data: posts } = await supabase
    .from("community_posts")
    .select("*, community_reactions(emoji, user_id)")
    .eq("user_id", userId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: profile } = await supabase
    .from("community_posts")
    .select("display_name, avatar_url")
    .eq("user_id", userId)
    .limit(1)
    .single();

  const { count: totalPosts } = await supabase
    .from("community_posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return NextResponse.json({
    posts: posts ?? [],
    profile: profile ?? null,
    totalPosts: totalPosts ?? 0,
  });
}
