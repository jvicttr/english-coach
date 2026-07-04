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

const TEST_MODE_KEY = "jv_install_test_mode";

/**
 * Modo de teste: acesse o app com ?installtest=1 na URL para ativar (persiste no
 * localStorage até você abrir com ?installtest=0). Com o modo ativo, o fluxo de
 * instalar o app roda normalmente na tela, mas pula a chamada real que concede XP —
 * útil pra testar o pop-up/botão sem ganhar a recompensa de verdade.
 */
export function isInstallTestMode(): boolean {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("installtest");
  if (param === "1") localStorage.setItem(TEST_MODE_KEY, "1");
  else if (param === "0") localStorage.removeItem(TEST_MODE_KEY);
  return localStorage.getItem(TEST_MODE_KEY) === "1";
}
