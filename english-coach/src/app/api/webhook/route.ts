import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

async function notifyWhatsApp(message: string) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) return;
  const phone = "5561995691219";
  const encoded = encodeURIComponent(message);
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`);
  } catch (e) {
    console.error("[whatsapp notify]", e);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUserId = (obj: any) => obj?.metadata?.userId as string | undefined;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = getUserId(session);
    if (userId) {
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan: "pro",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      const email = session.customer_details?.email ?? "email não disponível";
      const name = session.customer_details?.name ?? "Nome não informado";
      await notifyWhatsApp(`🎉 Nova assinatura! \n👤 ${name}\n📧 ${email}\n💰 R$ 97/mês\n\nEntre em contato para dar boas-vindas!`);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = getUserId(sub);
    if (userId) {
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        plan: "free",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      await notifyWhatsApp(`😔 Cancelamento de assinatura.\nUser ID: ${userId}\n\nConsidere entrar em contato para entender o motivo.`);
    }
  }

  return NextResponse.json({ received: true });
}
