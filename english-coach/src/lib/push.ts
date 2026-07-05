import { createClient } from "@supabase/supabase-js";
import { sendPush } from "./fcm";
import { sendWebPush } from "./webpush";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export type PushResult = "sent" | "no_subscription" | "error";

export async function pushToUser(
  userId: string,
  title: string,
  body: string,
  url: string,
  icon?: string
): Promise<PushResult> {
  const { data } = await supabase
    .from("subscriptions")
    .select("fcm_token, webpush_subscription")
    .eq("user_id", userId)
    .single();

  if (!data || (!data.webpush_subscription && !data.fcm_token)) return "no_subscription";

  try {
    if (data.webpush_subscription) {
      await sendWebPush(data.webpush_subscription, title, body, url);
    } else if (data.fcm_token) {
      await sendPush(data.fcm_token, title, body, url, icon);
    }
    return "sent";
  } catch {
    return "error";
  }
}
