"use client";

import { useMemo, useState } from "react";
import { bancoTexto } from "@/lib/caja-operaciones";
import { useCajaDatos, useCheques, useCuentasBancarias, useReservas } from "@/lib/caja-store";
import { emitirAlerta } from "@/lib/alertas";
import { lotesDeBandeja, type FiltrosBandeja } from "@/lib/bandeja-reglas";
import {
  confirmarTransferencia,
  csvLoteTransferencia,
  lotesTransferencia,
  marcarPendienteEjecucion,
  registrarResultadoTransferencia,
  type ItemLoteTransferencia,
} from "@/lib/proveedores-operaciones";
import { puedePagarOrden } from "@/lib/proveedores-reglas";
import { useOrdenesPago, usePagosProveedor, useProveedores } from "@/lib/proveedores-store";
import { ESTADO_PAGO_LABEL } from "@/lib/proveedores-tipos";
import { posicionBanco } from "@/lib/saldos-reglas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotaModal, descargarXlsx } from "@/components/caja/comunes";
import { ENCABEZADO, Th, descargarTexto, formatearCbu, pesos } from "./comunes";

type Accion = { tipo: "ejecutar" | "rechazar"; item: ItemLoteTransferencia };

const TONO: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  PREPARADA: "info",
  PENDIENTE_EJECUCION: "warning",
  EJECUTADA: "success",
  CONFIRMADA: "neutral",
  RECHAZADA: "danger",
};

