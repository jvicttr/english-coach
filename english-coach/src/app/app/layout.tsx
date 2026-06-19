import { AppHeader } from "@/components/AppHeader";
import { BottomNavFixed } from "@/components/BottomNav";
import { UserSync } from "@/components/UserSync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserSync />
      <AppHeader />
      {children}
      <BottomNavFixed />
    </>
  );
}
