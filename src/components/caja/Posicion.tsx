"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { saldosBancarios } from "@/lib/caja-operaciones";
import { useCajaDatos, useCheques, useCuentasBancarias, useReservas } from "@/lib/caja-store";
import { usePagosProveedor } from "@/lib/proveedores-store";
import { MONEDAS, NOMBRE_MONEDA, TIPO_CAJA_LABEL, TIPO_CUENTA_LABEL, monedasDe, type Moneda, type Reserva } from "@/lib/caja-tipos";
import { posicionCaja } from "@/lib/saldos-reglas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PaginaCaja, descargarXlsx, dinero } from "./comunes";

const ENCABEZADO = "bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400";

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
  const [abierta, setAbierta] = useState<string | null>(null);
  const bancarios = saldosBancarios();

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
    <>
      <div className="mt-8 flex flex-wrap items-center gap-2 first:mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">{titulo}</h2>
        {extra}
      </div>
      <Card className="mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className={ENCABEZADO}>
                <th className="px-3 py-2.5">{titulo === "Cuentas bancarias" ? "Cuenta" : "Caja"}</th>
                <th className="px-3 py-2.5">Moneda</th>
                <th className="px-3 py-2.5 text-right">Saldo real</th>
                <th className="px-3 py-2.5 text-right">(−) Comprometido</th>
                <th className="px-3 py-2.5 text-right">Saldo estimado</th>
                <th className="px-3 py-2.5 text-right">A recibir (informativo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filas.map((f) => (
                <Fragment key={f.clave}>
                  <tr>
                    <td className="px-3 py-3 font-semibold text-ink-900">
                      {f.nombre}
                      <span className="block text-xs font-normal text-ink-400">{f.detalle}</span>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{NOMBRE_MONEDA[f.moneda]}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-900">{dinero(f.moneda, f.real)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-700">
                      {f.comprometido > 0 ? (
                        <button
                          type="button"
                          aria-expanded={abierta === f.clave}
                          onClick={() => setAbierta(abierta === f.clave ? null : f.clave)}
                          className="font-semibold text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-800"
                        >
                          {dinero(f.moneda, f.comprometido)}
                        </button>
                      ) : (
                        dinero(f.moneda, 0)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{dinero(f.moneda, f.estimado)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-500">{dinero(f.moneda, f.aRecibir)}</td>
                  </tr>
                  {abierta === f.clave && (
                    <tr className="bg-ink-25/60">
                      <td colSpan={6} className="px-3 py-3">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Qué compone lo comprometido</p>
                        <ul className="space-y-1 text-sm text-ink-700">
                          {f.reservas.map((r) => (
                            <li key={r.id}>
                              <span className="font-mono text-xs font-bold text-brand-700">{r.id}</span> · pago o cheque {r.operacionId} · {dinero(r.moneda, r.importe)}
                              <span className="text-xs text-ink-400"> · reservó {r.creada.usuarioId} el {r.creada.fechaHora}</span>
                            </li>
                          ))}
                          {f.autorizados.map((a) => (
                            <li key={a.id}>
                              <span className="font-mono text-xs font-bold text-brand-700">{a.id}</span> · movimiento de tesorería autorizado a {a.destino} · {dinero(f.moneda, a.importe)}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-400">
                    No hay datos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );

  return (
    <PaginaCaja
      seccion="Posición de caja y bancos"
      titulo="Posición de saldos"
      descripcion="Saldo real y saldo estimado de todas las cajas y cuentas bancarias, por cuenta y moneda. El estimado (real − comprometido) es el que manda: ningún egreso se autoriza por encima de él."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {MONEDAS.map((m) => (
          <Card key={m} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Posición total en {NOMBRE_MONEDA[m].toLowerCase()}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">{dinero(m, total(todas, m, "estimado"))}</p>
            <p className="mt-1 text-xs text-ink-500">
              Estimado · real {dinero(m, total(todas, m, "real"))} − comprometido {dinero(m, total(todas, m, "comprometido"))}
              {total(todas, m, "aRecibir") > 0 && ` · a recibir ${dinero(m, total(todas, m, "aRecibir"))} (no suma hasta que entra)`}
            </p>
          </Card>
        ))}
      </div>

      {tabla(
        "Cajas y tesoros",
        filasCaja,
        <div className="ml-auto">
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      )}
      {tabla(
        "Cuentas bancarias",
        filasBanco,
        <Link href="/caja/bancos" className="ml-auto text-sm font-semibold text-brand-700 hover:underline">
          Ir a Conciliaciones
        </Link>
      )}
      <p className="mt-4 max-w-3xl text-xs text-ink-500">
        Real: efectivo del libro en las cajas; en los bancos, saldo inicial + depósitos conciliados − transferencias ejecutadas − cheques debitados.
        Comprometido: reservas de las operaciones autorizadas (transferencias preparadas, cheques emitidos y no debitados, movimientos de tesorería
        autorizados que esperan su envío). A recibir: lo enviado que todavía no entró.
      </p>
    </PaginaCaja>
  );
}
