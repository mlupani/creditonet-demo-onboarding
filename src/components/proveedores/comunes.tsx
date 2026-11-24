"use client";

import { useMemo, useState } from "react";
import { bancoTexto, nombreCaja } from "@/lib/caja-operaciones";
import { hoy } from "@/lib/caja-store";
import { creditoDe, cuentaCorriente, diasDeAtraso, formatearCuit, saldoComprobante, pagadoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, useOrdenesPago, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import {
  ESTADO_COMPROBANTE_LABEL,
  ESTADO_ORDEN_LABEL,
  MEDIO_PAGO_LABEL,
  type Comprobante,
  type EstadoComprobanteId,
  type EstadoOrdenPago,
  type OrdenPago,
  type PagoProveedor,
  type Proveedor,
} from "@/lib/proveedores-tipos";
import { Button } from "@/components/ui/Button";
import { Campo, Cifra, INPUT_COMPACTO, Pill, TablaCompacta, Td, Th, type Fase } from "@/components/caja/compacto";
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

const FASE_ESTADO: Record<EstadoComprobanteId, Fase> = {
  PREAPROBADO: "inicial",
  PARA_LIQUIDAR: "espera",
  EN_ORDEN_PAGO: "proceso",
  RECHAZADO: "rechazo",
  PAGO_PARCIAL: "espera",
  PAGADO: "ok",
  ANULADO: "rechazo",
};

export function EstadoComprobanteBadge({ estado }: { estado: EstadoComprobanteId }) {
  return <Pill fase={FASE_ESTADO[estado]}>{ESTADO_COMPROBANTE_LABEL[estado]}</Pill>;
}

const FASE_ORDEN: Record<EstadoOrdenPago, Fase> = {
  BORRADOR: "inicial",
  EMITIDA: "proceso",
  AUTORIZADA: "espera",
  PENDIENTE_TRANSFERENCIA: "espera",
  PAGADA: "ok",
  RECHAZADA: "rechazo",
  ANULADA: "rechazo",
};

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrdenPago }) {
  return <Pill fase={FASE_ORDEN[estado]}>{ESTADO_ORDEN_LABEL[estado]}</Pill>;
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
export function estadoCuenta(c: Comprobante, pagos: PagoProveedor[], ordenes: OrdenPago[] = []): EstadoCuenta {
  const aplicado = pagadoDe(c.id, pagos) + creditoDe(c.id, ordenes);
  if (aplicado <= 0) return "PENDIENTE";
  return saldoComprobante(c, pagos, ordenes) <= 0.001 ? "PAGADO" : "PAGO_PARCIAL";
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
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${valor === id ? "bg-navy-800 text-white shadow-xs" : "text-ink-600 hover:text-ink-900"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export { Th };

export const ENCABEZADO = "bg-navy-800 text-[11px] font-bold text-white";

// Cuenta corriente de un proveedor (v2, 6.3): se arma sola con los comprobantes y los pagos, no se edita.
export function CuentaCorriente({ proveedorId }: { proveedorId: string }) {
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const ordenes = useOrdenesPago();
  const tipos = useTiposComprobante();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [estado, setEstado] = useState<"" | EstadoCuenta>("");

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const cc = useMemo(
    () => cuentaCorriente(proveedorId, comprobantes, pagos, tipos, { desde: desde || undefined, hasta: hasta || undefined }, ordenes),
    [proveedorId, comprobantes, pagos, ordenes, tipos, desde, hasta]
  );

  const filas = cc.filas.filter((f) => {
    const c = comprobantes.find((x) => x.id === f.comprobanteId);
    if (!c) return false;
    if (tipoId && c.tipoId !== tipoId) return false;
    if (estado && estadoCuenta(c, pagos, ordenes) !== estado) return false;
    return true;
  });
  const pagoDe = (id: string) => pagos.find((p) => p.id === id);
  // Días de atraso a la fecha operativa: sólo para facturas (suman deuda) con saldo pendiente.
  const atrasoDe = (f: (typeof cc.filas)[number]) =>
    f.tipoFila === "COMPROBANTE" && f.importe > 0 && f.saldoPendiente > 0 ? diasDeAtraso(f.vencimiento, hoy()) : undefined;

  const exportar = () =>
    descargarXlsx(`cuenta-corriente-${proveedorId}.xlsx`, "Cuenta corriente", [
      ["Proveedor", proveedor?.razonSocial ?? proveedorId, "Saldo inicial", String(cc.saldoInicial), "Saldo actual", String(cc.saldoActual)],
      ["Fecha de carga o pago", "Fecha del comprobante", "Vencimiento", "Días de atraso", "Tipo", "Número u orden de pago", "Importe", "Pagos aplicados", "Saldo pendiente", "Saldo acumulado", "Estado"],
      ...filas.map((f) => {
        const c = comprobantes.find((x) => x.id === f.comprobanteId);
        return [
          f.fechaCarga,
          f.fechaComprobante,
          f.vencimiento,
          String(atrasoDe(f) ?? ""),
          f.tipoDescripcion,
          f.numero,
          String(f.importe),
          f.tipoFila === "COMPROBANTE" ? String(f.pagosAplicados) : "",
          f.tipoFila === "COMPROBANTE" ? String(f.saldoPendiente) : "",
          String(f.saldoAcumulado),
          c ? ESTADO_CUENTA_LABEL[estadoCuenta(c, pagos, ordenes)] : "",
        ];
      }),
    ]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Desde (carga o pago)">
          <input id="cc-desde" aria-label="Desde (carga o pago)" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={INPUT_COMPACTO} />
        </Campo>
        <Campo label="Hasta">
          <input id="cc-hasta" aria-label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={INPUT_COMPACTO} />
        </Campo>
        <Campo label="Tipo de comprobante">
          <select id="cc-tipo" aria-label="Tipo de comprobante" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={INPUT_COMPACTO}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.descripcion}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Estado">
          <select id="cc-estado" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as "" | EstadoCuenta)} className={INPUT_COMPACTO}>
            <option value="">Todos</option>
            {(Object.keys(ESTADO_CUENTA_LABEL) as EstadoCuenta[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_CUENTA_LABEL[e]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra label="Saldo inicial del período">{pesos(cc.saldoInicial)}</Cifra>
        <Cifra label="Saldo actual (lo que se le debe)">{pesos(cc.saldoActual)}</Cifra>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] leading-snug text-ink-500">
          La cuenta corriente se arma sola con la carga de comprobantes y los pagos: no se edita a mano. Sólo cuentan los comprobantes ya
          autorizados.
        </p>
        <div className="ml-auto">
          <Button size="sm" variant="navyOutline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white px-5 py-6 text-center text-xs text-ink-400">No hay movimientos para mostrar.</p>
      ) : (
        <TablaCompacta etiqueta="Cuenta corriente" minWidth="min-w-[62rem]">
          <thead>
            <tr>
              <Th>Carga / pago</Th>
              <Th>Comprobante</Th>
              <Th>Vencimiento</Th>
              <Th>Tipo</Th>
              <Th>Número / OP</Th>
              <Th derecha>Importe</Th>
              <Th derecha>Pagos aplicados</Th>
              <Th derecha>Saldo pendiente</Th>
              <Th derecha>Saldo acumulado</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const c = comprobantes.find((x) => x.id === f.comprobanteId);
              const pago = f.tipoFila === "PAGO" ? pagoDe(f.id) : undefined;
              return (
                <tr key={f.clave} className={f.tipoFila === "PAGO" ? "bg-ink-25/60" : undefined}>
                  <Td className="whitespace-nowrap">{f.fechaCarga}</Td>
                  <Td className="whitespace-nowrap">{f.fechaComprobante || "—"}</Td>
                  <Td className="whitespace-nowrap">
                    {f.vencimiento || "—"}
                    {atrasoDe(f) !== undefined && (atrasoDe(f) as number) > 0 && (
                      <span className="block text-[11px] font-semibold text-danger-700">Vencido hace {atrasoDe(f)} d</span>
                    )}
                  </Td>
                  <Td>
                    {f.tipoDescripcion}
                    {pago && (
                      <span className="block text-[11px] text-ink-500">
                        {MEDIO_PAGO_LABEL[pago.medio]} · {origenTexto(pago)} · aplicado a {pago.aplicaciones.map((a) => a.comprobanteId).join(", ")}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono">{f.numero}</Td>
                  <Td derecha className={`font-semibold ${f.importe < 0 ? "text-success-700" : ""}`}>
                    {pesos(f.importe)}
                  </Td>
                  <Td derecha>{f.tipoFila === "COMPROBANTE" ? pesos(f.pagosAplicados) : ""}</Td>
                  <Td derecha>{f.tipoFila === "COMPROBANTE" ? pesos(f.saldoPendiente) : ""}</Td>
                  <Td derecha className="font-semibold">{pesos(f.saldoAcumulado)}</Td>
                  <Td>
                    {c && <Pill fase={estadoCuenta(c, pagos, ordenes) === "PAGADO" ? "ok" : estadoCuenta(c, pagos, ordenes) === "PAGO_PARCIAL" ? "espera" : "proceso"}>{ESTADO_CUENTA_LABEL[estadoCuenta(c, pagos, ordenes)]}</Pill>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TablaCompacta>
      )}
    </div>
  );
}

export const cuitTexto = (p: Proveedor | undefined) => (p ? formatearCuit(p.cuit) : "");