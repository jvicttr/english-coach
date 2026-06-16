export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  const { data: clerkUsers } = await clerk.users.getUserList({ limit: 100, orderBy: "-created_at" });

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

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const { userId, plan } = await req.json();
  if (!userId || !["free", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  let stripeCustomerId: string | undefined;
  if (plan === "pro") {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (!existing?.stripe_customer_id) {
      const clerkUser = await clerk.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || undefined;

      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { clerk_user_id: userId, manual_pro: "true" },
      });
      stripeCustomerId = customer.id;
    }
  }

  await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        updated_at: new Date().toISOString(),
        ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
      },
      { onConflict: "user_id" }
    );

  return NextResponse.json({ ok: true });
}
