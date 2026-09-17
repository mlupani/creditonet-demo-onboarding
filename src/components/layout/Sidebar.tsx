"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  IconBarChart,
  IconClipboardPlus,
  IconCreditCard,
  IconFileStack,
  IconGitBranch,
  IconHome,
  IconLandmark,
  IconSettings,
  IconShieldCheck,
  IconUsers,
  IconX,
} from "@/components/icons";

interface NavItem {
  label: string;
  href?: string;
  icon: (props: { width?: number; height?: number }) => React.ReactNode;
  disponible?: boolean;
}

// Bandejas operativas de la Guía §7: canal de venta → analista de riesgo → liquidación.
const NAV: NavItem[] = [
  { label: "Bandeja canal de venta", href: "/", icon: IconHome, disponible: true },
  { label: "Solicitar crédito", href: "/onboarding", icon: IconClipboardPlus, disponible: true },
  { label: "Bandeja del analista", href: "/analisis", icon: IconFileStack, disponible: true },
  { label: "Diagrama de flujo", href: "/graph", icon: IconGitBranch, disponible: true },
  { label: "Liquidación", icon: IconLandmark },
  { label: "Clientes", icon: IconUsers },
  { label: "Créditos", icon: IconCreditCard },
  { label: "Motor de riesgo", icon: IconShieldCheck },
  { label: "Reportes", icon: IconBarChart },
  { label: "Parámetros", icon: IconSettings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const activo = item.href && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
        if (!item.disponible) {
          return (
            <Tooltip key={item.label} label="Módulo disponible próximamente en la demo">
              <span className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-400">
                <item.icon />
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-400">
                  Pronto
                </span>
              </span>
            </Tooltip>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href!}
            onClick={onNavigate}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activo
                ? "bg-brand-50 text-brand-700"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            }`}
          >
            {activo && (
              <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />
            )}
            <item.icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { reiniciarDemo } = useApplication();
  return (
    <div className="flex h-full flex-col py-5">
      <div className="mb-6 flex items-center gap-2.5 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white shadow-sm">
          C
        </span>
        <div>
          <p className="text-[15px] font-bold leading-tight tracking-tight text-ink-900">
            CreditoNet
          </p>
          <p className="text-[11px] font-medium text-ink-400">Módulo Onboarding</p>
        </div>
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto px-5 pt-6">
        <button
          onClick={() => {
            reiniciarDemo();
            onNavigate?.();
          }}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-500 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-700"
        >
          Reiniciar demo
        </button>
        <p className="mt-3 text-center text-[11px] font-medium text-ink-400">
          Demo interactiva · v0.3
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { menuAbierto, setMenuAbierto } = useApplication();
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink-900/50 backdrop-blur-[2px]"
            onClick={() => setMenuAbierto(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-72 animate-fade-in bg-white shadow-lift">
            <button
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100"
            >
              <IconX width={18} height={18} />
            </button>
            <div className="w-full overflow-y-auto scroll-thin">
              <SidebarContent onNavigate={() => setMenuAbierto(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
