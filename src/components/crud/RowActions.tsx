"use client";

import type { ReactNode } from "react";
import { IconEye, IconPauseCircle, IconPencil, IconPlayCircle, IconTrash } from "@/components/icons";
import { ActionButton } from "./ActionButton";

/** Acción propia de la sección (por ejemplo "Historial") con el aspecto estándar. */
export interface AccionFila {
  id: string;
  label: string;
  accessibleName?: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export interface RowActionsProps {
  /** Nombre del registro: completa el nombre accesible ("Editar Sucursal Centro"). */
  itemName: string;
  disabled?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  /** `true` muestra "Reactivar" (con `onReactivate`); `false` muestra "Suspender" (con `onSuspend`). */
  suspended?: boolean;
  onSuspend?: () => void;
  onReactivate?: () => void;
  /** Reemplazan "Suspender"/"Reactivar" cuando el estado se llama distinto (por ejemplo "Desactivar"). */
  suspendLabel?: string;
  reactivateLabel?: string;
  onDelete?: () => void;
  deleteDisabledReason?: string;
  leadingActions?: AccionFila[];
  trailingActions?: AccionFila[];
}

// Acciones por registro, solo con ícono: Ver, Editar, Suspender/Reactivar y Eliminar. Cada una se
// dibuja solo si la sección pasa su manejador.
export function RowActions({
  itemName,
  disabled = false,
  onView,
  onEdit,
  suspended = false,
  onSuspend,
  onReactivate,
  suspendLabel = "Suspender",
  reactivateLabel = "Reactivar",
  onDelete,
  deleteDisabledReason,
  leadingActions = [],
  trailingActions = [],
}: RowActionsProps) {
  const acciones: AccionFila[] = [...leadingActions];
  if (onView) acciones.push({ id: "view", label: "Ver", icon: <IconEye width={14} height={14} />, onClick: onView });
  if (onEdit) acciones.push({ id: "edit", label: "Editar", icon: <IconPencil width={14} height={14} />, onClick: onEdit });
  if (suspended ? onReactivate : onSuspend) {
    acciones.push(
      suspended
        ? { id: "reactivate", label: reactivateLabel, icon: <IconPlayCircle width={14} height={14} />, onClick: onReactivate! }
        : { id: "suspend", label: suspendLabel, icon: <IconPauseCircle width={14} height={14} />, onClick: onSuspend! }
    );
  }
  if (onDelete) {
    acciones.push({
      id: "delete",
      label: "Eliminar",
      icon: <IconTrash width={14} height={14} />,
      onClick: onDelete,
      disabled: Boolean(deleteDisabledReason),
      title: deleteDisabledReason,
    });
  }
  acciones.push(...trailingActions);
  if (acciones.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      {acciones.map((a) => (
        <ActionButton
          key={a.id}
          icon={a.icon}
          label={a.label}
          accessibleName={a.accessibleName ?? `${a.label} ${itemName}`}
          iconOnly
          size="sm"
          onClick={a.onClick}
          disabled={disabled || a.disabled}
          title={a.title}
        />
      ))}
    </div>
  );
}
