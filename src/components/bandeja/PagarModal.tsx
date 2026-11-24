"use client";

import { useState } from "react";
import { cajasVisibles } from "@/lib/caja-reglas";
import { useCajaDatos, useChequeras, useCheques, useCuentasBancarias, useReservas, useTiposChequera } from "@/lib/caja-store";
import { monedasDe, TIPO_CAJA_LABEL, type CuentaBancaria } from "@/lib/caja-tipos";
import { formaDeTipo, numeracionDe } from "@/lib/cheques-reglas";
import { pagarOrdenPago } from "@/lib/proveedores-operaciones";
import { puedePagarOrden } from "@/lib/proveedores-reglas";
import { useProveedores, usePagosProveedor } from "@/lib/proveedores-store";
import { MEDIO_PAGO_LABEL, type MedioPago, type OrdenPago } from "@/lib/proveedores-tipos";
import { alcanzaElEstimado, posicionBanco, posicionCaja, type Posicion } from "@/lib/saldos-reglas";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CLASE_INPUT, ErrorBanner } from "@/components/caja/comunes";
import { aNumero, formatearCbu, pesos } from "./comunes";

const ETIQUETA = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400";

function PosicionResumen({ p, importe }: { p: Posicion; importe: number }) {
  const queda = p.estimado - importe;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-ink-200 bg-ink-25 p-3 text-xs sm:grid-cols-4">
      <Dato label="Real" valor={pesos(p.real)} />
      <Dato label="Comprometido" valor={pesos(p.comprometido)} />
      <Dato label="Estimado (disponible)" valor={pesos(p.estimado)} fuerte />
      <Dato label="A recibir (informativo)" valor={pesos(p.aRecibir)} />
      {importe > 0 && (
        <p className={`col-span-2 sm:col-span-4 ${queda < 0 ? "font-semibold text-danger-700" : "text-ink-500"}`}>
          {queda < 0
            ? `El pago supera el estimado en ${pesos(-queda)}.`
            : `Después de este pago el estimado queda en ${pesos(queda)}.`}
        </p>
      )}
    </div>
  );
}

function Dato({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`mt-0.5 ${fuerte ? "text-sm font-bold text-ink-900" : "text-ink-700"}`}>{valor}</p>
    </div>
  );
}