// Todo lo que sale por transferencia, agrupado por la cuenta bancaria de origen. Como el banco no está
// integrado, alguien entra al home banking: el lote se copia o se descarga y después se registra el
// resultado de cada ítem con la llave.
export function VistaTransferencias({ filtros }: { filtros: FiltrosBandeja }) {
  const { usuario, movimientos } = useCajaDatos();
  const cuentas = useCuentasBancarias();
  const cheques = useCheques();
  const reservas = useReservas();
  const pagos = usePagosProveedor();
  const ordenes = useOrdenesPago();
  const proveedores = useProveedores();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Los lotes se recalculan cuando cambian los pagos, las órdenes o los proveedores.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lotes = useMemo(() => lotesDeBandeja(lotesTransferencia(), filtros), [pagos, ordenes, proveedores, filtros]);
  const denegado = puedePagarOrden(usuario);

  const resultado = (r: { ok: boolean; error?: string }, ok: string) => setAviso(r.ok ? { tipo: "ok", texto: ok } : { tipo: "error", texto: r.error ?? "No se pudo completar." });

  const copiar = async (cuentaId: string) => {
    const lote = lotes.find((l) => l.cuentaId === cuentaId);
    if (!lote) return;
    const texto = lote.items.map((i) => `${i.proveedor} · CBU ${i.cbuDestino} · $ ${i.importe} · ${i.ordenPago}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setAviso({ tipo: "ok", texto: "Datos del lote copiados al portapapeles." });
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo copiar: descargá el lote en CSV." });
    }
  };

  const exportar = () =>
    descargarXlsx("bandeja-transferencias.xlsx", "Transferencias", [
      ["Cuenta de origen", "Pago", "Orden", "Proveedor", "CUIT", "CBU destino", "Importe", "Estado"],
      ...lotes.flatMap((l) =>
        l.items.map((i) => [bancoTexto(l.cuentaId), i.pagoId, i.ordenPago, i.proveedor, i.cuit, i.cbuDestino, String(i.importe), ESTADO_PAGO_LABEL[i.estado]])
      ),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-500">
          Preparada: reserva el saldo y baja el estimado. Pendiente de ejecución: se envió a quien opera el home banking. Ejecutada: se hizo en el
          banco, baja el real y consume la reserva. Confirmada: se verificó contra el extracto.
        </p>
        <Button variant="outline" size="sm" onClick={exportar} disabled={lotes.length === 0}>
          Exportar a Excel
        </Button>
      </div>
      {denegado && <p className="text-xs text-ink-500">{denegado}</p>}
      {aviso && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${aviso.tipo === "ok" ? "border-success-200 bg-success-50 text-success-700" : "border-danger-200 bg-danger-50 text-danger-700"}`}>
          {aviso.texto}
        </p>
      )}

      {lotes.length === 0 && (
        <Card className="px-5 py-8 text-center text-sm text-ink-400">No hay transferencias preparadas, pendientes ni por confirmar con estos filtros.</Card>
      )}

      {lotes.map((lote) => {
        const cuenta = cuentas.find((c) => c.id === lote.cuentaId);
        const pos = cuenta ? posicionBanco(cuenta, movimientos, pagos, cheques, reservas) : null;
        const porEnviar = lote.items.filter((i) => i.estado === "PREPARADA");
        const paraBanco = lote.items.filter((i) => i.estado === "PREPARADA" || i.estado === "PENDIENTE_EJECUCION");
        return (
          <Card key={lote.cuentaId} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-25 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-ink-900">{bancoTexto(lote.cuentaId)}</p>
                <p className="text-xs text-ink-500">
                  {lote.items.length} {lote.items.length === 1 ? "ítem" : "ítems"} · total {pesos(lote.total)}
                </p>
              </div>
              {pos && (
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-ink-500">
                    Real <span className="font-semibold text-ink-800">{pesos(pos.real)}</span>
                  </span>
                  <span className="text-ink-500">
                    Comprometido <span className="font-semibold text-ink-800">{pesos(pos.comprometido)}</span>
                  </span>
                  <span className="text-ink-500">
                    Estimado <span className="font-semibold text-ink-900">{pesos(pos.estimado)}</span>
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => copiar(lote.cuentaId)}>
                  Copiar datos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paraBanco.length === 0}
                  onClick={() => descargarTexto(`lote-${lote.cuentaId}.csv`, csvLoteTransferencia(lote.cuentaId))}
                >
                  Descargar lote CSV
                </Button>
                <Button
                  size="sm"
                  disabled={!!denegado || porEnviar.length === 0}
                  title={denegado ?? "Pasar las preparadas a Pendiente de ejecución"}
                  onClick={() => {
                    let n = 0;
                    let error: string | undefined;
                    for (const i of porEnviar) {
                      const r = marcarPendienteEjecucion(i.pagoId);
                      if (r.ok) n += 1;
                      else error = r.error;
                    }
                    setAviso(error ? { tipo: "error", texto: error } : { tipo: "ok", texto: `${n} ${n === 1 ? "transferencia pasó" : "transferencias pasaron"} a Pendiente de ejecución.` });
                  }}
                >
                  Enviar preparadas ({porEnviar.length})
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={ENCABEZADO}>
                    <Th>Pago</Th>
                    <Th>Proveedor</Th>
                    <Th>CBU destino</Th>
                    <Th derecha>Importe</Th>
                    <Th>Estado</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {lote.items.map((i) => (
                    <tr key={i.pagoId}>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink-900">{i.pagoId}</p>
                        <p className="text-xs text-ink-400">{i.ordenPago}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-ink-800">{i.proveedor}</p>
                        <p className="text-xs text-ink-400">CUIT {i.cuit}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{i.cbuDestino ? formatearCbu(i.cbuDestino) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{pesos(i.importe)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={TONO[i.estado] ?? "neutral"}>{ESTADO_PAGO_LABEL[i.estado]}</StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {i.estado === "PREPARADA" && (
                            <Button size="sm" variant="outline" disabled={!!denegado} onClick={() => resultado(marcarPendienteEjecucion(i.pagoId), `${i.pagoId} pasó a Pendiente de ejecución.`)}>
                              Enviar a ejecución
                            </Button>
                          )}
                          {i.estado === "PENDIENTE_EJECUCION" && (
                            <Button size="sm" variant="success" disabled={!!denegado} onClick={() => setAccion({ tipo: "ejecutar", item: i })}>
                              Registrar ejecutada
                            </Button>
                          )}
                          {i.estado === "EJECUTADA" && (
                            <Button size="sm" variant="outline" disabled={!!denegado} onClick={() => resultado(confirmarTransferencia(i.pagoId), `${i.pagoId} quedó Confirmada.`)}>
                              Confirmar
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={!!denegado} onClick={() => setAccion({ tipo: "rechazar", item: i })}>
                            {i.estado === "EJECUTADA" ? "Devuelta por el banco" : "Rechazada"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {accion?.tipo === "ejecutar" && (
        <NotaModal
          open
          titulo={`Registrar ${accion.item.pagoId} como ejecutada`}
          descripcion={`Transferencia de ${pesos(accion.item.importe)} a ${accion.item.proveedor}. Baja el saldo real de la cuenta y consume la reserva.`}
          etiquetaNota="Comprobante del banco (nº de operación)"
          requerida
          confirmar="Registrar ejecutada"
          tono="success"
          llave={{ operacion: "Ejecución de transferencia", referencia: accion.item.pagoId, importe: accion.item.importe, moneda: "ARS" }}
          onClose={() => setAccion(null)}
          onConfirmar={(nota, firmaId) => {
            const r = registrarResultadoTransferencia(accion.item.pagoId, { resultado: "EJECUTADA", comprobante: nota, firmaId });
            if (!r.ok) return r.error;
            setAviso({ tipo: "ok", texto: `${accion.item.pagoId} quedó Ejecutada.` });
            return null;
          }}
        />
      )}
      {accion?.tipo === "rechazar" && (
        <NotaModal
          open
          titulo={`Rechazar ${accion.item.pagoId}`}
          descripcion={
            accion.item.estado === "EJECUTADA"
              ? "El banco devolvió la transferencia ya ejecutada: el real vuelve y el importe queda otra vez pendiente en la orden."
              : "No se pudo pagar (por ejemplo, falló el CBU o el banco cerró). Se libera la reserva y el importe vuelve a quedar pendiente en la orden, que sigue Autorizada."
          }
          etiquetaNota="Motivo"
          requerida
          confirmar="Rechazar transferencia"
          tono="danger"
          llave={{ operacion: "Rechazo de transferencia", referencia: accion.item.pagoId, importe: accion.item.importe, moneda: "ARS" }}
          onClose={() => setAccion(null)}
          onConfirmar={(nota, firmaId) => {
            const r = registrarResultadoTransferencia(accion.item.pagoId, { resultado: "RECHAZADA", motivo: nota, firmaId });
            if (!r.ok) return r.error;
            emitirAlerta("PAGO_FALLIDO_O_PARCIAL", `La transferencia ${accion.item.pagoId} a ${accion.item.proveedor} por ${pesos(accion.item.importe)} fue rechazada: ${nota}`, accion.item.pagoId);
            setAviso({ tipo: "ok", texto: `${accion.item.pagoId} se rechazó: la orden ${accion.item.ordenPago} volvió a tener el importe pendiente.` });
            return null;
          }}
        />
      )}
    </div>
  );
}
