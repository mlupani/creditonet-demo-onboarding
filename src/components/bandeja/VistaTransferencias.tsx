"use client";

import { useMemo, useState } from "react";
import { bancoTexto } from "@/lib/caja-operaciones";
import { useCajaDatos, useCheques, useCuentasBancarias, useReservas, useUsuarioActual } from "@/lib/caja-store";
import { emitirAlerta } from "@/lib/alertas";
import { lotesDeBandeja, type FiltrosBandeja } from "@/lib/bandeja-reglas";
import { firmar } from "@/lib/llave";
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
import { ESTADO_PAGO_LABEL, type PagoProveedor } from "@/lib/proveedores-tipos";
import { posicionBanco } from "@/lib/saldos-reglas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { IconCopy } from "@/components/icons";
import { ErrorBanner, NotaModal } from "@/components/caja/comunes";
import { LlaveCampos } from "@/components/caja/LlaveCampos";
import { INPUT_COMPACTO, PanelVentana, Pill, TablaCompacta, Td, Th, type Fase } from "@/components/caja/compacto";
import { descargarTexto, formatearCbu, pesos } from "./comunes";

type Resultado = "EJECUTADA" | "RECHAZADA";
// Lo que se marcó en cada fila antes de registrarlo: el resultado y su dato (comprobante o motivo).
type Marca = { resultado: Resultado; dato: string };

const FASE: Record<PagoProveedor["estado"], Fase> = {
  PREPARADA: "inicial",
  PENDIENTE_EJECUCION: "espera",
  EJECUTADA: "proceso",
  CONFIRMADA: "ok",
  RECHAZADA: "rechazo",
} as Record<PagoProveedor["estado"], Fase>;

const numeroOrden = (ordenPago: string) => `OP ${ordenPago.replace(/^OP-0*/, "")}`;

// Registra el resultado marcado en varias filas con una sola llave (R6): la firma se arma una vez y se
// comparte entre todas las transferencias del lote.
function LlaveLoteModal({
  filas,
  onClose,
  onHecho,
}: {
  filas: { item: ItemLoteTransferencia; marca: Marca }[];
  onClose: () => void;
  onHecho: (texto: string) => void;
}) {
  const usuario = useUsuarioActual();
  const [clave, setClave] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const total = filas.reduce((s, f) => s + f.item.importe, 0);
  const ejecutadas = filas.filter((f) => f.marca.resultado === "EJECUTADA").length;
  const rechazadas = filas.length - ejecutadas;

  const confirmar = () => {
    const f = firmar({
      usuarioId: usuario.id,
      clave,
      codigo,
      operacion: "Resultado de transferencias",
      referencia: filas.map((x) => x.item.pagoId).join(", "),
      importe: total,
      moneda: "ARS",
    });
    if (!f.ok) return setError(f.error);
    const errores: string[] = [];
    let hechas = 0;
    for (const { item, marca } of filas) {
      const r =
        marca.resultado === "EJECUTADA"
          ? registrarResultadoTransferencia(item.pagoId, { resultado: "EJECUTADA", comprobante: marca.dato, firmaId: f.firma.id })
          : registrarResultadoTransferencia(item.pagoId, { resultado: "RECHAZADA", motivo: marca.dato, firmaId: f.firma.id });
      if (!r.ok) {
        errores.push(`${item.pagoId}: ${r.error}`);
        continue;
      }
      hechas += 1;
      if (marca.resultado === "RECHAZADA")
        emitirAlerta("PAGO_FALLIDO_O_PARCIAL", `La transferencia ${item.pagoId} a ${item.proveedor} por ${pesos(item.importe)} fue rechazada: ${marca.dato}`, item.pagoId);
    }
    if (errores.length > 0) return setError(`Se registraron ${hechas} de ${filas.length}. ${errores.join(" · ")}`);
    onHecho(`${hechas} ${hechas === 1 ? "transferencia registrada" : "transferencias registradas"} con la llave de ${usuario.nombre} (${ejecutadas} ejecutadas, ${rechazadas} rechazadas).`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar resultado con llave"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="dangerOutline" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" variant="success" onClick={confirmar}>
            Confirmar con llave
          </Button>
        </div>
      }
    >
      <p className="text-xs text-ink-600">
        Se registra el resultado de {filas.length} {filas.length === 1 ? "transferencia" : "transferencias"} por {pesos(total)}: {ejecutadas} ejecutadas y{" "}
        {rechazadas} rechazadas. Una sola firma respalda todo el lote.
      </p>
      <ul className="mt-2 space-y-1 text-xs text-ink-700">
        {filas.map(({ item, marca }) => (
          <li key={item.pagoId} className="flex items-center justify-between gap-2 rounded-md border border-ink-200 bg-ink-25 px-2 py-1">
            <span className="min-w-0 truncate">
              {item.pagoId} · {item.proveedor}
            </span>
            <Pill fase={marca.resultado === "EJECUTADA" ? "ok" : "rechazo"}>{marca.resultado === "EJECUTADA" ? "Ejecutada" : "Rechazada"}</Pill>
          </li>
        ))}
      </ul>
      <LlaveCampos usuarioId={usuario.id} clave={clave} codigo={codigo} onClave={setClave} onCodigo={setCodigo} />
      <ErrorBanner error={error} />
    </Modal>
  );
}

