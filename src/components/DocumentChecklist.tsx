"use client";

import type { DocItem } from "@/lib/types";
import { Button } from "./ui/Button";
import { IconCheck, IconClock, IconEye, IconUpload } from "@/components/icons";

export function DocumentChecklist({
  docs,
  uploadingId,
  onUpload,
}: {
  docs: DocItem[];
  uploadingId: string | null;
  onUpload: (id: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {docs.map((doc) => {
        const cargado = doc.estado === "CARGADO";
        const subiendo = uploadingId === doc.id;
        return (
          <li
            key={doc.id}
            className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
              cargado
                ? "border-success-200 bg-success-50/60"
                : subiendo
                  ? "animate-pulse border-brand-200 bg-brand-50/60"
                  : "border-ink-200 bg-white"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                cargado
                  ? "border-success-200 bg-success-100 text-success-600"
                  : "border-ink-200 bg-ink-50 text-ink-400"
              }`}
            >
              {cargado ? (
                <IconCheck width={18} height={18} strokeWidth={2.5} />
              ) : subiendo ? (
                <IconUpload width={18} height={18} />
              ) : (
                <IconClock width={18} height={18} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{doc.nombre}</p>
              <p
                className={`mt-0.5 truncate text-xs ${
                  cargado ? "font-medium text-success-700" : "text-ink-500"
                }`}
              >
                {cargado
                  ? `${doc.archivo} · ${doc.detalle}`
                  : subiendo
                    ? "Subiendo documento…"
                    : "○ Pendiente de adjuntar"}
              </p>
            </div>
            {cargado ? (
              <Button size="sm" variant="ghost" type="button">
                <IconEye width={15} height={15} />
                Ver
              </Button>
            ) : (
              <Button
                size="sm"
                variant={subiendo ? "subtle" : "outline"}
                onClick={() => onUpload(doc.id)}
                disabled={subiendo}
              >
                {subiendo ? "Subiendo…" : "Adjuntar"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
