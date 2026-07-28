import { Webhook } from "svix";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, welcomeEmailHtml } from "@/lib/email";
import { pushToUser } from "@/lib/push";
import { sendPushMulticast } from "@/lib/fcm";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function notifyWhatsApp(message: string) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) return;
  const phone = "5561995691219";
  try {
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
    );
  } catch (e) {
    console.error("[whatsapp]", e);
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Verify signature with svix
  const body = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let evt: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(body, headers) as typeof evt;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── user.created ──────────────────────────────────────────────────────────
  if (evt.type === "user.created") {
    const data = evt.data;
    const userId = data.id as string;

    // Extract primary email
    const emails = (data.email_addresses as Array<{ email_address: string; id: string }>) ?? [];
    const primaryEmailId = data.primary_email_address_id as string;
    const primaryEmail =
      emails.find((e) => e.id === primaryEmailId)?.email_address ??
      emails[0]?.email_address ??
      null;

    // Extract name
    const firstName = (data.first_name as string) ?? "";
    const lastName = (data.last_name as string) ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Aluno";
    const imageUrl = (data.image_url as string) || null;

    // Store in Supabase (upsert into subscriptions — adds email/name cols).
    // ignoreDuplicates: if a row already exists (e.g. created moments earlier by the
    // guest-checkout flow with plan "pro"), skip instead of resetting it back to "free".
    if (userId && primaryEmail) {
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          email: primaryEmail,
          name: fullName,
          plan: "free",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
    }

    // Send welcome email
    if (primaryEmail) {
      await sendEmail({
        to: primaryEmail,
        subject: `Bem-vindo ao JV IA, ${firstName || "aluno"}! 🎉`,
        html: welcomeEmailHtml(firstName || "aluno"),
      });
    }

    // Notify JV on WhatsApp
    await notifyWhatsApp(
      `👤 Novo cadastro no JV IA!\n📛 ${fullName}\n📧 ${primaryEmail ?? "sem email"}`
    );

    // Notifica todos os usuários já cadastrados sobre o novo aluno, para
    // incentivar interação na comunidade (seguir, mandar mensagem, etc.)
    if (userId) {
      const { data: existingUsers } = await supabase
        .from("subscriptions")
        .select("user_id, fcm_token")
        .neq("user_id", userId);

      if (existingUsers && existingUsers.length > 0) {
        const rows = existingUsers.map((u) => ({
          user_id: u.user_id,
          type: "new_user",
          from_user_id: userId,
          from_display_name: fullName,
          from_avatar_url: imageUrl,
        }));
        await supabase.from("notifications").insert(rows);

        const pushTitle = "Novo aluno na comunidade! 👋";
        const pushBody = `${fullName} acabou de chegar. Dê as boas-vindas!`;
        const pushUrl = `https://www.faleinglesjv.com/app/comunidade/u/${userId}`;

        const tokens = existingUsers.map((u) => u.fcm_token).filter(Boolean) as string[];
        await Promise.all([
          tokens.length > 0
            ? sendPushMulticast(tokens, pushTitle, pushBody, pushUrl).catch(() => {})
            : Promise.resolve(),
          ...existingUsers.map((u) =>
            pushToUser(u.user_id, pushTitle, pushBody, pushUrl, imageUrl ?? undefined).catch(() => {})
          ),
        ]);
      }
    }
  }

  return NextResponse.json({ received: true });
}

