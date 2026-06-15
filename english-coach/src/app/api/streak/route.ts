import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ streak: 0, weekDays: [] });

  const { data } = await supabase
    .from("usage")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(60);

  const dates = (data ?? []).map((r: { date: string }) => r.date);
  const dateSet = new Set(dates);

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Streak: count consecutive days ending today or yesterday
  let streak = 0;
  const check = new Date(today);
  while (dateSet.has(fmt(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  // If today not practiced yet, also accept streak ending yesterday
  if (streak === 0) {
    check.setDate(check.getDate() - 1); // back to yesterday
    while (dateSet.has(fmt(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
  }

  // Week row Mon–Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dateSet.has(fmt(d));
  });

  return NextResponse.json({ streak, weekDays });
}
