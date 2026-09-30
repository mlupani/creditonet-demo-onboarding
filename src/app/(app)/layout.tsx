import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { GuardaRol } from "@/components/layout/GuardaRol";
import { ToastNotificaciones } from "@/components/layout/ToastNotificaciones";
import { RolProvider } from "@/lib/rol-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RolProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1">
              <GuardaRol>{children}</GuardaRol>
            </main>
          </div>
          <ToastNotificaciones />
        </div>
      </RolProvider>
    </Suspense>
  );
}
