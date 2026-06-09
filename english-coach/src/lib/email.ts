// Shared email utility — uses Resend REST API (no extra package needed)

export async function sendEmail({
  to,
  subject,
  html,
  replyTo = "jv@faleinglesjv.com",
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", to);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Fale Inglês JV <coach@faleinglesjv.com>",
        to,
        subject,
        reply_to: replyTo,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", err);
    }
  } catch (e) {
    console.error("[email] fetch failed:", e);
  }
}

// ── Email templates ─────────────────────────────────────────────────────────

export function welcomeEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao JV IA</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#111111;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #1f1f1f;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#F5C800;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="font-weight:900;font-size:14px;color:#000;">JV</span>
                  </td>
                  <td style="padding-left:12px;font-size:15px;font-weight:700;color:#ffffff;">
                    Fale Inglês <span style="color:#F5C800;">JV</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0 0 16px;">
                Bem-vindo, ${firstName}! 🎉
              </p>
              <p style="font-size:15px;color:#aaaaaa;line-height:1.7;margin:0 0 20px;">
                Sua conta no <strong style="color:#ffffff;">JV IA — Fale Inglês JV</strong> está pronta.
                Agora você pode praticar inglês em conversas reais, com correção, pronúncia e quiz personalizado — tudo no ritmo certo pra você.
              </p>

              <!-- Topic grid -->
              <p style="font-size:13px;font-weight:700;color:#F5C800;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">
                O que você pode praticar:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:0 4px 8px 0;vertical-align:top;">
                    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:12px;">
                      <div style="font-size:20px;margin-bottom:6px;">💬</div>
                      <div style="font-size:13px;font-weight:700;color:#fff;">Conversa Livre</div>
                      <div style="font-size:11px;color:#666;margin-top:2px;">Qualquer assunto</div>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 8px 4px;vertical-align:top;">
                    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:12px;">
                      <div style="font-size:20px;margin-bottom:6px;">💼</div>
                      <div style="font-size:13px;font-weight:700;color:#fff;">Trabalho & Carreira</div>
                      <div style="font-size:11px;color:#666;margin-top:2px;">Reuniões, entrevistas</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 4px 8px 0;vertical-align:top;">
                    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:12px;">
                      <div style="font-size:20px;margin-bottom:6px;">✈️</div>
                      <div style="font-size:13px;font-weight:700;color:#fff;">Viagens & Turismo</div>
                      <div style="font-size:11px;color:#666;margin-top:2px;">Aeroporto, hotel</div>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 8px 4px;vertical-align:top;">
                    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:12px;">
                      <div style="font-size:20px;margin-bottom:6px;">🔥</div>
                      <div style="font-size:13px;font-weight:700;color:#fff;">Phrasal Verbs</div>
                      <div style="font-size:11px;color:#666;margin-top:2px;">Give up, go on...</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="https://www.faleinglesjv.com/app"
                       style="display:inline-block;background:#F5C800;color:#000000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">
                      Começar a praticar agora →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px;color:#aaaaaa;line-height:1.7;margin:0 0 8px;">
                Se tiver qualquer dúvida, é só responder esse e-mail ou me chamar no WhatsApp.
              </p>
              <p style="font-size:14px;color:#aaaaaa;margin:0 0 32px;">
                Bons estudos! 💪<br/>
                <strong style="color:#ffffff;">JV — Fale Inglês JV</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1f1f1f;">
              <p style="font-size:11px;color:#444444;margin:0;text-align:center;">
                Fale Inglês JV · <a href="https://www.faleinglesjv.com" style="color:#666;text-decoration:none;">faleinglesjv.com</a><br/>
                Você está recebendo este e-mail porque criou uma conta no JV IA.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function streakReminderHtml(firstName: string, streak: number): string {
  const hasStreak = streak > 0;
  const streakText = hasStreak
    ? `Você está com <strong style="color:#f97316;">${streak} dia${streak > 1 ? "s" : ""} seguido${streak > 1 ? "s" : ""} 🔥</strong> — não deixa essa sequência quebrar!`
    : "Que tal voltar a praticar hoje? Cada conversa te deixa um passo mais perto da fluência.";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hora de praticar inglês!</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#111111;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #1f1f1f;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#F5C800;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="font-weight:900;font-size:14px;color:#000;">JV</span>
                  </td>
                  <td style="padding-left:12px;font-size:15px;font-weight:700;color:#ffffff;">
                    Fale Inglês <span style="color:#F5C800;">JV</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <div style="font-size:48px;text-align:center;margin-bottom:16px;">${hasStreak ? "🔥" : "💬"}</div>
              <p style="font-size:20px;font-weight:800;color:#ffffff;margin:0 0 12px;text-align:center;">
                ${firstName}, bora praticar hoje?
              </p>
              <p style="font-size:15px;color:#aaaaaa;line-height:1.7;margin:0 0 28px;text-align:center;">
                ${streakText}
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="https://www.faleinglesjv.com/app"
                       style="display:inline-block;background:#F5C800;color:#000000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">
                      Praticar agora →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 32px;text-align:center;">
                Só 5 minutos de conversa já faz diferença.<br/>Escolha um tópico e comece!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1f1f1f;">
              <p style="font-size:11px;color:#444444;margin:0;text-align:center;">
                Fale Inglês JV · <a href="https://www.faleinglesjv.com" style="color:#666;text-decoration:none;">faleinglesjv.com</a><br/>
                Para não receber mais lembretes, responda este e-mail com "cancelar".
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

