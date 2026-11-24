"use client";

import { useRef, useState } from "react";
import { cajasVisibles } from "@/lib/caja-reglas";
import { useCajaDatos, useChequeras, useCheques, useCuentasBancarias, useReservas, useTiposChequera } from "@/lib/caja-store";
import { monedasDe, TIPO_CAJA_LABEL, type CuentaBancaria } from "@/lib/caja-tipos";
import { formaDeTipo, numeracionDe } from "@/lib/cheques-reglas";
import { pagarOrdenPago } from "@/lib/proveedores-operaciones";
import { puedePagarOrden } from "@/lib/proveedores-reglas";
import { useProveedores, usePagosProveedor } from "@/lib/proveedores-store";
import type { MedioPago, OrdenPago } from "@/lib/proveedores-tipos";
import { alcanzaElEstimado, posicionBanco, posicionCaja, type Posicion } from "@/lib/saldos-reglas";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ErrorBanner } from "@/components/caja/comunes";
import { LlaveModal } from "@/components/caja/LlaveModal";
import { Campo, CampoLectura, INPUT_COMPACTO, TablaCompacta, Td, Th } from "@/components/caja/compacto";
import { aNumero, cuitTexto, formatearCbu, pesos } from "./comunes";

export interface ItemPago {
  orden: OrdenPago;
  pendiente: number;
}

const MEDIOS: { id: MedioPago; label: string }[] = [
  { id: "EFECTIVO", label: "Caja" },
  { id: "CHEQUE", label: "Cheque" },
  { id: "TRANSFERENCIA", label: "Transferencia" },
];

// Qué se elige y qué resultado tiene cada medio (documento de la Bandeja, "Al apretar Pagar").
const RESULTADOS: { medio: string; elige: string; resultado: string }[] = [
  { medio: "Caja", elige: "Caja o tesoro de origen", resultado: "Pago en efectivo con recibo firmado: impacta el real en el momento" },
  {
    medio: "Cheque",
    elige: "Chequera (física / eCheq) · número disponible · fecha de pago",
    resultado: "Cheque Emitido (reserva) → Entregado (OP Pagada) → Presentado → Debitado (baja el real)",
  },
  {
    medio: "Transferencia",
    elige: "Banco y cuenta de origen",
    resultado: "Transferencia Preparada (reserva) → botón Transferencias → Ejecutada (baja el real) → Confirmada",
  },
];

