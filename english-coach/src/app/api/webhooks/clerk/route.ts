import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

interface ClerkUserCreatedEvent {
  type: string;
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    first_name: string | null;
    last_name: string | null;
  };
}

async function sendWelcomeEmail(email: string, firstName: string | null) {
  const name = firstName ?? "aluno";

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "João Victor — Fale Inglês JV", email: process.env.BREVO_SENDER_EMAIL! },
      to: [{ email }],
      subject: "Bem-vindo ao JV IA 🎉",
      htmlContent: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <!-- Logo -->
      <div style="text-align:center;margin-bottom:32px;">
        <img src="https://www.faleinglesjv.com/favicon.png" alt="JV IA" width="56" height="56" style="border-radius:12px;">
      </div>

      <!-- Headline -->
      <h1 style="font-size:24px;font-weight:800;text-align:center;margin:0 0 8px;color:#ffffff;">
        Bem-vindo ao JV IA, ${name}! 🎉
      </h1>
      <p style="text-align:center;color:#999;font-size:15px;margin:0 0 32px;">
        Sua jornada para falar inglês com confiança começa agora.
      </p>

      <!-- Features -->
      <div style="background:#111111;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #1e1e1e;">
        <p style="font-size:13px;font-weight:700;color:#F5C800;text-transform:uppercase;letter-spacing:.08em;margin:0 0 16px;">O que você pode fazer agora:</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;font-size:14px;color:#ffffff;">🗺️ &nbsp;<strong>Trilha de aprendizado</strong> — do A1 ao C1, passo a passo</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#ffffff;">💬 &nbsp;<strong>Conversa com IA</strong> — pratique inglês com o coach virtual</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#ffffff;">🃏 &nbsp;<strong>Flashcards inteligentes</strong> — vocabulário com repetição espaçada</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#ffffff;">🎭 &nbsp;<strong>Role play</strong> — simule situações reais do dia a dia</td></tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="https://app.faleinglesjv.com/app" style="display:inline-block;background:#F5C800;color:#000000;font-weight:800;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">
          Começar agora →
        </a>
      </div>

      <!-- Footer -->
      <p style="text-align:center;color:#444;font-size:12px;margin:0;">
        Fale Inglês JV · <a href="https://www.faleinglesjv.com" style="color:#666;text-decoration:none;">faleinglesjv.com</a>
      </p>
    </td></tr>
  </table>
</body>
</html>
      `.trim(),
    }),
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No webhook secret" }, { status: 500 });

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, headers) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const email = event.data.email_addresses?.[0]?.email_address;
    if (email) {
      await sendWelcomeEmail(email, event.data.first_name);
    }
  }

  return NextResponse.json({ ok: true });
}
