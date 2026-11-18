"use client";

import { useState, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import { formatNumber } from "@/lib/format";
import { crearXlsx } from "@/lib/xlsx";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { esResponsable } from "@/lib/caja-reglas";
import {
  fijarFechaDemo,
  fijarHoraDemo,
  fijarUsuarioActual,
  hoy,
  horaActual,
  nombreUsuario,
  useFechaDemo,
  useHoraDemo,
  useUsuarioActual,
} from "@/lib/caja-store";
import { ROL_CAJA_LABEL, SIMBOLO, type Caja, type Moneda, type UsuarioCaja } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";

export const dinero = (moneda: Moneda, valor: number) =>
  `${valor < 0 ? "−" : ""}${SIMBOLO[moneda]} ${formatNumber(Math.abs(valor))}`;

export const dineroConSigno = (moneda: Moneda, valor: number) =>
  valor === 0 ? dinero(moneda, 0) : `${valor > 0 ? "+" : ""}${dinero(moneda, valor)}`;

export const nombreRoles = (u: UsuarioCaja) => u.roles.map((r) => ROL_CAJA_LABEL[r]).join(" y ");

export function descargarXlsx(nombreArchivo: string, hoja: string, filas: string[][]) {
  const blob = new Blob([crearXlsx(hoja, filas) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Cajas que el usuario puede operar: las activas donde figura como responsable.
export const cajasPropias = (cajas: Caja[], usuario: UsuarioCaja) =>
  cajas.filter((c) => c.estado === "ACTIVO" && esResponsable(c, usuario.id));

export const CLASE_INPUT =
  "h-10 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function CajaBarra() {
  const usuario = useUsuarioActual();
  const hora = useHoraDemo();
  const fecha = useFechaDemo();
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Actuar como
        </span>
        <select
          value={usuario.id}
          onChange={(e) => fijarUsuarioActual(e.target.value)}
          aria-label="Actuar como"
          className={`${CLASE_INPUT} w-64`}
        >
          {USUARIOS_CAJA.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} · {nombreRoles(u)}
            </option>
          ))}
        </select>
      </label>
      <div className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Fecha operativa de la demo
        </span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && fijarFechaDemo(e.target.value)}
            aria-label="Fecha operativa de la demo"
            className={`${CLASE_INPUT} w-40`}
          />
          <Button size="sm" variant="outline" onClick={() => fijarFechaDemo("")}>
            Fecha real
          </Button>
        </div>
      </div>
      <div className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Hora operativa de la demo
        </span>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={hora}
            onChange={(e) => fijarHoraDemo(e.target.value)}
            aria-label="Hora operativa de la demo"
            className={`${CLASE_INPUT} w-32`}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date();
              fijarHoraDemo(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
            }}
          >
            Hora actual
          </Button>
        </div>
      </div>
      <p className="min-w-56 flex-1 text-xs text-ink-500">
        Simulación de demo: la fecha y la hora son simuladas para poder probar apertura, cierre, feriados y alertas
        a cualquier día y hora, y el usuario se cambia para probar que nadie aprueba lo que cargó.
      </p>
    </div>
  );
}

export function PaginaCaja({
  titulo,
  descripcion,
  seccion = "Caja",
  children,
}: {
  titulo: string;
  descripcion: string;
  seccion?: string;
  children: ReactNode;
}) {
  const { hidratado } = useApplication();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Módulo Caja y Bancos · {seccion}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{titulo}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">{descripcion}</p>
      </div>
      <div className="mt-6">
        <CajaBarra />
        {hidratado ? (
          children
        ) : (
          <Card className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</Card>
        )}
      </div>
    </div>
  );
}

export function ErrorBanner({ error, titulo = "No se pudo completar la operación" }: { error: string | null; titulo?: string }) {
  return error ? (
    <Banner tone="error" title={titulo} className="mt-4">
      {error}
    </Banner>
  ) : null;
}

export function SelectorCaja({
  cajas,
  valor,
  onChange,
  label = "Caja",
  todas,
}: {
  cajas: Caja[];
  valor: string;
  onChange: (id: string) => void;
  label?: string;
  todas?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${CLASE_INPUT} w-72`}>
        {todas && <option value="">{todas}</option>}
        {cajas.length === 0 && !todas && <option value="">Sin cajas disponibles</option>}
        {cajas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

// Modal con una nota (obligatoria o no) para aprobar, rechazar o resolver. `onConfirmar` devuelve un
// error para mostrar o null si salió bien.
export function NotaModal({
  open,
  titulo,
  descripcion,
  etiquetaNota = "Motivo",
  requerida,
  confirmar,
  tono = "primary",
  onClose,
  onConfirmar,
  children,
}: {
  open: boolean;
  titulo: string;
  descripcion?: string;
  etiquetaNota?: string;
  requerida?: boolean;
  confirmar: string;
  tono?: "primary" | "danger" | "success";
  onClose: () => void;
  onConfirmar: (nota: string) => string | null;
  children?: ReactNode;
}) {
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cerrar = () => {
    setNota("");
    setError(null);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={titulo}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant={tono}
            onClick={() => {
              const e = onConfirmar(nota);
              if (e) setError(e);
              else cerrar();
            }}
          >
            {confirmar}
          </Button>
        </div>
      }
    >
      {descripcion && <p className="mb-3 text-sm text-ink-600">{descripcion}</p>}
      {children}
      <FormField
        id="caja-nota"
        label={etiquetaNota}
        required={requerida}
        value={nota}
        onChange={setNota}
        className="mt-3"
      />
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export const fechaHoraMov = (fecha: string, hora: string) => `${fecha} ${hora}`;
export const quien = (id: string | undefined) => (id ? nombreUsuario(id) : "—");
export { horaActual, hoy };
