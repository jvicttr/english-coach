export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ valid: false });

  try {
    const coupon = await stripe.coupons.retrieve(id);
    const valid = coupon.valid;
    return NextResponse.json({
      valid,
      percent: coupon.percent_off ?? null,
      name: coupon.name ?? null,
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
