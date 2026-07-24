import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  let couponId: string | undefined;
  let plano: "essencial" | "pro" = "pro";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.plano === "essencial") plano = "essencial";
    if (body.coupon) {
      // Validate coupon before using
      const coupon = await stripe.coupons.retrieve(body.coupon).catch(() => null);
      if (coupon?.valid) couponId = coupon.id;
    }
  } catch { /* no body */ }

  const priceId = plano === "essencial" ? process.env.STRIPE_PRICE_ID_ESSENCIAL! : process.env.STRIPE_PRICE_ID!;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app?sucesso=1`,
    cancel_url: `${origin}/planos`,
    metadata: { userId, plano },
    subscription_data: { metadata: { userId, plano } },
  };

  if (couponId) {
    sessionParams.discounts = [{ coupon: couponId }];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return NextResponse.json({ url: session.url });
}
