"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { saldosBancarios } from "@/lib/caja-operaciones";
import { horaActual, hoy, useAcuerdos, useCajaDatos, useCheques, useCuentasBancarias, useFechaDemo, useHoraDemo, useReservas } from "@/lib/caja-store";
import { acuerdosPorVencer, textoVencimiento } from "@/lib/acuerdos-vencimiento";
import { usePagosProveedor } from "@/lib/proveedores-store";
import { MONEDAS, NOMBRE_MONEDA, TIPO_CAJA_LABEL, TIPO_CUENTA_LABEL, monedasDe, type Moneda, type Reserva } from "@/lib/caja-tipos";
import { posicionCaja } from "@/lib/saldos-reglas";
import { Button } from "@/components/ui/Button";
import { Cifra, PanelVentana, TablaCompacta, Td, Th } from "./compacto";
import { IconAlertTriangle } from "@/components/icons";
import { PaginaCaja, descargarXlsx, dinero } from "./comunes";

interface Fila {
  clave: string;
  tipo: "Caja" | "Banco";
  nombre: string;
  detalle: string;
  moneda: Moneda;
  real: number;
  comprometido: number;
  estimado: number;
  aRecibir: number;
  reservas: Reserva[];
  // Movimientos de tesorería autorizados que esperan su envío y ya reservan el saldo de la caja.
  autorizados: { id: string; importe: number; destino: string }[];
}

