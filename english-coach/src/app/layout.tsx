import type { Metadata, Viewport } from "next";
import { Inter, Caveat } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import OneSignalInit from "@/components/OneSignalInit";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["700"] });

export const metadata: Metadata = {
  title: {
    default: "Fale Inglês JV — Aulas de inglês online com professor particular",
    template: "%s | Fale Inglês JV",
  },
  description: "Aprenda inglês com o professor João Victor. Aulas particulares online, personalizadas para o seu nível e objetivo. Foco em conversação desde a primeira aula.",
  metadataBase: new URL("https://faleinglesjv.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://faleinglesjv.com",
    siteName: "Fale Inglês JV",
    title: "Fale Inglês JV — Aulas de inglês online com professor particular",
    description: "Aprenda inglês com o professor João Victor. Aulas particulares online, personalizadas para o seu nível e objetivo.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fale Inglês JV",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fale Inglês JV — Aulas de inglês online",
    description: "Aprenda inglês com o professor João Victor. Foco em conversação desde a primeira aula.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JV IA",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F5C800",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#F5C800",
    colorBackground: "#0a0a0a",
    colorInputBackground: "#1a1a1a",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "#aaaaaa",
    colorNeutral: "#ffffff",
    borderRadius: "12px",
    fontFamily: "Inter, sans-serif",
  },
  elements: {
    card: { background: "#111111", border: "1px solid #1e1e1e", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" },
    headerTitle: { color: "#ffffff", fontWeight: "800" },
    headerSubtitle: { color: "#aaaaaa" },
    logoImage: { width: "48px", height: "48px", borderRadius: "12px" },
    socialButtonsBlockButton: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#ffffff" },
    socialButtonsBlockButtonText: { color: "#ffffff" },
    dividerLine: { background: "#2a2a2a" },
    dividerText: { color: "#666666" },
    formFieldLabel: { color: "#dddddd" },
    formFieldInput: { background: "#1a1a1a", border: "1px solid #444444", color: "#ffffff !important", caretColor: "#ffffff", WebkitTextFillColor: "#ffffff" },
    formFieldInputPlaceholder: { color: "#888888" },
    formFieldInputShowPasswordButton: { color: "#aaaaaa" },
    otpCodeFieldInput: { background: "#1a1a1a", border: "1px solid #444444", color: "#ffffff", WebkitTextFillColor: "#ffffff" },
    footerActionText: { color: "#aaaaaa" },
    badge: { background: "#2a2a2a", color: "#aaaaaa", border: "1px solid #333" },
    footerActionLink: { color: "#F5C800", fontWeight: "700" },
    formButtonPrimary: { background: "#F5C800", color: "#000000", fontWeight: "800" },
    identityPreviewText: { color: "#ffffff" },
    identityPreviewEditButton: { color: "#F5C800" },
    footer: { display: "none" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="pt-BR" className={`${inter.variable} ${caveat.variable}`}>
        <head>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        </head>
        <body>
          {children}
          <Analytics />
          <OneSignalInit />
        </body>
      </html>
    </ClerkProvider>
  );
}
