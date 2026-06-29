export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;

  const { data: reactions } = await supabase
    .from("community_reactions")
    .select("emoji, user_id")
    .eq("post_id", postId);

  if (!reactions || reactions.length === 0) return NextResponse.json([]);

  const uniqueUserIds = [...new Set(reactions.map(r => r.user_id))];

  // Fetch names from user_xp (has display_name for all users)
  const { data: xpRows } = await supabase
    .from("user_xp")
    .select("user_id, display_name")
    .in("user_id", uniqueUserIds);

  // Fallback: fetch from users table
  const { data: userRows } = await supabase
    .from("users")
    .select("id, name, image_url")
    .in("id", uniqueUserIds);

  const nameMap: Record<string, { name: string; avatar: string | null }> = {};
  for (const u of userRows ?? []) {
    nameMap[u.id] = { name: u.name ?? "User", avatar: u.image_url ?? null };
  }
  for (const x of xpRows ?? []) {
    if (x.display_name) nameMap[x.user_id] = { ...nameMap[x.user_id], name: x.display_name };
  }

  const result = reactions.map(r => ({
    emoji: r.emoji,
    user_id: r.user_id,
    name: nameMap[r.user_id]?.name ?? "User",
    avatar: nameMap[r.user_id]?.avatar ?? null,
  }));

  return NextResponse.json(result);
}