// Posición de saldos (v4, 4.1): para cada caja y cuenta, el saldo real, lo comprometido (reservas de las
// operaciones autorizadas), el estimado (real − comprometido, el que manda) y lo que está por recibir
// (informativo, no suma hasta que entra). Cada importe comprometido se abre para ver qué lo compone.
export function PantallaPosicion() {
  const d = useCajaDatos();
  const cuentas = useCuentasBancarias();
  const reservas = useReservas();
  useCheques(); // los cheques debitados bajan el real: se vuelve a calcular al cambiar
  usePagosProveedor(); // las transferencias ejecutadas, también
  const acuerdos = useAcuerdos();
  useFechaDemo(); // la fecha y la hora simuladas cambian el título y los avisos
  useHoraDemo();
  const [abierta, setAbierta] = useState<string | null>(null);
  const bancarios = saldosBancarios();
  const [a, m, dd] = hoy().split("-");
  const fechaHora = `${dd}/${m}/${a} ${horaActual()}`;
  const avisos = acuerdosPorVencer(acuerdos, hoy());

  const filasCaja: Fila[] = d.cajas
    .filter((c) => c.estado === "ACTIVO")
    .flatMap((c) =>
      monedasDe(c.moneda).map((m): Fila => {
        const p = posicionCaja(d.libro, reservas, d.movimientos, c.id, m);
        return {
          clave: `CAJA:${c.id}:${m}`,
          tipo: "Caja",
          nombre: c.nombre,
          detalle: `${TIPO_CAJA_LABEL[c.tipo]} · ${d.sucursales.find((s) => s.id === c.sucursalId)?.nombre ?? c.sucursalId}`,
          moneda: m,
          ...p,
          reservas: reservas.filter((r) => r.estado === "ACTIVA" && r.origenTipo === "CAJA" && r.origenId === c.id && r.moneda === m),
          autorizados: d.movimientos
            .filter((x) => x.origenId === c.id && x.moneda === m && x.estado === "AUTORIZADO")
            .map((x) => ({ id: x.id, importe: x.importe, destino: x.destino.tipo === "CAJA" ? x.destino.cajaId : x.destino.cuentaId })),
        };
      })
    );
  const filasBanco: Fila[] = cuentas
    .filter((c) => c.estado !== "ELIMINADO")
    .map((c) => {
      const s = bancarios.find((x) => x.cuentaId === c.id);
      return {
        clave: `BANCO:${c.id}`,
        tipo: "Banco",
        nombre: `${c.banco} ${c.numero}`,
        detalle: TIPO_CUENTA_LABEL[c.tipo],
        moneda: c.moneda,
        real: s?.real ?? 0,
        comprometido: s?.comprometido ?? 0,
        estimado: s?.estimado ?? 0,
        aRecibir: s?.aRecibir ?? 0,
        reservas: reservas.filter((r) => r.estado === "ACTIVA" && r.origenTipo === "BANCO" && r.origenId === c.id),
        autorizados: [],
      };
    });

  const total = (filas: Fila[], m: Moneda, campo: "real" | "comprometido" | "estimado" | "aRecibir") =>
    filas.filter((f) => f.moneda === m).reduce((s, f) => s + f[campo], 0);
  const todas = [...filasCaja, ...filasBanco];

  const exportar = () =>
    descargarXlsx("posicion-de-saldos.xlsx", "Posición de saldos", [
      ["Tipo", "Caja o cuenta", "Detalle", "Moneda", "Saldo real", "Comprometido", "Saldo estimado", "A recibir (informativo)"],
      ...todas.map((f) => [f.tipo, f.nombre, f.detalle, f.moneda, String(f.real), String(f.comprometido), String(f.estimado), String(f.aRecibir)]),
      ...MONEDAS.map((m) => [
        "Total",
        "Cajas y bancos",
        "",
        m,
        String(total(todas, m, "real")),
        String(total(todas, m, "comprometido")),
        String(total(todas, m, "estimado")),
        String(total(todas, m, "aRecibir")),
      ]),
    ]);

  const tabla = (titulo: string, filas: Fila[], extra?: React.ReactNode) => (
    <PanelVentana className="mt-4" titulo={titulo} accion={extra}>
      <TablaCompacta etiqueta={titulo} minWidth="min-w-[48rem]">
        <thead>
          <tr>
            <Th>{titulo === "Cuentas bancarias" ? "Cuenta" : "Caja"}</Th>
            <Th>Moneda</Th>
            <Th derecha>Saldo real</Th>
            <Th derecha>(−) Comprometido</Th>
            <Th derecha>Saldo estimado</Th>
            <Th derecha>A recibir (informativo)</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <Fragment key={f.clave}>
              <tr>
                <Td className="font-semibold text-ink-900">
                  {f.nombre}
                  <span className="block text-[11px] font-normal text-ink-500">{f.detalle}</span>
                </Td>
                <Td>{NOMBRE_MONEDA[f.moneda]}</Td>
                <Td derecha className="text-ink-900">{dinero(f.moneda, f.real)}</Td>
                <Td derecha>
                  {f.comprometido > 0 ? (
                    <button
                      type="button"
                      aria-expanded={abierta === f.clave}
                      onClick={() => setAbierta(abierta === f.clave ? null : f.clave)}
                      className="font-semibold text-warning-700 underline decoration-dotted underline-offset-2 hover:text-warning-600"
                    >
                      {dinero(f.moneda, f.comprometido)}
                    </button>
                  ) : (
                    dinero(f.moneda, 0)
                  )}
                </Td>
                <Td derecha className="font-bold text-success-700">{dinero(f.moneda, f.estimado)}</Td>
                <Td derecha className="text-ink-500">{dinero(f.moneda, f.aRecibir)}</Td>
              </tr>
              {abierta === f.clave && (
                <tr className="bg-ink-25">
                  <Td colSpan={6}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-500">Qué compone lo comprometido</p>
                    <ul className="space-y-0.5 text-xs text-ink-700">
                      {f.reservas.map((r) => (
                        <li key={r.id}>
                          <span className="font-mono font-bold text-brand-700">{r.id}</span> · pago o cheque {r.operacionId} · {dinero(r.moneda, r.importe)}
                          <span className="text-ink-400"> · reservó {r.creada.usuarioId} el {r.creada.fechaHora}</span>
                        </li>
                      ))}
                      {f.autorizados.map((a) => (
                        <li key={a.id}>
                          <span className="font-mono font-bold text-brand-700">{a.id}</span> · movimiento de tesorería autorizado a {a.destino} · {dinero(f.moneda, a.importe)}
                        </li>
                      ))}
                    </ul>
                  </Td>
                </tr>
              )}
            </Fragment>
          ))}
          {filas.length === 0 && (
            <tr>
              <Td colSpan={6} className="py-4 text-center text-ink-400">
                No hay datos para mostrar.
              </Td>
            </tr>
          )}
        </tbody>
      </TablaCompacta>
    </PanelVentana>
  );

  return (
    <PaginaCaja
      seccion="Posición de caja y bancos"
      titulo="Posición de saldos"
      descripcion="Saldo real y saldo estimado de todas las cajas y cuentas bancarias, por cuenta y moneda. El estimado (real − comprometido) es el que manda: ningún egreso se autoriza por encima de él."
    >
      <PanelVentana titulo={`Posición de saldos — ${fechaHora}`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {MONEDAS.map((m) => (
            <Cifra key={m} label={`Posición total en ${NOMBRE_MONEDA[m].toLowerCase()}`} tono="bueno">
              {dinero(m, total(todas, m, "estimado"))}
              <span className="mt-0.5 block text-[11px] font-normal text-ink-500">
                Estimado · real {dinero(m, total(todas, m, "real"))} − comprometido {dinero(m, total(todas, m, "comprometido"))}
                {total(todas, m, "aRecibir") > 0 && ` · a recibir ${dinero(m, total(todas, m, "aRecibir"))} (no suma hasta que entra)`}
              </span>
            </Cifra>
          ))}
        </div>
        {avisos.length > 0 && (
          <ul aria-label="Avisos" className="mt-3 space-y-1">
            {avisos.map((v) => {
              const cuenta = cuentas.find((c) => c.id === v.cuentaId);
              return (
                <li
                  key={v.acuerdoId}
                  className={`flex flex-wrap items-center gap-1.5 text-xs font-bold ${v.vencido ? "text-danger-700" : "text-warning-700"}`}
                >
                  <IconAlertTriangle width={14} height={14} />
                  <span>
                    Acuerdo {cuenta?.banco ?? v.cuentaId} {textoVencimiento(v.dias)}
                  </span>
                  <Link href="/caja/acuerdos" className="font-semibold text-brand-700 hover:underline">
                    Ver acuerdos
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PanelVentana>
      {tabla(
        "Cajas y tesoros",
        filasCaja,
        <Button size="xs" variant="navyOutline" onClick={exportar}>
          Exportar a Excel
        </Button>
      )}
      {tabla(
        "Cuentas bancarias",
        filasBanco,
        <Link href="/caja/bancos" className="text-[11px] font-semibold text-brand-700 hover:underline">
          Ir a Conciliaciones
        </Link>
      )}
      <p className="mt-3 max-w-4xl text-[11px] leading-snug text-ink-500">
        Real: efectivo del libro en las cajas; en los bancos, saldo inicial + depósitos conciliados − transferencias ejecutadas − cheques debitados.
        Comprometido: reservas de las operaciones autorizadas (transferencias preparadas, cheques emitidos y no debitados, movimientos de tesorería
        autorizados que esperan su envío). A recibir: lo enviado que todavía no entró.
      </p>
    </PaginaCaja>
  );
}
