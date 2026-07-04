"use client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<(available: boolean) => void>();

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  listeners.forEach((cb) => cb(true));
}

export function initInstallPromptCapture() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", () => { deferredPrompt = null; });
}

export function hasDeferredPrompt(): boolean {
  return deferredPrompt !== null;
}

export function subscribeInstallPrompt(cb: (available: boolean) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  promptEvent.prompt();
  try {
    const { outcome } = await promptEvent.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  }
}
