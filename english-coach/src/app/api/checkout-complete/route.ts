import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function notifyWhatsApp(message: string) {
  const encoded = encodeURIComponent(message);
  try {
    await fetch(`https://api.callmebot.com/text.php?user=@jvicttr&text=${encoded}`);
  } catch (e) {
    console.error("[telegram notify]", e);
  }
}

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId obrigatório" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["customer", "subscription"],
  }).catch(() => null);

  if (!session || session.payment_status !== "paid") {
    return NextResponse.json({ error: "Pagamento não confirmado" }, { status: 400 });
  }

  const email = session.customer_details?.email;
  if (!email) {
    return NextResponse.json({ error: "E-mail não encontrado na sessão" }, { status: 400 });
  }

  const fullName = session.customer_details?.name ?? "";
  const [firstName, ...restName] = fullName.split(" ").filter(Boolean);
  const lastName = restName.join(" ") || undefined;

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  const { data: existingUsers } = await clerk.users.getUserList({ emailAddress: [email] });

  let userId: string;
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
  } else {
    const created = await clerk.users.createUser({
      emailAddress: [email],
      firstName: firstName || undefined,
      lastName,
      skipPasswordRequirement: true,
    });
    userId = created.id;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (subscriptionId) {
    await stripe.subscriptions.update(subscriptionId, { metadata: { userId } }).catch(() => {});
  }

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      email,
      name: fullName || undefined,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: "pro",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  const signInToken = await clerk.signInTokens.createSignInToken({ userId, expiresInSeconds: 300 });

  await notifyWhatsApp(`🎉 Nova assinatura via /ia! \n👤 ${fullName || "Nome não informado"}\n📧 ${email}\n💰 R$ 54,90/mês`);

  return NextResponse.json({ ticket: signInToken.token });
}