// Pagar una orden autorizada. Quien paga elige sólo el medio y el origen: las cuentas contables salen de
// los parámetros y la contabilidad es automática.
export function PagarModal({ orden, pendiente, onClose }: { orden: OrdenPago; pendiente: number; onClose: () => void }) {
  const { cajas, libro, movimientos, usuario, fecha } = useCajaDatos();
  const reservas = useReservas();
  const cuentas = useCuentasBancarias();
  const cheques = useCheques();
  const chequeras = useChequeras();
  const tipos = useTiposChequera();
  const pagos = usePagosProveedor();
  const proveedores = useProveedores();
  const proveedor = proveedores.find((p) => p.id === orden.proveedorId);

  const [medio, setMedio] = useState<MedioPago>("TRANSFERENCIA");
  const [importeTxt, setImporteTxt] = useState(String(pendiente));
  const [elegida, setElegida] = useState<Record<MedioPago, string>>({ EFECTIVO: "", CHEQUE: "", TRANSFERENCIA: "" });
  const [chequeraElegida, setChequeraElegida] = useState("");
  const [fechaPago, setFechaPago] = useState(fecha);
  const [error, setError] = useState<string | null>(null);

  const cajasPesos = cajasVisibles(usuario, cajas).filter((c) => c.estado === "ACTIVO" && monedasDe(c.moneda).includes("ARS"));
  const cuentasPesos = cuentas.filter((c) => c.estado === "ACTIVO" && c.moneda === "ARS");
  const opciones = medio === "EFECTIVO" ? cajasPesos.map((c) => c.id) : cuentasPesos.map((c) => c.id);
  const origenId = opciones.includes(elegida[medio]) ? elegida[medio] : (opciones[0] ?? "");

  const importe = aNumero(importeTxt);
  const posicion: Posicion | null = !origenId
    ? null
    : medio === "EFECTIVO"
      ? posicionCaja(libro, reservas, movimientos, origenId, "ARS")
      : posicionBanco(cuentas.find((c) => c.id === origenId) as CuentaBancaria, movimientos, pagos, cheques, reservas);

  const chequerasDeCuenta = chequeras.filter((c) => c.cuentaId === origenId && c.estado === "ACTIVO");
  const chequeraId = chequerasDeCuenta.some((c) => c.id === chequeraElegida) ? chequeraElegida : (chequerasDeCuenta[0]?.id ?? "");

  const denegado = puedePagarOrden(usuario);
  const alcanza = posicion ? alcanzaElEstimado(posicion, importe) : false;
  const esperaIngreso = !!posicion && !alcanza && posicion.estimado + posicion.aRecibir >= importe - 0.001 && posicion.aRecibir > 0;
  const parcial = importe > 0 && importe < pendiente - 0.005;

  const pagar = () => {
    if (!(importe > 0)) return setError("Ingresá el importe del pago.");
    if (importe > pendiente + 0.001) return setError(`El importe supera lo que queda por pagar de la orden (${pesos(pendiente)}).`);
    if (!origenId) return setError(medio === "EFECTIVO" ? "No hay una caja en pesos disponible." : "No hay una cuenta bancaria en pesos disponible.");
    const r = pagarOrdenPago({
      ordenId: orden.id,
      importe,
      medio,
      origenTipo: medio === "EFECTIVO" ? "CAJA" : "BANCO",
      origenId,
      chequeraId: medio === "CHEQUE" ? chequeraId || undefined : undefined,
      fechaPago: medio === "CHEQUE" ? fechaPago : undefined,
    });
    if (!r.ok) return setError(r.error);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pagar ${orden.id} · ${proveedor?.razonSocial ?? orden.proveedorId}`}
      maxWidth="max-w-xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="success" onClick={pagar} disabled={!!denegado || !origenId || !alcanza}>
            {medio === "TRANSFERENCIA" ? "Preparar transferencia" : medio === "CHEQUE" ? "Emitir cheque" : "Pagar en efectivo"}
          </Button>
        </div>
      }
    >
      {denegado && (
        <Banner tone="warning" title="No podés pagar con este usuario" className="mb-3">
          {denegado}
        </Banner>
      )}
      <p className="text-sm text-ink-600">
        Importe pendiente de la orden: <span className="font-semibold text-ink-900">{pesos(pendiente)}</span>. La contabilidad es automática: la
        cuenta contable sale de los parámetros del proveedor y del banco o la caja elegida.
      </p>

      <p className={`${ETIQUETA} mt-4`}>Medio de pago</p>
      <div role="group" aria-label="Medio de pago" className="grid grid-cols-3 gap-2">
        {(["EFECTIVO", "CHEQUE", "TRANSFERENCIA"] as MedioPago[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={medio === m}
            onClick={() => {
              setMedio(m);
              setError(null);
            }}
            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${medio === m ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"}`}
          >
            {m === "EFECTIVO" ? "Caja (efectivo)" : MEDIO_PAGO_LABEL[m]}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className={ETIQUETA}>Importe a pagar</span>
        <input
          inputMode="decimal"
          value={importeTxt}
          onChange={(e) => setImporteTxt(e.target.value)}
          aria-label="Importe a pagar"
          className={CLASE_INPUT}
        />
      </label>
      {parcial && (
        <Banner tone="info" title="Pago parcial" className="mt-2">
          Queda por pagar {pesos(pendiente - importe)} en la misma orden. El pago parcial se permite pero sigue como punto abierto en el
          documento.
        </Banner>
      )}

      <label className="mt-4 block">
        <span className={ETIQUETA}>{medio === "EFECTIVO" ? "Caja de origen" : "Cuenta bancaria de origen"}</span>
        <select
          value={origenId}
          onChange={(e) => setElegida({ ...elegida, [medio]: e.target.value })}
          aria-label="Origen del pago"
          className={CLASE_INPUT}
        >
          {opciones.length === 0 && <option value="">Sin opciones disponibles</option>}
          {medio === "EFECTIVO"
            ? cajasPesos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {TIPO_CAJA_LABEL[c.tipo]}
                </option>
              ))
            : cuentasPesos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.banco} · {c.numero}
                </option>
              ))}
        </select>
      </label>

      {posicion && <PosicionResumen p={posicion} importe={importe} />}
      {esperaIngreso && posicion && (
        <Banner tone="warning" title="El estimado no alcanza, pero hay fondos por entrar" className="mt-2">
          Con lo que está por recibir ({pesos(posicion.aRecibir)}) alcanzaría: esperá a que el dinero entre o pagá por banco.
        </Banner>
      )}
      {posicion && !alcanza && !esperaIngreso && importe > 0 && (
        <Banner tone="error" title="Saldo estimado insuficiente" className="mt-2">
          Ningún egreso se autoriza si supera el estimado. Elegí otro origen o pagá un importe menor.
        </Banner>
      )}

      {medio === "TRANSFERENCIA" && (
        <div className="mt-4 rounded-xl border border-ink-200 p-3 text-sm">
          <p className={ETIQUETA}>Destino (no editable)</p>
          {orden.cuentaDestino ? (
            <p className="text-ink-800">
              CBU <span className="font-mono">{formatearCbu(orden.cuentaDestino)}</span> · {proveedor?.razonSocial}
            </p>
          ) : (
            <p className="font-semibold text-danger-700">El proveedor no tiene CBU cargado: no se puede pagar por transferencia.</p>
          )}
          <p className="mt-1 text-xs text-ink-500">Queda Preparada con su reserva y pasa a la vista Transferencias para ejecutarla en el banco.</p>
        </div>
      )}

      {medio === "CHEQUE" && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={ETIQUETA}>Chequera</span>
            <select value={chequeraId} onChange={(e) => setChequeraElegida(e.target.value)} aria-label="Chequera" className={CLASE_INPUT}>
              {chequerasDeCuenta.length === 0 && <option value="">La cuenta no tiene chequeras activas</option>}
              {chequerasDeCuenta.map((c) => {
                const n = numeracionDe(c, cheques);
                const forma = formaDeTipo(tipos.find((t) => t.id === c.tipoId));
                return (
                  <option key={c.id} value={c.id}>
                    {forma === "ECHEQ" ? "E-cheq" : "Física"} · {c.id}
                    {n.conRango ? ` · ${c.desde}–${c.hasta} (${n.disponibles} disponibles)` : " · numeración correlativa"}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            <span className={ETIQUETA}>Fecha de pago del cheque</span>
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} aria-label="Fecha de pago del cheque" className={`${CLASE_INPUT} w-44`} />
          </label>
          <p className="text-xs text-ink-500">
            El cheque queda Emitido y reserva el saldo. Al entregarlo, la orden queda Pagada; el débito baja el real (se gestiona en Bancos › Cheques).
          </p>
        </div>
      )}

      <ErrorBanner error={error} />
    </Modal>
  );
}
