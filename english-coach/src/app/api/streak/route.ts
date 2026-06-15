import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ streak: 0, weekDays: [] });

  // Merge activity from usage table AND quiz_results (completed quizzes)
  const [{ data: usageData }, { data: quizData }] = await Promise.all([
    supabase.from("usage").select("date").eq("user_id", userId).order("date", { ascending: false }).limit(60),
    supabase.from("quiz_results").select("created_at").eq("user_id", userId).not("score", "is", null).order("created_at", { ascending: false }).limit(100),
  ]);

  const dateSet = new Set<string>();
  for (const r of usageData ?? []) dateSet.add(r.date);
  for (const r of quizData ?? []) dateSet.add((r.created_at as string).split("T")[0]);

  const today = new Date();

  // Streak: count consecutive days ending today or yesterday
  let streak = 0;
  const check = new Date(today);
  while (dateSet.has(fmt(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  // If today not practiced yet, accept streak ending yesterday
  if (streak === 0) {
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    const check2 = new Date(yest);
    while (dateSet.has(fmt(check2))) {
      streak++;
      check2.setDate(check2.getDate() - 1);
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
