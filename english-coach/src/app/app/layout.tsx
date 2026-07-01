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
      <div style={{ minHeight: "100dvh", background: "#0d0d0d" }}>
        {children}
      </div>
      <BottomNavFixed />
      <IOSInstallBanner />
    </>
  );
}
