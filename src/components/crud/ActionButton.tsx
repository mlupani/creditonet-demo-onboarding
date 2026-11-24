import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  /** Nombre accesible cuando tiene que decir más que `label` (por ejemplo, el registro). */
  accessibleName?: string;
  /** Oculta el texto por debajo de `sm` y deja un botón cuadrado de 40 px. */
  iconOnlyOnMobile?: boolean;
  /** Solo el ícono en todos los anchos: el texto queda como nombre accesible y tooltip. */
  iconOnly?: boolean;
  size?: "sm" | "md";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  describedBy?: string;
}

// Botón de acción estándar de los ABM: mismo contorno neutro para todas ("Agregar", "Exportar",
// "Editar", "Eliminar"…); solo cambian el ícono y el texto.
export function ActionButton({
  icon,
  label,
  accessibleName,
  iconOnlyOnMobile = false,
  iconOnly = false,
  size = "md",
  type = "button",
  onClick,
  disabled,
  loading,
  title,
  describedBy,
}: ActionButtonProps) {
  if (iconOnly) {
    return (
      <Button
        type={type}
        variant="outline"
        size="icon-sm"
        aria-label={accessibleName ?? label}
        aria-describedby={describedBy}
        title={title ?? label}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        className="cursor-pointer"
      >
        {!loading && icon}
      </Button>
    );
  }
  const mobile = iconOnlyOnMobile ? `max-sm:w-10 max-sm:px-0${size === "sm" ? " max-sm:h-10" : ""}` : "";
  return (
    <Button
      type={type}
      variant="outline"
      size={size}
      aria-label={accessibleName ?? (iconOnlyOnMobile ? label : undefined)}
      aria-describedby={describedBy}
      title={title}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      className={mobile}
    >
      {!loading && icon}
      <span className={iconOnlyOnMobile ? "hidden sm:inline" : undefined}>{label}</span>
    </Button>
  );
}
