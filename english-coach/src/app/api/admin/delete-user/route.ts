import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId: requesterId } = await auth();
  if (!requesterId || requesterId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { handle } = await req.json();
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  // Find user_id by handle
  const { data: userRow } = await db
    .from("user_xp")
    .select("user_id")
    .ilike("handle", handle)
    .maybeSingle();

  if (!userRow) return NextResponse.json({ error: "User not found", handle }, { status: 404 });

  const userId = userRow.user_id;

  // Delete from all tables
  const tables = [
    "notifications",
    "community_posts",
    "user_follows",
    "direct_messages",
    "quiz_results",
    "flashcards",
    "subscriptions",
    "user_xp",
  ];

  const results: Record<string, string> = {};

  for (const table of tables) {
    const col = table === "user_follows" ? "follower_id" : "user_id";
    const { error } = await db.from(table).delete().eq(col, userId);
    // For user_follows, also delete where following_id = userId
    if (table === "user_follows") {
      await db.from(table).delete().eq("following_id", userId);
    }
    results[table] = error ? `error: ${error.message}` : "deleted";
  }

  // Also remove as sender/receiver in direct_messages
  await db.from("direct_messages").delete().eq("sender_id", userId);
  await db.from("notifications").delete().eq("from_user_id", userId);

  return NextResponse.json({ userId, handle, results });
}
