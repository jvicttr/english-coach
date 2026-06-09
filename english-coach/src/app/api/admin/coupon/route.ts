import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { discountPercent, label } = await req.json();
  if (!discountPercent || discountPercent < 1 || discountPercent > 99) {
    return NextResponse.json({ error: "Desconto inválido." }, { status: 400 });
  }

  const coupon = await stripe.coupons.create({
    percent_off: discountPercent,
    duration: "forever",
    max_redemptions: 1,
    name: label ? `${label} — ${discountPercent}% off` : `Desconto ${discountPercent}% — Link`,
  });

  const origin = req.headers.get("origin") ?? "https://faleinglesjv.com";
  const url = `${origin}/desconto/${coupon.id}`;

  return NextResponse.json({ couponId: coupon.id, url });
}
