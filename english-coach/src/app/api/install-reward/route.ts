import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { grantXP } from "@/lib/xp";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { newXp, newBadges } = await grantXP(userId, { type: "app_installed" });
  const awarded = newBadges.some((b) => b.id === "app_installed");

  return NextResponse.json({ awarded, newXp });
}
