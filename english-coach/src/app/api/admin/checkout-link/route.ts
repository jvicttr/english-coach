import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { targetUserId, discountPercent } = await req.json();
  if (!targetUserId || !discountPercent || discountPercent < 1 || discountPercent > 99) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "https://faleinglesjv.com";

  // Create a one-time coupon for this specific discount
  const coupon = await stripe.coupons.create({
    percent_off: discountPercent,
    duration: "forever",
    max_redemptions: 1,
    name: `Desconto ${discountPercent}% - Admin`,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    discounts: [{ coupon: coupon.id }],
    success_url: `${origin}/app?sucesso=1`,
    cancel_url: `${origin}/planos`,
    metadata: { userId: targetUserId },
    subscription_data: { metadata: { userId: targetUserId } },
  });

  return NextResponse.json({ url: session.url });
}
