import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:jovictor20@gmail.com",
  process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!,
  process.env.WEBPUSH_PRIVATE_KEY!
);

export async function sendWebPush(
  subscription: webpush.PushSubscription,
  title: string,
  body: string,
  url: string
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url, icon: "/favicon.png" })
    );
    return true;
  } catch {
    return false;
  }
}
