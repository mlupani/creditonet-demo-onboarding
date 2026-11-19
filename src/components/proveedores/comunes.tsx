"use client";

import { useMemo, useState } from "react";
import { bancoTexto, nombreCaja } from "@/lib/caja-operaciones";
import { cuentaCorriente, formatearCuit, saldoComprobante, pagadoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import {
  ESTADO_COMPROBANTE_LABEL,
  MEDIO_PAGO_LABEL,
  type Comprobante,
  type EstadoComprobanteId,
  type PagoProveedor,
  type Proveedor,
} from "@/lib/proveedores-tipos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { descargarXlsx } from "@/components/caja/comunes";

const formato = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Importes en pesos con centavos (los comprobantes llevan decimales; `dinero` de caja redondea).
export const pesos = (v: number) => `${v < 0 ? "−" : ""}$ ${formato.format(Math.abs(v))}`;

// Importe escrito a mano: acepta coma o punto decimal; vacío o inválido vale 0.
export const aNumero = (s: string): number => {
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
export const textoNumero = (n: number) => (n === 0 ? "" : String(n));

export const numeroComprobante = (c: Pick<Comprobante, "prefijo" | "numero">) => `${c.prefijo}-${c.numero}`;

const TONO_ESTADO: Record<EstadoComprobanteId, "info" | "success" | "danger" | "warning" | "neutral"> = {
  PREAPROBADO: "info",
  PARA_LIQUIDAR: "success",
  RECHAZADO: "danger",
  PAGO_PARCIAL: "warning",
  PAGADO: "neutral",
  ANULADO: "neutral",
};

export function EstadoComprobanteBadge({ estado }: { estado: EstadoComprobanteId }) {
  return <StatusBadge tone={TONO_ESTADO[estado]}>{ESTADO_COMPROBANTE_LABEL[estado]}</StatusBadge>;
}

export const nombreProveedor = (proveedores: Proveedor[], id: string) =>
  proveedores.find((p) => p.id === id)?.razonSocial ?? id;

export const origenTexto = (p: Pick<PagoProveedor, "origenTipo" | "origenId">) =>
  p.origenTipo === "CAJA" ? nombreCaja(p.origenId) : bancoTexto(p.origenId);

// Pendiente / Pago parcial / Pagado, tal como lo pide la cuenta corriente (v2, 6.3).
export type EstadoCuenta = "PENDIENTE" | "PAGO_PARCIAL" | "PAGADO";
export const ESTADO_CUENTA_LABEL: Record<EstadoCuenta, string> = {
  PENDIENTE: "Pendiente",
  PAGO_PARCIAL: "Pago parcial",
  PAGADO: "Pagado",
};
export function estadoCuenta(c: Comprobante, pagos: PagoProveedor[]): EstadoCuenta {
  const pagado = pagadoDe(c.id, pagos);
  if (pagado <= 0) return "PENDIENTE";
  return saldoComprobante(c, pagos) <= 0.001 ? "PAGADO" : "PAGO_PARCIAL";
}

export function Pestanas<T extends string>({
  valor,
  opciones,
  onChange,
  etiqueta,
}: {
  valor: T;
  opciones: [T, string][];
  onChange: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex w-fit flex-wrap gap-0.5 rounded-lg bg-ink-100 p-0.5">
      {opciones.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={valor === id}
          onClick={() => onChange(id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${valor === id ? "bg-white text-brand-700 shadow-xs" : "text-ink-500 hover:text-ink-800"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Th({ children, derecha }: { children?: React.ReactNode; derecha?: boolean }) {
  return <th className={`px-3 py-2.5 ${derecha ? "text-right" : ""}`}>{children}</th>;
}

export const ENCABEZADO = "bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400";

// Cuenta corriente de un proveedor (v2, 6.3): se arma sola con los comprobantes y los pagos, no se edita.
export function CuentaCorriente({ proveedorId }: { proveedorId: string }) {
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const tipos = useTiposComprobante();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [estado, setEstado] = useState<"" | EstadoCuenta>("");

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const cc = useMemo(
    () => cuentaCorriente(proveedorId, comprobantes, pagos, tipos, { desde: desde || undefined, hasta: hasta || undefined }),
    [proveedorId, comprobantes, pagos, tipos, desde, hasta]
  );

  const filas = cc.filas.filter((f) => {
    const c = comprobantes.find((x) => x.id === f.comprobanteId);
    if (!c) return false;
    if (tipoId && c.tipoId !== tipoId) return false;
    if (estado && estadoCuenta(c, pagos) !== estado) return false;
    return true;
  });
  const pagoDe = (id: string) => pagos.find((p) => p.id === id);

  const exportar = () =>
    descargarXlsx(`cuenta-corriente-${proveedorId}.xlsx`, "Cuenta corriente", [
      ["Proveedor", proveedor?.razonSocial ?? proveedorId, "Saldo inicial", String(cc.saldoInicial), "Saldo actual", String(cc.saldoActual)],
      ["Fecha de carga o pago", "Fecha del comprobante", "Tipo", "Número u orden de pago", "Importe", "Pagos aplicados", "Saldo pendiente", "Saldo acumulado", "Estado"],
      ...filas.map((f) => {
        const c = comprobantes.find((x) => x.id === f.comprobanteId);
        return [
          f.fechaCarga,
          f.fechaComprobante,
          f.tipoDescripcion,
          f.numero,
          String(f.importe),
          f.tipoFila === "COMPROBANTE" ? String(f.pagosAplicados) : "",
          f.tipoFila === "COMPROBANTE" ? String(f.saldoPendiente) : "",
          String(f.saldoAcumulado),
          c ? ESTADO_CUENTA_LABEL[estadoCuenta(c, pagos)] : "",
        ];
      }),
    ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="cc-desde" label="Desde (carga o pago)" type="date" value={desde} onChange={setDesde} />
        <FormField id="cc-hasta" label="Hasta" type="date" value={hasta} onChange={setHasta} />
        <SelectField
          id="cc-tipo"
          label="Tipo de comprobante"
          value={tipoId}
          onChange={setTipoId}
          placeholder="Todos"
          options={tipos.map((t) => ({ value: t.id, label: t.descripcion }))}
        />
        <SelectField
          id="cc-estado"
          label="Estado"
          value={estado}
          onChange={(v) => setEstado(v as "" | EstadoCuenta)}
          placeholder="Todos"
          options={(Object.keys(ESTADO_CUENTA_LABEL) as EstadoCuenta[]).map((e) => ({ value: e, label: ESTADO_CUENTA_LABEL[e] }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Saldo inicial del período</p>
          <p className="text-xl font-bold tabular-nums text-ink-900">{pesos(cc.saldoInicial)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Saldo actual (lo que se le debe)</p>
          <p className="text-xl font-bold tabular-nums text-ink-900">{pesos(cc.saldoActual)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-ink-500">
          La cuenta corriente se arma sola con la carga de comprobantes y los pagos: no se edita a mano. Sólo cuentan los comprobantes ya
          autorizados.
        </p>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay movimientos para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead>
                <tr className={ENCABEZADO}>
                  <Th>Carga / pago</Th>
                  <Th>Comprobante</Th>
                  <Th>Tipo</Th>
                  <Th>Número / OP</Th>
                  <Th derecha>Importe</Th>
                  <Th derecha>Pagos aplicados</Th>
                  <Th derecha>Saldo pendiente</Th>
                  <Th derecha>Saldo acumulado</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filas.map((f) => {
                  const c = comprobantes.find((x) => x.id === f.comprobanteId);
                  const pago = f.tipoFila === "PAGO" ? pagoDe(f.id) : undefined;
                  return (
                    <tr key={f.clave} className={f.tipoFila === "PAGO" ? "bg-ink-25/60" : undefined}>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-700">{f.fechaCarga}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-700">{f.fechaComprobante || "—"}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {f.tipoDescripcion}
                        {pago && (
                          <span className="block text-xs text-ink-400">
                            {MEDIO_PAGO_LABEL[pago.medio]} · {origenTexto(pago)} · aplicado a {pago.comprobanteId}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-ink-700">{f.numero}</td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${f.importe < 0 ? "text-success-700" : "text-ink-900"}`}>
                        {pesos(f.importe)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-700">{f.tipoFila === "COMPROBANTE" ? pesos(f.pagosAplicados) : ""}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-700">{f.tipoFila === "COMPROBANTE" ? pesos(f.saldoPendiente) : ""}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(f.saldoAcumulado)}</td>
                      <td className="px-3 py-3">
                        {c && <StatusBadge tone={estadoCuenta(c, pagos) === "PAGADO" ? "neutral" : estadoCuenta(c, pagos) === "PAGO_PARCIAL" ? "warning" : "info"}>{ESTADO_CUENTA_LABEL[estadoCuenta(c, pagos)]}</StatusBadge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export const cuitTexto = (p: Proveedor | undefined) => (p ? formatearCuit(p.cuit) : "");
