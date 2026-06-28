import { BottomNavigation } from "@/components/shared/BottomNavigation";
import { ProcessingBanner } from "@/components/shared/ProcessingBanner";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background pb-24 pt-safe">
      <div className="mx-auto max-w-lg px-5 pb-4">
        <ProcessingBanner />
        {children}
        <p className="mt-8 pb-2 text-center text-sm text-pink-500">Made in Chrysty</p>
      </div>
      <BottomNavigation />
    </div>
  );
}
