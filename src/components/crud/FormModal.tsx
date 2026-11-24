"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { IconPencil, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Diálogo estándar de alta y edición, con el mismo diseño de alerta que la confirmación de
// eliminación: ícono centrado (más o lápiz), título, descripción opcional, los campos y dos botones
// del mismo ancho, "Cancelar" y "Agregar"/"Guardar". Enter en un campo graba igual que el botón.
export function FormModal({
  open = true,
  mode,
  title,
  description,
  submitLabel,
  onSubmit,
  onCancel,
  loading = false,
  maxWidth = "max-w-md",
  children,
}: {
  open?: boolean;
  mode: "create" | "edit";
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: () => void;
  onCancel: () => void;
  loading?: boolean;
  maxWidth?: string;
  children?: ReactNode;
}) {
  const formId = useId();
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeDisabled={loading}
      title={title}
      maxWidth={maxWidth}
      variant="alert"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="soft" size="lg" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} size="lg" loading={loading}>
            {submitLabel ?? (mode === "edit" ? "Guardar" : "Agregar")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          {mode === "edit" ? <IconPencil width={30} height={30} /> : <IconPlus width={30} height={30} />}
        </span>
        <h3 className="mt-4 text-lg font-bold text-ink-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      <form id={formId} noValidate onSubmit={enviar} className="mt-5 space-y-4">
        {children}
      </form>
    </Modal>
  );
}