// Pagar una o varias órdenes autorizadas del mismo proveedor. Quien paga elige sólo el medio y el origen: las
// cuentas contables salen de los parámetros y la contabilidad es automática. Cada orden genera su propio
// pago (una reserva por pago) y todo se confirma con la llave.
export function PagarModal({ items, onClose }: { items: ItemPago[]; onClose: (pagado?: boolean) => void }) {
  const { cajas, libro, movimientos, usuario, fecha } = useCajaDatos();
  const reservas = useReservas();
  const cuentas = useCuentasBancarias();
  const cheques = useCheques();
  const chequeras = useChequeras();
  const tipos = useTiposChequera();
  const pagos = usePagosProveedor();
  const proveedores = useProveedores();
  const varias = items.length > 1;
  const proveedor = proveedores.find((p) => p.id === items[0].orden.proveedorId);
  const pendienteTotal = items.reduce((s, i) => s + i.pendiente, 0);
  const ids = items.map((i) => i.orden.id);

  const [medio, setMedio] = useState<MedioPago>("TRANSFERENCIA");
  const [importeTxt, setImporteTxt] = useState(String(pendienteTotal));
  const [referencia, setReferencia] = useState(ids.join(" / "));
  const [elegida, setElegida] = useState<Record<MedioPago, string>>({ EFECTIVO: "", CHEQUE: "", TRANSFERENCIA: "" });
  const [chequeraElegida, setChequeraElegida] = useState("");
  const [fechaPago, setFechaPago] = useState(fecha);
  const [error, setError] = useState<string | null>(null);
  const [firmando, setFirmando] = useState(false);
  const pagadoRef = useRef(false);

  const cajasPesos = cajasVisibles(usuario, cajas).filter((c) => c.estado === "ACTIVO" && monedasDe(c.moneda).includes("ARS"));
  const cuentasPesos = cuentas.filter((c) => c.estado === "ACTIVO" && c.moneda === "ARS");
  const opciones = medio === "EFECTIVO" ? cajasPesos.map((c) => c.id) : cuentasPesos.map((c) => c.id);
  const origenId = opciones.includes(elegida[medio]) ? elegida[medio] : (opciones[0] ?? "");

  // Con varias órdenes se paga el pendiente completo de cada una; con una sola el importe se puede bajar.
  const importe = varias ? pendienteTotal : aNumero(importeTxt);
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
  const parcial = !varias && importe > 0 && importe < pendienteTotal - 0.005;
  const sinCbu = medio === "TRANSFERENCIA" && items.some((i) => !i.orden.cuentaDestino);

  const validar = (): string | null => {
    if (!(importe > 0)) return "Ingresá el importe del pago.";
    if (importe > pendienteTotal + 0.001) return `El importe supera lo que queda por pagar (${pesos(pendienteTotal)}).`;
    if (!origenId) return medio === "EFECTIVO" ? "No hay una caja en pesos disponible." : "No hay una cuenta bancaria en pesos disponible.";
    if (sinCbu) return "El proveedor no tiene CBU cargado: no se puede pagar por transferencia.";
    return null;
  };

  // Ejecuta los pagos, uno por orden. Devuelve un error para mostrar o null si salió todo bien.
  const ejecutar = (): string | null => {
    for (let i = 0; i < items.length; i++) {
      const r = pagarOrdenPago({
        ordenId: items[i].orden.id,
        importe: varias ? items[i].pendiente : importe,
        medio,
        origenTipo: medio === "EFECTIVO" ? "CAJA" : "BANCO",
        origenId,
        chequeraId: medio === "CHEQUE" ? chequeraId || undefined : undefined,
        fechaPago: medio === "CHEQUE" ? fechaPago : undefined,
      });
      if (!r.ok) {
        pagadoRef.current = i > 0;
        return i > 0 ? `Se pagaron ${i} de ${items.length} órdenes. ${items[i].orden.id}: ${r.error}` : r.error;
      }
    }
    pagadoRef.current = true;
    return null;
  };

  const confirmar = () => {
    const e = validar();
    if (e) return setError(e);
    setError(null);
    setFirmando(true);
  };

  const destino =
    medio === "TRANSFERENCIA"
      ? items[0].orden.cuentaDestino
        ? `CBU ${formatearCbu(items[0].orden.cuentaDestino)} · CUIT ${cuitTexto(proveedor)}`
        : "Sin CBU cargado"
      : medio === "CHEQUE"
        ? `Cheque a la orden de ${proveedor?.razonSocial ?? items[0].orden.proveedorId}`
        : "Efectivo, con recibo firmado por quien cobra";

  return (
    <>
      <Modal
        open
        onClose={() => onClose(pagadoRef.current)}
        title={`Pagar ${varias ? `${items.length} órdenes` : ids[0]} · ${proveedor?.razonSocial ?? items[0].orden.proveedorId} · ${pesos(pendienteTotal)}`}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="success" size="sm" onClick={confirmar} disabled={!!denegado || !origenId || !alcanza || sinCbu}>
              Confirmar con llave
            </Button>
            <Button variant="dangerOutline" size="sm" onClick={() => onClose(pagadoRef.current)}>
              Cancelar
            </Button>
          </div>
        }
      >
        {denegado && (
          <Banner tone="warning" title="No podés pagar con este usuario" className="mb-3">
            {denegado}
          </Banner>
        )}

        <div role="group" aria-label="Medio de pago" className="flex flex-wrap gap-2">
          {MEDIOS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={medio === m.id}
              onClick={() => {
                setMedio(m.id);
                setError(null);
              }}
              className={`h-8 rounded-md border px-4 text-xs font-bold transition ${medio === m.id ? "border-brand-600 bg-brand-600 text-white" : "border-brand-600 bg-white text-brand-700 hover:bg-brand-50"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo label={medio === "EFECTIVO" ? "Caja / tesoro de origen" : "Banco / cuenta de origen"}>
            <select
              value={origenId}
              onChange={(e) => setElegida({ ...elegida, [medio]: e.target.value })}
              aria-label="Origen del pago"
              className={INPUT_COMPACTO}
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
          </Campo>
          <CampoLectura label="Destino (de la OP, no editable)">
            <span className={sinCbu ? "font-semibold text-danger-700" : "font-mono text-[11px]"}>{destino}</span>
          </CampoLectura>
          <Campo label="Referencia">
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} aria-label="Referencia" className={INPUT_COMPACTO} />
          </Campo>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {varias ? (
            <CampoLectura label="Importe a pagar (suma de las órdenes)">{pesos(importe)}</CampoLectura>
          ) : (
            <Campo label="Importe a pagar">
              <input inputMode="decimal" value={importeTxt} onChange={(e) => setImporteTxt(e.target.value)} aria-label="Importe a pagar" className={INPUT_COMPACTO} />
            </Campo>
          )}
          {medio === "CHEQUE" && (
            <>
              <Campo label="Chequera">
                <select value={chequeraId} onChange={(e) => setChequeraElegida(e.target.value)} aria-label="Chequera" className={INPUT_COMPACTO}>
                  {chequerasDeCuenta.length === 0 && <option value="">La cuenta no tiene chequeras activas</option>}
                  {chequerasDeCuenta.map((c) => {
                    const n = numeracionDe(c, cheques);
                    const forma = formaDeTipo(tipos.find((t) => t.id === c.tipoId));
                    return (
                      <option key={c.id} value={c.id}>
                        {forma === "ECHEQ" ? "E-cheq" : "Física"} · {c.id}
                        {n.conRango ? ` · ${c.desde}–${c.hasta} (${n.disponibles} disp.)` : " · correlativa"}
                      </option>
                    );
                  })}
                </select>
              </Campo>
              <Campo label="Fecha de pago del cheque">
                <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} aria-label="Fecha de pago del cheque" className={INPUT_COMPACTO} />
              </Campo>
            </>
          )}
        </div>

        {parcial && (
          <Banner tone="info" title="Pago parcial" className="mt-3">
            Queda por pagar {pesos(pendienteTotal - importe)} en la misma orden. El pago parcial se permite pero sigue como punto abierto en el
            documento.
          </Banner>
        )}

        {posicion && (
          <p className="mt-3 text-xs">
            <span className="text-ink-600">Estimado: </span>
            <span className="font-bold text-ink-900">{pesos(posicion.estimado)}</span>{" "}
            {importe > 0 &&
              (alcanza ? (
                <span className="font-bold text-success-700">✔ alcanza</span>
              ) : (
                <span className="font-bold text-danger-700">✖ no alcanza (el pago supera el estimado en {pesos(importe - posicion.estimado)})</span>
              ))}
            <span className="ml-2 text-[11px] text-ink-500">
              Real {pesos(posicion.real)} · Comprometido {pesos(posicion.comprometido)} · A recibir (informativo) {pesos(posicion.aRecibir)}
              {importe > 0 && alcanza ? ` · Después de este pago queda ${pesos(posicion.estimado - importe)}` : ""}
            </span>
          </p>
        )}
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

        <div className="mt-3">
          <TablaCompacta etiqueta="Resultado de cada medio de pago" minWidth="min-w-[32rem]">
            <thead>
              <tr>
                <Th>Medio</Th>
                <Th>Qué se elige</Th>
                <Th>Resultado</Th>
              </tr>
            </thead>
            <tbody>
              {RESULTADOS.map((r) => (
                <tr key={r.medio} className={MEDIOS.find((m) => m.label === r.medio)?.id === medio ? "bg-brand-50/50" : undefined}>
                  <Td className="font-semibold">{r.medio}</Td>
                  <Td>{r.elige}</Td>
                  <Td>{r.resultado}</Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        </div>

        <ErrorBanner error={error} />
      </Modal>

      {firmando && (
        <LlaveModal
          open
          titulo={`Confirmar el pago de ${varias ? `${items.length} órdenes` : ids[0]}`}
          descripcion={`${MEDIOS.find((m) => m.id === medio)?.label} por ${pesos(importe)} a ${proveedor?.razonSocial ?? items[0].orden.proveedorId}${referencia ? ` · Ref. ${referencia}` : ""}. Firmás con tu llave.`}
          datos={{ operacion: "Pago de orden de pago", referencia: ids.join(" / "), importe, moneda: "ARS" }}
          usuarioId={usuario.id}
          confirmar="Confirmar pago"
          onFirmada={() => ejecutar()}
          onClose={() => {
            if (pagadoRef.current) onClose(true);
            else setFirmando(false);
          }}
        />
      )}
    </>
  );
}
