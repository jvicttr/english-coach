import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ plan: "free" });

  const [sub, user] = await Promise.all([
    supabase.from("subscriptions").select("plan").eq("user_id", userId).single(),
    currentUser(),
  ]);

  return NextResponse.json({
    plan: sub.data?.plan ?? "free",
    firstName: user?.firstName ?? null,
  });
}
