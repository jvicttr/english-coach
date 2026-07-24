"use client";

import { useEffect, useState } from "react";

// Set once the Google AdSense account for the site is approved — the publisher
// id looks like "ca-pub-XXXXXXXXXXXXXXXX" and the (single, reused) display ad
// unit's slot id is numeric. Until both are set this whole component is a
// no-op, so it's safe to have it mounted across the app already. The AdSense
// loader script itself lives in the root layout (see src/app/layout.tsx) so
// it's present on public pages too, where Google's crawler can reach it.
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const ADSENSE_SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Free-tier-only banner ad. Pro users never see ads, so this checks the plan
// itself instead of requiring every page that renders it to plumb isPro through.
// Reuses the same display ad unit everywhere it's dropped in, so only one ad
// unit needs to exist in AdSense — override `slot` if a placement ever needs
// its own unit (e.g. to track performance separately).
export function AdBanner({ slot = ADSENSE_SLOT_ID }: { slot?: string }) {
  const [isPro, setIsPro] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("userPlan") === "pro";
  });

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => setIsPro(d.plan === "pro"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isPro || !ADSENSE_CLIENT_ID || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [isPro, slot]);

  if (!ADSENSE_CLIENT_ID || !slot || isPro) return null;

  return (
    <div style={{ margin: "16px 0", textAlign: "center", minHeight: 60 }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
