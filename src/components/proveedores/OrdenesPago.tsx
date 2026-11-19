"use client";

import { useState } from "react";
import { saldosBancarios } from "@/lib/caja-operaciones";
import { saldoCaja } from "@/lib/caja-reglas";
import { hoy, useCajas, useChequeras, useCuentasBancarias, useLibro } from "@/lib/caja-store";
import { monedasDe } from "@/lib/caja-tipos";
import { registrarPago } from "@/lib/proveedores-operaciones";
import { diasDeAtraso, pagadoDe, saldoComprobante, vencimientoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { MEDIO_PAGO_LABEL, type Comprobante, type MedioPago } from "@/lib/proveedores-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { ErrorBanner, PaginaCaja } from "@/components/caja/comunes";
import { aNumero, ENCABEZADO, EstadoComprobanteBadge, Th, nombreProveedor, numeroComprobante, pesos, textoNumero } from "./comunes";

function PagoModal({ comprobante, saldo, onClose }: { comprobante: Comprobante; saldo: number; onClose: () => void }) {
  const cajas = useCajas();
  const cuentas = useCuentasBancarias();
  const [importe, setImporte] = useState(textoNumero(saldo));
  const [medio, setMedio] = useState<MedioPago>("TRANSFERENCIA");
  const [origenTipo, setOrigenTipo] = useState<"CAJA" | "BANCO">("BANCO");
  const [origenId, setOrigenId] = useState("");
  const [chequeraId, setChequeraId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const libro = useLibro();
  const chequeras = useChequeras();
  usePagosProveedor(); // el saldo de la cuenta cambia con cada pago

  const origenes =
    origenTipo === "CAJA"
      ? cajas.filter((c) => c.estado === "ACTIVO" && monedasDe(c.moneda).includes("ARS")).map((c) => ({ value: c.id, label: c.nombre }))
      : cuentas.filter((c) => c.estado === "ACTIVO" && c.moneda === "ARS").map((c) => ({ value: c.id, label: `${c.banco} · ${c.numero}` }));

  // Saldo del origen elegido: el efectivo de la caja (libro) o el saldo de la cuenta bancaria.
  const monto = aNumero(importe);
  const saldoOrigen = !origenId
    ? undefined
    : origenTipo === "CAJA"
      ? saldoCaja(libro, origenId, "ARS")
      : saldosBancarios().find((s) => s.cuentaId === origenId)?.saldo;
  // Sólo el efectivo, o el banco, descuentan: una transferencia o un cheque desde una caja no mueven su efectivo.
  const descuenta = origenTipo === "BANCO" || medio === "EFECTIVO";
  const quedaria = saldoOrigen === undefined || !descuenta ? undefined : saldoOrigen - (monto > 0 ? monto : 0);
  const chequerasDeCuenta =
    origenTipo === "BANCO" && medio === "CHEQUE"
      ? chequeras
          .filter((c) => c.estado === "ACTIVO" && c.cuentaId === origenId)
          .map((c) => ({ value: c.id, label: `${c.id}${c.desde ? ` · ${c.desde} a ${c.hasta}` : " · e-cheq"}` }))
      : [];

  const pagar = () => {
    const r = registrarPago({ comprobanteId: comprobante.id, importe: monto, medio, origenTipo, origenId, chequeraId });
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pagar ${comprobante.ordenPago ?? comprobante.id}`}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={pagar}>Registrar pago</Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600">
        Comprobante {numeroComprobante(comprobante)} · total {pesos(comprobante.total)} · saldo pendiente{" "}
        <span className="font-semibold text-ink-900">{pesos(saldo)}</span>.
      </p>
      <div className="mt-4 space-y-4">
        <FormField id="pago-importe" label="Importe a pagar" type="number" required value={importe} onChange={setImporte} hint="Total o parcial." />
        <SelectField
          id="pago-medio"
          label="Medio de pago"
          required
          value={medio}
          onChange={(v) => {
            const m = v as MedioPago;
            setMedio(m);
            if (m === "EFECTIVO") {
              setOrigenTipo("CAJA");
              setOrigenId("");
            }
          }}
          options={(Object.keys(MEDIO_PAGO_LABEL) as MedioPago[]).map((m) => ({ value: m, label: MEDIO_PAGO_LABEL[m] }))}
        />
        <SelectField
          id="pago-origen-tipo"
          label="Paga desde"
          required
          value={origenTipo}
          onChange={(v) => {
            setOrigenTipo(v as "CAJA" | "BANCO");
            setOrigenId("");
          }}
          options={[
            { value: "BANCO", label: "Cuenta bancaria", disabled: medio === "EFECTIVO" },
            { value: "CAJA", label: "Caja" },
          ]}
        />
        <SelectField
          id="pago-origen"
          label={origenTipo === "CAJA" ? "Caja" : "Cuenta bancaria"}
          required
          value={origenId}
          onChange={(v) => {
            setOrigenId(v);
            setChequeraId("");
          }}
          options={origenes}
        />
        {saldoOrigen !== undefined && (
          <Banner
            tone={quedaria !== undefined && quedaria < 0 ? "warning" : "info"}
            title={`${origenTipo === "CAJA" ? "Efectivo de la caja" : "Saldo de la cuenta"}: ${pesos(saldoOrigen)}`}
          >
            {!descuenta
              ? "Una transferencia o un cheque desde la caja figuran en su libro pero no mueven el efectivo."
              : quedaria !== undefined && quedaria < 0
                ? origenTipo === "CAJA"
                  ? `El pago supera el efectivo de la caja: no se puede registrar (quedaría en ${pesos(quedaria)}).`
                  : `Con este pago la cuenta quedaría en descubierto (${pesos(quedaria)}).`
                : `Después del pago quedaría en ${pesos(quedaria ?? saldoOrigen)}.`}
          </Banner>
        )}
        {chequerasDeCuenta.length > 0 && (
          <SelectField
            id="pago-chequera"
            label="Chequera (opcional)"
            value={chequeraId}
            onChange={setChequeraId}
            placeholder="Sin chequera"
            options={chequerasDeCuenta}
          />
        )}
        <FormField id="pago-fecha" label="Fecha de pago (fecha contable)" type="date" value={hoy()} onChange={() => {}} disabled />
      </div>
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function PantallaOrdenesPago() {
  const comprobantes = useComprobantes();
  const proveedores = useProveedores();
  const tipos = useTiposComprobante();
  const pagos = usePagosProveedor();
  const [proveedorId, setProveedorId] = useState("");
  const [pagando, setPagando] = useState<Comprobante | null>(null);

  const pagables = comprobantes
    .filter((c) => c.estado === "PARA_LIQUIDAR" || c.estado === "PAGO_PARCIAL")
    .filter((c) => tipos.find((t) => t.id === c.tipoId)?.efecto !== "RESTA")
    .filter((c) => (proveedorId ? c.proveedorId === proveedorId : true))
    // Primero lo que vence antes (los vencidos arriba).
    .sort((a, b) => vencimientoDe(a).localeCompare(vencimientoDe(b)) || (a.ordenPago ?? "").localeCompare(b.ordenPago ?? ""));

  return (
    <PaginaCaja
      seccion="Proveedores"
      titulo="Órdenes de pago"
      descripcion="Comprobantes autorizados, listos para liquidar, ordenados por vencimiento: pago total o parcial desde una caja o una cuenta bancaria. El pago queda en el libro de la caja o baja el saldo de la cuenta."
    >
      <Banner tone="info" title="A revisar">
        Este ítem puede integrarse a la Bandeja de autorizaciones (punto abierto 3 del documento funcional). Mientras tanto se puede pagar desde
        acá.
      </Banner>
      <div className="mt-4 max-w-sm">
        <SelectField
          id="op-proveedor"
          label="Proveedor"
          value={proveedorId}
          onChange={setProveedorId}
          placeholder="Todos"
          options={proveedores.filter((p) => p.estado !== "ELIMINADO").map((p) => ({ value: p.id, label: p.razonSocial }))}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {pagables.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay comprobantes para liquidar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead>
                <tr className={ENCABEZADO}>
                  <Th>Orden de pago</Th>
                  <Th>Proveedor</Th>
                  <Th>Comprobante</Th>
                  <Th>Vencimiento</Th>
                  <Th derecha>Total</Th>
                  <Th derecha>Pagado</Th>
                  <Th derecha>Saldo</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pagables.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{c.ordenPago}</td>
                    <td className="px-3 py-3 text-ink-700">{nombreProveedor(proveedores, c.proveedorId)}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {tipos.find((t) => t.id === c.tipoId)?.descripcion}
                      <span className="block font-mono text-xs text-ink-400">{numeroComprobante(c)}</span>
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {vencimientoDe(c)}
                      {diasDeAtraso(vencimientoDe(c), hoy()) > 0 ? (
                        <span className="block text-xs font-semibold text-danger-700">Vencido hace {diasDeAtraso(vencimientoDe(c), hoy())} d</span>
                      ) : (
                        <span className="block text-xs text-ink-400">Vence en {-diasDeAtraso(vencimientoDe(c), hoy())} d</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-900">{pesos(c.total)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-700">{pesos(pagadoDe(c.id, pagos))}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(saldoComprobante(c, pagos))}</td>
                    <td className="px-3 py-3">
                      <EstadoComprobanteBadge estado={c.estado} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" onClick={() => setPagando(c)}>
                        Pagar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pagando && <PagoModal key={pagando.id} comprobante={pagando} saldo={saldoComprobante(pagando, pagos)} onClose={() => setPagando(null)} />}
    </PaginaCaja>
  );
}
