"use client";

import Link from "next/link";
import { saldosBancarios } from "@/lib/caja-operaciones";
import { saldosCaja } from "@/lib/caja-reglas";
import { useCajaDatos, useCuentasBancarias } from "@/lib/caja-store";
import { MONEDAS, NOMBRE_MONEDA, TIPO_CAJA_LABEL, TIPO_CUENTA_LABEL, monedasDe } from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PaginaCaja, descargarXlsx, dinero } from "./comunes";

// Posición de saldos (v2, 4.1): el saldo en el momento de todas las cajas y cuentas bancarias, por
// cuenta y moneda. El detalle por caja (estado, diferencias, alertas) está en el Tablero de tesoros.
export function PantallaPosicion() {
  const d = useCajaDatos();
  const cuentas = useCuentasBancarias();
  const bancarios = saldosBancarios();

  const cajas = d.cajas
    .filter((c) => c.estado === "ACTIVO")
    .map((c) => ({
      caja: c,
      sucursal: d.sucursales.find((s) => s.id === c.sucursalId)?.nombre ?? c.sucursalId,
      saldos: saldosCaja(d.libro, c),
    }));
  const cuentasActivas = cuentas.filter((c) => c.estado !== "ELIMINADO");
  const filasBanco = cuentasActivas.map((c) => ({ cuenta: c, saldo: bancarios.find((x) => x.cuentaId === c.id) }));

  const totalCajas = { ARS: 0, USD: 0 };
  for (const f of cajas) for (const m of monedasDe(f.caja.moneda)) totalCajas[m] += f.saldos[m];
  const totalBancos = { ARS: 0, USD: 0 };
  for (const f of filasBanco) totalBancos[f.cuenta.moneda] += f.saldo?.conciliado ?? 0;

  const exportar = () =>
    descargarXlsx("posicion-de-saldos.xlsx", "Posición de saldos", [
      ["Tipo", "Cuenta", "Detalle", "Moneda", "Saldo", "En tránsito o sin conciliar"],
      ...cajas.flatMap((f) =>
        monedasDe(f.caja.moneda).map((m) => ["Caja", f.caja.nombre, `${TIPO_CAJA_LABEL[f.caja.tipo]} · ${f.sucursal}`, m, String(f.saldos[m]), ""])
      ),
      ...filasBanco.map((f) => [
        "Banco",
        `${f.cuenta.banco} ${f.cuenta.numero}`,
        TIPO_CUENTA_LABEL[f.cuenta.tipo],
        f.cuenta.moneda,
        String(f.saldo?.conciliado ?? 0),
        String(f.saldo?.enTransito ?? 0),
      ]),
      ...MONEDAS.map((m) => ["Total", "Cajas y bancos", "", m, String(totalCajas[m] + totalBancos[m]), ""]),
    ]);

  return (
    <PaginaCaja
      seccion="Posición de caja y bancos"
      titulo="Posición de saldos"
      descripcion="Saldo en el momento de todas las cajas y cuentas bancarias, por cuenta y moneda."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {MONEDAS.map((m) => (
          <Card key={m} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Posición total en {NOMBRE_MONEDA[m].toLowerCase()}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">{dinero(m, totalCajas[m] + totalBancos[m])}</p>
            <p className="mt-1 text-xs text-ink-500">
              Cajas: {dinero(m, totalCajas[m])} · Bancos: {dinero(m, totalBancos[m])}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">Cajas y tesoros</h2>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      </div>
      <Card className="mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2.5">Caja</th>
                <th className="px-3 py-2.5">Sucursal</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5 text-right">Pesos</th>
                <th className="px-3 py-2.5 text-right">Dólares</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {cajas.map((f) => (
                <tr key={f.caja.id}>
                  <td className="px-3 py-3 font-semibold text-ink-900">{f.caja.nombre}</td>
                  <td className="px-3 py-3 text-ink-700">{f.sucursal}</td>
                  <td className="px-3 py-3 text-ink-700">{TIPO_CAJA_LABEL[f.caja.tipo]}</td>
                  {MONEDAS.map((m) => (
                    <td key={m} className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                      {monedasDe(f.caja.moneda).includes(m) ? dinero(m, f.saldos[m]) : <span className="font-normal text-ink-400">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 bg-ink-25 font-semibold text-ink-900">
                <td className="px-3 py-3" colSpan={3}>
                  Total de efectivo
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{dinero("ARS", totalCajas.ARS)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{dinero("USD", totalCajas.USD)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">Cuentas bancarias</h2>
        <Link href="/caja/bancos" className="ml-auto text-sm font-semibold text-brand-700 hover:underline">
          Ir a Conciliaciones
        </Link>
      </div>
      <Card className="mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2.5">Cuenta</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Moneda</th>
                <th className="px-3 py-2.5 text-right">Acreditado y conciliado</th>
                <th className="px-3 py-2.5 text-right">En tránsito o sin conciliar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filasBanco.map((f) => (
                <tr key={f.cuenta.id}>
                  <td className="px-3 py-3 font-semibold text-ink-900">
                    {f.cuenta.banco} {f.cuenta.numero}
                    {f.cuenta.estado === "SUSPENDIDO" && <span className="ml-2 text-xs font-normal text-ink-400">suspendida</span>}
                  </td>
                  <td className="px-3 py-3 text-ink-700">{TIPO_CUENTA_LABEL[f.cuenta.tipo]}</td>
                  <td className="px-3 py-3 text-ink-700">{NOMBRE_MONEDA[f.cuenta.moneda]}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{dinero(f.cuenta.moneda, f.saldo?.conciliado ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-700">{dinero(f.cuenta.moneda, f.saldo?.enTransito ?? 0)}</td>
                </tr>
              ))}
              {filasBanco.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-400">
                    No hay cuentas bancarias cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PaginaCaja>
  );
}
