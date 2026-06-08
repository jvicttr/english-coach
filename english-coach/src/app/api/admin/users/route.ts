import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

async function checkAdmin() {
  const { userId } = await auth();
  if (!userId || userId !== ADMIN_USER_ID) return false;
  return true;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all users from Clerk
  const { data: clerkUsers } = await clerk.users.getUserList({ limit: 100, orderBy: "-created_at" });

  // Get all subscriptions from Supabase
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, plan, updated_at");

  const subMap = new Map((subs ?? []).map((s) => [s.user_id, s]));

  const users = clerkUsers.map((u) => {
    const sub = subMap.get(u.id);
    return {
      id: u.id,
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Sem nome",
      email: u.emailAddresses[0]?.emailAddress ?? "—",
      imageUrl: u.imageUrl,
      plan: sub?.plan ?? "free",
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, plan } = await req.json();
  if (!userId || !["free", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, plan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
