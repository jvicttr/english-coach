import { AppHeader } from "@/components/AppHeader";
import { BottomNavBar } from "@/components/BottomNav";
import { UserSync } from "@/components/UserSync";
import IOSInstallBanner from "@/components/IOSInstallBanner";
import NotificationPromptBanner from "@/components/NotificationPromptBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserSync />
      <AppHeader />
      <NotificationPromptBanner />
      {/* Flex column fixo que ocupa toda a tela — nav é filho estático, não fixed */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        <div
          data-scroll-container
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#0d0d0d", WebkitOverflowScrolling: "touch" as const }}
        >
          {children}
        </div>
        <BottomNavBar />
      </div>
      <IOSInstallBanner />
    </>
  );
}
