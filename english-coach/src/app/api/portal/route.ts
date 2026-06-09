import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? "https://faleinglesjv.com";

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/app`,
  });

  return NextResponse.json({ url: session.url });
}
