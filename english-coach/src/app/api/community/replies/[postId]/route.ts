export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;

  const { data: replies } = await supabase
    .from("community_posts")
    .select("*, community_reactions(emoji, user_id)")
    .eq("parent_id", postId)
    .order("created_at", { ascending: true });

  if (!replies?.length) return NextResponse.json({ replies: [] });

  const ids = replies.map(r => r.id);
  const { data: nestedReplies } = await supabase
    .from("community_posts")
    .select("parent_id")
    .in("parent_id", ids);

  const countMap: Record<string, number> = {};
  nestedReplies?.forEach(r => { countMap[r.parent_id] = (countMap[r.parent_id] ?? 0) + 1; });

  return NextResponse.json({ replies: replies.map(r => ({ ...r, reply_count: countMap[r.id] ?? 0 })) });
}
