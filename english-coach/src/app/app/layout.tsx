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
      <div data-scroll-container style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden", background: "#0d0d0d", WebkitOverflowScrolling: "touch" as const, paddingBottom: "calc(47px + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </div>
      <BottomNavFixed />
      <IOSInstallBanner />
    </>
  );
}
