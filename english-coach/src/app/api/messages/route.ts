import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { pushToUser } from "@/lib/push";

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
      .select("*, message_reactions(id, user_id, emoji)")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Esconde mensagens que este usuário apagou "só para mim" — quem enviou continua vendo normalmente
    const { data: hidden } = await supabase
      .from("message_hidden_for")
      .select("message_id")
      .eq("user_id", userId);
    const hiddenIds = new Set((hidden ?? []).map((h) => h.message_id));
    const visible = (messages ?? []).filter((m) => !hiddenIds.has(m.id));

    return NextResponse.json({ messages: visible });
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

// DELETE - Apagar mensagem (para todos, só quem enviou) ou ocultar só para mim (?scope=me)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  const scope = searchParams.get("scope"); // "me" = oculta so para quem pediu
  if (!messageId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: message } = await supabase
    .from("direct_messages")
    .select("id, sender_id, conversation_id")
    .eq("id", messageId)
    .is("deleted_at", null)
    .single();

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: conv } = await supabase
    .from("conversations")
    .select("user1_id, user2_id")
    .eq("id", message.conversation_id)
    .single();

  if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope === "me") {
    // Oculta só na visão de quem pediu — quem enviou não fica sabendo
    const { error } = await supabase
      .from("message_hidden_for")
      .upsert({ message_id: messageId, user_id: userId }, { onConflict: "message_id,user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Apagar para todos — só quem enviou a mensagem pode
  if (message.sender_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("direct_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT - Editar mensagem (só quem enviou)
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId, content } = await req.json();
  if (!messageId || !content?.trim()) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: message } = await supabase
    .from("direct_messages")
    .select("id, sender_id")
    .eq("id", messageId)
    .is("deleted_at", null)
    .single();

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.sender_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: updated, error } = await supabase
    .from("direct_messages")
    .update({ content: content.trim(), edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: updated });
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

  // Criar notificação no sininho para o destinatário
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", conversationId)
      .single();
    if (conv) {
      const recipientId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const { data: senderXp } = await supabase.from("user_xp").select("display_name").eq("user_id", userId).maybeSingle();
      const { data: senderClerk } = await supabase.from("subscriptions").select("name").eq("user_id", userId).maybeSingle();
      const senderName = senderXp?.display_name ?? senderClerk?.name ?? "Alguém";
      const { data: senderSub } = await supabase.from("subscriptions").select("avatar_url").eq("user_id", userId).maybeSingle();
      await supabase.from("notifications").insert({
        user_id: recipientId,
        type: "direct_message",
        post_id: null,
        from_user_id: userId,
        from_display_name: senderName,
        from_avatar_url: senderSub?.avatar_url ?? null,
      });
    }
  } catch { /* notifications are non-critical */ }

  // Enviar push para o destinatário (FCM ou Web Push)
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", conversationId)
      .single();

    if (conv) {
      const recipientId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const [{ data: senderXp }, { data: senderSub }] = await Promise.all([
        supabase.from("user_xp").select("display_name, handle").eq("user_id", userId).maybeSingle(),
        supabase.from("subscriptions").select("name").eq("user_id", userId).maybeSingle(),
      ]);
      const handle = senderXp?.handle ? `@${senderXp.handle}` : (senderXp?.display_name ?? senderSub?.name ?? "Alguém");
      const preview = content
        ? content.substring(0, 100)
        : imageUrl ? "📸 Enviou uma imagem"
        : audioUrl ? "🎵 Enviou áudio"
        : "Enviou uma mensagem";
      pushToUser(recipientId, handle, preview, `https://www.faleinglesjv.com/app/mensagens/${userId}`).catch(() => {});
    }
  } catch {}

  return NextResponse.json({ message });
}
