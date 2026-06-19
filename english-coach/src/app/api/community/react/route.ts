export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, emoji } = await req.json();
  if (!postId || !emoji) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: existing } = await supabase
    .from("community_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .single();

  if (existing) {
    await supabase.from("community_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  }

  await supabase.from("community_reactions").insert({ post_id: postId, user_id: userId, emoji });
  return NextResponse.json({ action: "added" });
}
