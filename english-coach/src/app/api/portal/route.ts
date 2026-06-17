import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function getOrCreateCustomer(
  stripe: Stripe,
  clerk: ReturnType<typeof createClerkClient>,
  userId: string,
  existingId?: string
): Promise<string> {
  if (existingId) {
    try {
      await stripe.customers.retrieve(existingId);
      return existingId;
    } catch {
      // Customer doesn't exist in Stripe — create a new one below
    }
  }

  const clerkUser = await clerk.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || undefined;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { clerk_user_id: userId },
  });

  await supabase
    .from("subscriptions")
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  return customer.id;
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  const origin = req.headers.get("origin") ?? "https://faleinglesjv.com";

  try {
    const customerId = await getOrCreateCustomer(stripe, clerk, userId, data?.stripe_customer_id);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app`,
      configuration: "bpc_1TgECn2LcwXlVLfFCDHnZVPQ",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
