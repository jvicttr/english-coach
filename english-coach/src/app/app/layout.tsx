import { AppHeader } from "@/components/AppHeader";
import { BottomNavFixed } from "@/components/BottomNav";
import { UserSync } from "@/components/UserSync";
import IOSInstallBanner from "@/components/IOSInstallBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserSync />
      <AppHeader />
      {children}
      <BottomNavFixed />
      <IOSInstallBanner />
    </>
  );
}
