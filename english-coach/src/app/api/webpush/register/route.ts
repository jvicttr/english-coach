import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription) return NextResponse.json({ error: "Missing subscription" }, { status: 400 });

  await supabase
    .from("subscriptions")
    .update({ webpush_subscription: subscription })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
