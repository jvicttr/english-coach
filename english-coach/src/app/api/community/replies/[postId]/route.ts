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

  return NextResponse.json({ replies: replies ?? [] });
}
