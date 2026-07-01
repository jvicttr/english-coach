import { AppHeader } from "@/components/AppHeader";
import { BottomNavFixed } from "@/components/BottomNav";
import { UserSync } from "@/components/UserSync";
import IOSInstallBanner from "@/components/IOSInstallBanner";
import NotificationPromptBanner from "@/components/NotificationPromptBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserSync />
      <AppHeader />
      <NotificationPromptBanner />
      <div style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: "#0d0d0d", WebkitOverflowScrolling: "touch" as const }}>
        {children}
      </div>
      <BottomNavFixed />
      <IOSInstallBanner />
    </>
  );
}
