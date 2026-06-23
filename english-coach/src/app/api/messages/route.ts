import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// GET - Listar conversas do usuário
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (conversationId) {
    // Buscar mensagens de uma conversa específica
    const { data: messages, error } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages });
  }

  // Listar conversas do usuário
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*, user1_id, user2_id")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations });
}

// PATCH - Marcar mensagem como lida
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Marcar todas as mensagens não-lidas da conversa como lidas
  const { error } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST - Enviar mensagem
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, content, imageUrl, audioUrl, videoUrl, replyToId } = await req.json();

  if (!conversationId || (!content && !imageUrl && !audioUrl && !videoUrl)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("direct_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content,
      image_url: imageUrl,
      audio_url: audioUrl,
      video_url: videoUrl,
      reply_to_id: replyToId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Atualizar timestamp da conversa
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Enviar notificação para o outro usuário
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", conversationId)
      .single();

    if (conv) {
      const recipientId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

      const { data: sender } = await supabase
        .from("subscriptions")
        .select("name")
        .eq("user_id", userId)
        .single();

      const { data: recipient } = await supabase
        .from("subscriptions")
        .select("onesignal_player_id")
        .eq("user_id", recipientId)
        .single();

      if (recipient?.onesignal_player_id && process.env.ONESIGNAL_API_KEY) {
        const senderName = sender?.name ?? "Alguém";
        const messagePreview = content ? content.substring(0, 100) : imageUrl ? "📸 Enviou uma imagem" : audioUrl ? "🎵 Enviou áudio" : "Enviou uma mensagem";

        const notifRes = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
          },
          body: JSON.stringify({
            include_player_ids: [recipient.onesignal_player_id],
            headings: { en: `${senderName}`, pt: `${senderName}` },
            contents: { en: messagePreview, pt: messagePreview },
            data: { conversationId, userId: recipientId },
            url: `https://faleinglesjv.com/app/mensagens/${userId}`,
            web_url: `https://faleinglesjv.com/app/mensagens/${userId}`,
          }),
        }).catch((e) => { console.error("[notification] error:", e); });

        if (!notifRes?.ok) {
          const err = await notifRes?.text();
          console.error("[notification] OneSignal error:", err);
        }
      } else {
        console.warn("[notification] Missing player ID or API key", { hasPlayerId: !!recipient?.onesignal_player_id, hasApiKey: !!process.env.ONESIGNAL_API_KEY });
      }
    }
  } catch {}

  return NextResponse.json({ message });
}
