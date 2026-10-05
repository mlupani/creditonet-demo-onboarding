"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { useRol } from "@/lib/rol-context";
import { esSuperior, puedeVer } from "@/lib/roles";
import { Tooltip } from "@/components/ui/Tooltip";
import { alternarSidebarColapsado, useSidebarColapsado } from "@/lib/sidebar-colapsado";
import {
  IconBarChart,
  IconBell,
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconClipboardPlus,
  IconChevronsLeft,
  IconChevronsRight,
  IconCreditCard,
  IconFileStack,
  IconGitBranch,
  IconHome,
  IconLandmark,
  IconPhone,
  IconRefresh,
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

// Bandejas operativas de la Guía §7: canal de venta → analista de riesgo → chequeo telefónico
// (si el producto lo pide) → liquidación.
const NAV: NavItem[] = [
  { label: "Bandeja canal de venta", href: "/", icon: IconHome, disponible: true },
  { label: "Solicitar crédito", href: "/onboarding", icon: IconClipboardPlus, disponible: true },
  { label: "Bandeja de análisis", href: "/analisis", icon: IconFileStack, disponible: true },
  { label: "Bandeja de chequeo", href: "/chequeo", icon: IconPhone, disponible: true },
  { label: "Diagrama de flujo", href: "/graph", icon: IconGitBranch, disponible: true },
  { label: "Productos", href: "/productos", icon: IconBriefcase, disponible: true },
  { label: "Organismos", href: "/organismos", icon: IconBuilding, disponible: true },
  { label: "Planes de cuotas", href: "/planes", icon: IconCalendar, disponible: true },
  { label: "Liquidación", icon: IconLandmark },
  { label: "Clientes", icon: IconUsers },
  { label: "Créditos", icon: IconCreditCard },
  { label: "Motor de riesgo", href: "/motor-riesgo", icon: IconShieldCheck, disponible: true },
  { label: "Notificaciones", href: "/notificaciones", icon: IconBell, disponible: true },
  { label: "Reportes", icon: IconBarChart },
  { label: "Parámetros", href: "/parametros", icon: IconSettings, disponible: true },
];

// `compacto`: sidebar de escritorio colapsado, solo íconos (la etiqueta pasa a tooltip).
function NavList({ onNavigate, compacto }: { onNavigate?: () => void; compacto?: boolean }) {
  const pathname = usePathname();
  const { rol } = useRol();
  // Sólo se listan las pantallas del rol; los módulos "Pronto" (sin ruta) son del superior.
  const items = NAV.filter((i) => (i.href ? puedeVer(rol, i.href) : esSuperior(rol)));
  return (
    <nav className={`flex flex-1 flex-col gap-1 px-3 ${compacto ? "items-center" : ""}`}>
      {items.map((item) => {
        const activo = item.href && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
        if (!item.disponible) {
          return (
            <Tooltip
              key={item.label}
              label={compacto ? `${item.label} · próximamente` : "Módulo disponible próximamente en la demo"}
            >
              <span
                aria-label={compacto ? item.label : undefined}
                className={`flex cursor-not-allowed items-center gap-3 rounded-lg py-2 text-sm font-medium text-ink-400 ${
                  compacto ? "justify-center px-2.5" : "w-full px-3"
                }`}
              >
                <item.icon />
                {!compacto && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-400">
                      Pronto
                    </span>
                  </>
                )}
              </span>
            </Tooltip>
          );
        }
        const link = (
          <Link
            key={item.label}
            href={item.href!}
            onClick={onNavigate}
            aria-label={compacto ? item.label : undefined}
            className={`relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition ${
              compacto ? "justify-center px-2.5" : "px-3"
            } ${
              activo
                ? "bg-brand-50 text-brand-700"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            }`}
          >
            {activo && (
              <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />
            )}
            <item.icon />
            {!compacto && item.label}
          </Link>
        );
        return compacto ? (
          <Tooltip key={item.label} label={item.label}>
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate, compacto }: { onNavigate?: () => void; compacto?: boolean }) {
  const { reiniciarDemo } = useApplication();
  const reiniciar = () => {
    reiniciarDemo();
    onNavigate?.();
  };
  return (
    <div className="flex h-full flex-col py-5">
      <div className={`mb-6 flex items-center gap-2.5 ${compacto ? "justify-center px-3" : "px-5"}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white shadow-sm">
          C
        </span>
        {!compacto && (
          <div>
            <p className="text-[15px] font-bold leading-tight tracking-tight text-ink-900">
              CreditoNet
            </p>
            <p className="text-[11px] font-medium text-ink-400">Módulo Onboarding</p>
          </div>
        )}
      </div>
      <NavList onNavigate={onNavigate} compacto={compacto} />
      {compacto ? (
        <div className="mt-auto flex justify-center px-3 pt-6">
          <Tooltip label="Reiniciar demo">
            <button
              onClick={reiniciar}
              aria-label="Reiniciar demo"
              className="rounded-lg border border-ink-200 p-2.5 text-ink-500 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-700"
            >
              <IconRefresh />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="mt-auto px-5 pt-6">
          <button
            onClick={reiniciar}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-500 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-700"
          >
            Reiniciar demo
          </button>
          <p className="mt-3 text-center text-[11px] font-medium text-ink-400">
            Demo interactiva · v0.3
          </p>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { menuAbierto, setMenuAbierto } = useApplication();
  const colapsado = useSidebarColapsado();
  return (
    <>
      <aside
        className={`sticky top-0 z-40 hidden h-screen shrink-0 border-r border-ink-200 bg-white transition-[width] duration-200 lg:block ${
          colapsado ? "w-16" : "w-64"
        }`}
      >
        <SidebarContent compacto={colapsado} />
        <button
          onClick={alternarSidebarColapsado}
          aria-label={colapsado ? "Expandir menú lateral" : "Colapsar menú lateral"}
          aria-expanded={!colapsado}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-sm transition hover:bg-ink-50 hover:text-ink-900"
        >
          {colapsado ? (
            <IconChevronsRight width={14} height={14} />
          ) : (
            <IconChevronsLeft width={14} height={14} />
          )}
        </button>
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
