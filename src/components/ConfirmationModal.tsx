"use client";

import type { ReactNode } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export interface ResumenRow {
  label: string;
  value: ReactNode;
}

export function ConfirmationModal({
  open,
  title,
  descripcion,
  rows,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  tone = "primary",
  loading = false,
}: {
  open: boolean;
  title: string;
  descripcion?: string;
  rows: ResumenRow[];
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "primary" | "danger" | "success";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            onClick={onConfirm}
            loading={loading}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {descripcion && <p className="text-sm text-ink-600">{descripcion}</p>}
      <dl className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-ink-500">{row.label}</dt>
            <dd className="text-right text-sm font-semibold tabular-nums text-ink-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
