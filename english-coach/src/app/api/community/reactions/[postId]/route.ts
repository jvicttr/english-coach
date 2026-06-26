export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(_req: NextRequest, { params }: { params: { postId: string } }) {
  const { postId } = params;

  const { data: reactions } = await supabase
    .from("community_reactions")
    .select("emoji, user_id")
    .eq("post_id", postId);

  if (!reactions || reactions.length === 0) return NextResponse.json([]);

  const uniqueUserIds = [...new Set(reactions.map(r => r.user_id))];

  const clerk = await clerkClient();
  const users = await clerk.users.getUserList({ userId: uniqueUserIds, limit: 100 });

  const userMap: Record<string, { name: string; avatar: string }> = {};
  for (const u of users.data) {
    userMap[u.id] = {
      name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : (u.username ?? "User"),
      avatar: u.imageUrl,
    };
  }

  const result = reactions.map(r => ({
    emoji: r.emoji,
    user_id: r.user_id,
    name: userMap[r.user_id]?.name ?? "User",
    avatar: userMap[r.user_id]?.avatar ?? null,
  }));

  return NextResponse.json(result);
}
