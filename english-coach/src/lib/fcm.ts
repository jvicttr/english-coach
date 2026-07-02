import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function sendPush(
  token: string,
  title: string,
  body: string,
  url: string,
  icon?: string
): Promise<boolean> {
  if (!process.env.FIREBASE_PROJECT_ID) return false;
  try {
    await getMessaging(getAdminApp()).send({
      token,
      webpush: {
        notification: {
          title,
          body,
          icon: icon ?? "https://www.faleinglesjv.com/favicon.png",
        },
        fcmOptions: { link: url },
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendPushMulticast(
  tokens: string[],
  title: string,
  body: string,
  url: string
): Promise<void> {
  if (tokens.length === 0 || !process.env.FIREBASE_PROJECT_ID) return;
  const messaging = getMessaging(getAdminApp());
  // FCM multicast: máx 500 tokens por request
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    await messaging.sendEachForMulticast({
      tokens: chunk,
      webpush: {
        notification: {
          title,
          body,
          icon: "https://www.faleinglesjv.com/favicon.png",
        },
        fcmOptions: { link: url },
      },
    }).catch(() => {});
  }
}