// Todo lo que sale por transferencia, agrupado por la cuenta bancaria de origen. Como el banco no está
// integrado, alguien entra al home banking: el lote se copia o se descarga y después se registra el
// resultado de cada ítem (ejecutada con comprobante o rechazada con motivo) con la llave.
export function VistaTransferencias({ filtros }: { filtros: FiltrosBandeja }) {
  const { usuario, movimientos } = useCajaDatos();
  const cuentas = useCuentasBancarias();
  const cheques = useCheques();
  const reservas = useReservas();
  const pagos = usePagosProveedor();
  const ordenes = useOrdenesPago();
  const proveedores = useProveedores();
  const [devuelta, setDevuelta] = useState<ItemLoteTransferencia | null>(null);
  const [lote, setLote] = useState<{ item: ItemLoteTransferencia; marca: Marca }[] | null>(null);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [tildadas, setTildadas] = useState<Record<string, boolean>>({});
  const [errorLote, setErrorLote] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Los lotes se recalculan cuando cambian los pagos, las órdenes o los proveedores.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lotes = useMemo(() => lotesDeBandeja(lotesTransferencia(), filtros, pagos), [pagos, ordenes, proveedores, filtros]);
  const denegado = puedePagarOrden(usuario);

  const resultado = (r: { ok: boolean; error?: string }, ok: string) => setAviso(r.ok ? { tipo: "ok", texto: ok } : { tipo: "error", texto: r.error ?? "No se pudo completar." });

  const marcar = (item: ItemLoteTransferencia, res: Resultado) => {
    setMarcas((m) => (m[item.pagoId]?.resultado === res ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== item.pagoId)) : { ...m, [item.pagoId]: { resultado: res, dato: m[item.pagoId]?.dato ?? "" } }));
    setTildadas((t) => ({ ...t, [item.pagoId]: marcas[item.pagoId]?.resultado !== res }));
    setErrorLote(null);
  };
  const escribir = (pagoId: string, dato: string) => setMarcas((m) => (m[pagoId] ? { ...m, [pagoId]: { ...m[pagoId], dato } } : m));

  const copiar = async (cuentaId: string) => {
    const l = lotes.find((x) => x.cuentaId === cuentaId);
    if (!l) return;
    const texto = l.items.map((i) => `${i.proveedor} · CBU ${i.cbuDestino} · $ ${i.importe} · ${i.ordenPago}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setAviso({ tipo: "ok", texto: "Datos del lote copiados al portapapeles." });
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo copiar: descargá el lote en CSV." });
    }
  };

  const copiarCbu = async (cbu: string) => {
    try {
      await navigator.clipboard.writeText(cbu);
      setAviso({ tipo: "ok", texto: "CBU copiado al portapapeles." });
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo copiar el CBU." });
    }
  };

  // Abre la llave con las filas tildadas que tienen resultado marcado; antes exige el dato de cada una.
  const registrar = (items: ItemLoteTransferencia[]) => {
    const filas = items.filter((i) => i.estado === "PENDIENTE_EJECUCION" && tildadas[i.pagoId] && marcas[i.pagoId]).map((i) => ({ item: i, marca: marcas[i.pagoId] }));
    if (filas.length === 0) {
      setErrorLote("Tildá al menos una transferencia pendiente y marcá su resultado.");
      return;
    }
    const falta = filas.find((f) => !f.marca.dato.trim());
    if (falta) {
      setErrorLote(
        falta.marca.resultado === "EJECUTADA"
          ? `Cargá el número de operación del banco de ${falta.item.pagoId}.`
          : `Indicá el motivo del rechazo de ${falta.item.pagoId}.`
      );
      return;
    }
    setErrorLote(null);
    setLote(filas);
  };

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-xs text-ink-500">
        Reúne lo que tiene banco de origen asignado y espera ser transferido. Preparada: reserva el saldo. Pendiente de ejecución: se envió a quien opera el home
        banking. Ejecutada: baja el real y consume la reserva. Confirmada: se verificó contra el extracto.
      </p>
      {denegado && <p className="text-xs text-ink-500">{denegado}</p>}
      {aviso && (
        <p role="status" className={`rounded-md border px-3 py-1.5 text-xs ${aviso.tipo === "ok" ? "border-success-200 bg-success-50 text-success-700" : "border-danger-200 bg-danger-50 text-danger-700"}`}>
          {aviso.texto}
        </p>
      )}
      {errorLote && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-1.5 text-xs text-danger-700">
          {errorLote}
        </p>
      )}

      {lotes.length === 0 && (
        <Card className="px-5 py-6 text-center text-xs text-ink-400">No hay transferencias preparadas, pendientes ni por confirmar con estos filtros.</Card>
      )}

      {lotes.map((l) => {
        const cuenta = cuentas.find((c) => c.id === l.cuentaId);
        const pos = cuenta ? posicionBanco(cuenta, movimientos, pagos, cheques, reservas) : null;
        const porEnviar = l.items.filter((i) => i.estado === "PREPARADA");
        const paraBanco = l.items.filter((i) => i.estado === "PREPARADA" || i.estado === "PENDIENTE_EJECUCION");
        const pendientes = l.items.filter((i) => i.estado === "PENDIENTE_EJECUCION");
        const listas = pendientes.filter((i) => tildadas[i.pagoId] && marcas[i.pagoId]).length;
        return (
          <PanelVentana
            key={l.cuentaId}
            titulo={`Bandeja › Transferencias · ${bancoTexto(l.cuentaId)}`}
            accion={
              pos && (
                <span className="flex flex-wrap gap-3 font-normal">
                  <span>
                    Real <b className="text-ink-800">{pesos(pos.real)}</b>
                  </span>
                  <span>
                    Comprometido <b className="text-ink-800">{pesos(pos.comprometido)}</b>
                  </span>
                  <span>
                    Estimado <b className="text-ink-900">{pesos(pos.estimado)}</b>
                  </span>
                </span>
              )
            }
          >
            <TablaCompacta etiqueta={`Transferencias ${bancoTexto(l.cuentaId)}`} minWidth="min-w-[62rem]">
              <thead>
                <tr>
                  <Th className="w-8">
                    <input
                      type="checkbox"
                      aria-label="Tildar las transferencias pendientes"
                      disabled={!!denegado || pendientes.length === 0}
                      checked={pendientes.length > 0 && pendientes.every((i) => tildadas[i.pagoId])}
                      onChange={(e) => setTildadas((t) => ({ ...t, ...Object.fromEntries(pendientes.map((i) => [i.pagoId, e.target.checked])) }))}
                    />
                  </Th>
                  <Th>Ref.</Th>
                  <Th>Origen</Th>
                  <Th>Beneficiario</Th>
                  <Th>CUIT / CUIL</Th>
                  <Th>CBU destino</Th>
                  <Th derecha>Importe</Th>
                  <Th>Concepto</Th>
                  <Th>Estado</Th>
                  <Th>Resultado</Th>
                </tr>
              </thead>
              <tbody>
                {l.items.map((i) => {
                  const marca = marcas[i.pagoId];
                  const pendiente = i.estado === "PENDIENTE_EJECUCION";
                  return (
                    <tr key={i.pagoId}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Tildar ${i.pagoId}`}
                          disabled={!!denegado || !pendiente}
                          checked={!!tildadas[i.pagoId] && pendiente}
                          onChange={(e) => setTildadas((t) => ({ ...t, [i.pagoId]: e.target.checked }))}
                        />
                      </Td>
                      <Td className="whitespace-nowrap font-semibold">
                        {i.ordenPago}
                        <span className="block text-[10px] font-normal text-ink-400">{i.pagoId}</span>
                      </Td>
                      <Td>Proveedor</Td>
                      <Td>{i.proveedor}</Td>
                      <Td className="whitespace-nowrap">{i.cuit}</Td>
                      <Td className="whitespace-nowrap font-mono text-[11px]">
                        {i.cbuDestino ? formatearCbu(i.cbuDestino) : "—"}
                        {i.cbuDestino && (
                          <button
                            type="button"
                            aria-label={`Copiar el CBU de ${i.proveedor}`}
                            title="Copiar CBU"
                            onClick={() => copiarCbu(i.cbuDestino)}
                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded align-middle text-ink-500 hover:bg-ink-100"
                          >
                            <IconCopy width={12} height={12} />
                          </button>
                        )}
                      </Td>
                      <Td derecha className="whitespace-nowrap">{pesos(i.importe)}</Td>
                      <Td className="whitespace-nowrap">{numeroOrden(i.ordenPago)}</Td>
                      <Td>
                        <Pill fase={FASE[i.estado] ?? "inicial"}>{ESTADO_PAGO_LABEL[i.estado]}</Pill>
                      </Td>
                      <Td className="min-w-64">
                        {i.estado === "PREPARADA" && (
                          <Button size="xs" variant="navyOutline" disabled={!!denegado} onClick={() => resultado(marcarPendienteEjecucion(i.pagoId), `${i.pagoId} pasó a Pendiente de ejecución.`)}>
                            Pasar a pendiente de ejecución
                          </Button>
                        )}
                        {pendiente && (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1.5">
                              <Button size="xs" variant={marca?.resultado === "EJECUTADA" ? "success" : "successOutline"} aria-pressed={marca?.resultado === "EJECUTADA"} disabled={!!denegado} onClick={() => marcar(i, "EJECUTADA")}>
                                Ejecutada + comprobante
                              </Button>
                              <Button size="xs" variant={marca?.resultado === "RECHAZADA" ? "danger" : "dangerOutline"} aria-pressed={marca?.resultado === "RECHAZADA"} disabled={!!denegado} onClick={() => marcar(i, "RECHAZADA")}>
                                Rechazada
                              </Button>
                            </div>
                            {marca && (
                              <input
                                value={marca.dato}
                                onChange={(e) => escribir(i.pagoId, e.target.value)}
                                aria-label={marca.resultado === "EJECUTADA" ? `Número de operación de ${i.pagoId}` : `Motivo del rechazo de ${i.pagoId}`}
                                placeholder={marca.resultado === "EJECUTADA" ? "Nº de operación del banco (comprobante)" : "Motivo del rechazo (obligatorio)"}
                                className={INPUT_COMPACTO}
                              />
                            )}
                          </div>
                        )}
                        {i.estado === "EJECUTADA" && (
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="xs" variant="successOutline" disabled={!!denegado} onClick={() => resultado(confirmarTransferencia(i.pagoId), `${i.pagoId} quedó Confirmada.`)}>
                              Confirmar contra extracto
                            </Button>
                            <Button size="xs" variant="dangerOutline" disabled={!!denegado} onClick={() => setDevuelta(i)}>
                              Devuelta por el banco
                            </Button>
                          </div>
                        )}
                        {(i.estado === "CONFIRMADA" || i.estado === "RECHAZADA") && <span className="text-ink-400">—</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TablaCompacta>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="xs" variant="navyOutline" onClick={() => copiar(l.cuentaId)}>
                <IconCopy width={12} height={12} />
                Copiar datos
              </Button>
              <Button
                size="xs"
                variant="navyOutline"
                disabled={paraBanco.length === 0}
                onClick={() => descargarTexto(`lote-${l.cuentaId}.csv`, csvLoteTransferencia(l.cuentaId))}
              >
                Descargar lote para el banco
              </Button>
              {porEnviar.length > 0 && (
                <Button
                  size="xs"
                  variant="brandOutline"
                  disabled={!!denegado}
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
              )}
              <Button size="xs" variant="success" disabled={!!denegado || pendientes.length === 0} title={denegado ?? undefined} onClick={() => registrar(l.items)}>
                Registrar resultado con llave{listas > 0 ? ` (${listas})` : ""}
              </Button>
            </div>
          </PanelVentana>
        );
      })}

      <div className="rounded-r-md border-l-4 border-brand-600 bg-brand-50 px-3.5 py-2 text-xs text-ink-700">
        <b>Con API bancaria (futuro):</b> los pasos de preparación, home banking y resultado se hacen solos; el sistema envía el lote y recibe el resultado de
        cada transferencia. Hoy el proceso es manual, con los mismos estados.
      </div>

      {lote && <LlaveLoteModal filas={lote} onClose={() => setLote(null)} onHecho={(texto) => {
        setAviso({ tipo: "ok", texto });
        setMarcas({});
        setTildadas({});
      }} />}

      {devuelta && (
        <NotaModal
          open
          titulo={`Rechazar ${devuelta.pagoId}`}
          descripcion="El banco devolvió la transferencia ya ejecutada: el real vuelve y el importe queda otra vez pendiente en la orden."
          etiquetaNota="Motivo"
          requerida
          confirmar="Registrar devolución"
          tono="danger"
          llave={{ operacion: "Rechazo de transferencia", referencia: devuelta.pagoId, importe: devuelta.importe, moneda: "ARS" }}
          onClose={() => setDevuelta(null)}
          onConfirmar={(nota, firmaId) => {
            const r = registrarResultadoTransferencia(devuelta.pagoId, { resultado: "RECHAZADA", motivo: nota, firmaId });
            if (!r.ok) return r.error;
            emitirAlerta("PAGO_FALLIDO_O_PARCIAL", `La transferencia ${devuelta.pagoId} a ${devuelta.proveedor} por ${pesos(devuelta.importe)} fue rechazada: ${nota}`, devuelta.pagoId);
            setAviso({ tipo: "ok", texto: `${devuelta.pagoId} se rechazó: la orden ${devuelta.ordenPago} volvió a tener el importe pendiente.` });
            return null;
          }}
        />
      )}
    </div>
  );
}
