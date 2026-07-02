import { createClient } from "@supabase/supabase-js";
import { sendPush } from "./fcm";
import { sendWebPush } from "./webpush";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function pushToUser(
  userId: string,
  title: string,
  body: string,
  url: string,
  icon?: string
): Promise<void> {
  const { data } = await supabase
    .from("subscriptions")
    .select("fcm_token, webpush_subscription")
    .eq("user_id", userId)
    .single();

  if (!data) return;

  if (data.fcm_token) {
    sendPush(data.fcm_token, title, body, url, icon).catch(() => {});
  } else if (data.webpush_subscription) {
    sendWebPush(data.webpush_subscription, title, body, url).catch(() => {});
  }
}
