"use client";

import type { ReactNode } from "react";
import { IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Confirmación estándar de eliminación (y de suspensión, cambiando textos e ícono): ícono de
// peligro, título, pregunta, nombre del registro y "Cancelar" / "Confirmar". Está abierto mientras
// `itemName` no sea `null`.
export function DeleteConfirmationModal({
  itemName,
  title = "Eliminar",
  question = "¿Confirma que desea eliminar el siguiente ítem?",
  confirmLabel = "Confirmar",
  icon = <IconTrash width={30} height={30} />,
  onConfirm,
  onCancel,
  loading = false,
  children,
}: {
  itemName: string | null;
  title?: string;
  question?: string;
  confirmLabel?: string;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={itemName !== null}
      onClose={onCancel}
      closeDisabled={loading}
      title={title}
      maxWidth="max-w-sm"
      variant="alert"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="soft" size="lg" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm} loading={loading} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">{icon}</span>
        <h3 className="mt-4 text-lg font-bold text-ink-900">{title}</h3>
        <p className="mt-1 text-sm text-ink-500">{question}</p>
      </div>
      <p className="mt-4 break-words rounded-xl border border-ink-200 bg-ink-25 px-4 py-2.5 text-sm font-semibold text-ink-900">
        {itemName}
      </p>
      {children && <div className="mt-3">{children}</div>}
    </Modal>
  );
}
