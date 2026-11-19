"use client";

import { useState } from "react";
import { conciliarDeposito, bancoTexto, nombreCaja, saldosBancarios } from "@/lib/caja-operaciones";
import { useCuentasBancarias, useMovimientosTesoreria, useUsuarioActual } from "@/lib/caja-store";
import { SIMBOLO, TIPO_CUENTA_LABEL, type MovimientoTesoreria } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorBanner, PaginaCaja, descargarXlsx, dinero, hoy, quien } from "./comunes";

type Filtro = "PENDIENTES" | "CONCILIADOS" | "TODOS";

const estadoDeposito = (m: MovimientoTesoreria) =>
  m.conciliacion
    ? { label: "Conciliado", tone: "success" as const }
    : m.boletaDeposito
      ? { label: "Con boleta · sin conciliar", tone: "warning" as const }
      : m.estado === "EN_TRANSITO"
        ? { label: "En tránsito", tone: "info" as const }
        : { label: "Sin conciliar", tone: "warning" as const };

function ConciliarModal({ deposito, onClose }: { deposito: MovimientoTesoreria; onClose: () => void }) {
  const [importe, setImporte] = useState(deposito.importe);
  const [fecha, setFecha] = useState(hoy());
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);

  const conciliar = () => {
    const r = conciliarDeposito(deposito.id, importe, fecha, referencia);
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Conciliar depósito ${deposito.id}`}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={conciliar}>Conciliar acreditación</Button>
        </div>
      }
    >
      <p className="text-sm text-ink-500">
        Confirmá la acreditación contra el extracto de {bancoTexto(deposito.destino.tipo === "BANCO" ? deposito.destino.cuentaId : "")}. Depositado:{" "}
        <span className="font-semibold text-ink-900">{dinero(deposito.moneda, deposito.importe)}</span>
        {deposito.boletaDeposito && ` · boleta ${deposito.boletaDeposito}`}.
      </p>
      <div className="mt-4 space-y-4">
        <MoneyInput id="conc-importe" label="Importe acreditado" required value={importe} onChange={setImporte} />
        <FormField id="conc-fecha" label="Fecha de acreditación" type="date" required value={fecha} onChange={setFecha} />
        <FormField id="conc-ref" label="Referencia del extracto" required value={referencia} onChange={setReferencia} placeholder="Ej.: movimiento 884512" />
      </div>
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function PantallaBancos() {
  const cuentas = useCuentasBancarias();
  const movimientos = useMovimientosTesoreria();
  const usuario = useUsuarioActual();
  const [filtro, setFiltro] = useState<Filtro>("PENDIENTES");
  const [aConciliar, setAConciliar] = useState<MovimientoTesoreria | null>(null);

  const saldos = saldosBancarios();
  const esTesorero = usuario.roles.includes("TESORERO");
  const depositos = movimientos
    .filter((m) => m.destino.tipo === "BANCO" && m.envio)
    .filter((m) => (filtro === "TODOS" ? true : filtro === "CONCILIADOS" ? !!m.conciliacion : !m.conciliacion))
    .sort((a, b) => b.id.localeCompare(a.id));
  const cuentaDe = (m: MovimientoTesoreria) => (m.destino.tipo === "BANCO" ? m.destino.cuentaId : "");

  const exportar = () =>
    descargarXlsx("bancos-depositos.xlsx", "Depósitos", [
      ["ID", "Fecha de envío", "Cuenta", "Origen", "Moneda", "Importe", "Estado", "Boleta", "Fecha de acreditación", "Referencia"],
      ...depositos.map((m) => [
        m.id,
        m.envio?.fechaHora ?? "",
        bancoTexto(cuentaDe(m)),
        nombreCaja(m.origenId),
        m.moneda,
        String(m.importe),
        estadoDeposito(m).label,
        m.boletaDeposito ?? "",
        m.conciliacion?.fechaAcreditacion ?? "",
        m.conciliacion?.referencia ?? "",
      ]),
    ]);

  return (
    <PaginaCaja
      seccion="Bancos"
      titulo="Conciliaciones"
      descripcion="Posición de las cuentas bancarias y conciliación de las acreditaciones de los depósitos que salen de la tesorería."
    >
      <Banner tone="info" title="Detalle pendiente en la especificación" className="mb-4">
        La importación de extractos bancarios (2.3.1) y la consulta de conciliaciones (2.3.2) están pendientes de definición. Por ahora se
        concilian a mano las acreditaciones de los depósitos en banco, y el listado de abajo permite consultar las ya conciliadas.
      </Banner>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cuentas
          .filter((c) => c.estado !== "ELIMINADO")
          .map((c) => {
            const s = saldos.find((x) => x.cuentaId === c.id);
            return (
              <Card key={c.id} className="p-4">
                <p className="text-sm font-semibold text-ink-900">{c.banco}</p>
                <p className="text-xs text-ink-500">
                  {TIPO_CUENTA_LABEL[c.tipo]} {c.numero} · {c.moneda}
                  {c.estado === "SUSPENDIDO" && " · suspendida"}
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Acreditado y conciliado</p>
                <p className="text-xl font-bold tabular-nums text-ink-900">{dinero(c.moneda, s?.conciliado ?? 0)}</p>
                <p className="mt-2 text-xs text-ink-500">
                  En tránsito o sin conciliar:{" "}
                  <span className="font-semibold tabular-nums text-ink-700">
                    {SIMBOLO[c.moneda]} {(s?.enTransito ?? 0).toLocaleString("es-AR")}
                  </span>
                </p>
              </Card>
            );
          })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar depósitos" className="flex gap-0.5 rounded-lg bg-ink-100 p-0.5">
          {(
            [
              ["PENDIENTES", "A conciliar"],
              ["CONCILIADOS", "Conciliados"],
              ["TODOS", "Todos"],
            ] as [Filtro, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${filtro === id ? "bg-white text-brand-700 shadow-xs" : "text-ink-500 hover:text-ink-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        {depositos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">
            {filtro === "PENDIENTES" ? "No hay depósitos pendientes de conciliar." : "No hay depósitos para mostrar."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Enviado</th>
                  <th className="px-3 py-2.5">Origen</th>
                  <th className="px-3 py-2.5">Cuenta</th>
                  <th className="px-3 py-2.5 text-right">Importe</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5">Acreditación</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {depositos.map((m) => {
                  const e = estadoDeposito(m);
                  return (
                    <tr key={m.id}>
                      <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{m.id}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-700">{m.envio?.fechaHora}</td>
                      <td className="px-3 py-3 text-ink-700">{nombreCaja(m.origenId)}</td>
                      <td className="px-3 py-3 text-ink-700">{bancoTexto(cuentaDe(m))}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{dinero(m.moneda, m.importe)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={e.tone}>{e.label}</StatusBadge>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-600">
                        {m.conciliacion ? (
                          <>
                            {m.conciliacion.fechaAcreditacion} · ref. {m.conciliacion.referencia}
                            <br />
                            <span className="text-ink-400">Concilió {quien(m.conciliacion.usuarioId)}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!m.conciliacion && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!esTesorero}
                            title={esTesorero ? undefined : "Sólo el Tesorero concilia las acreditaciones."}
                            onClick={() => setAConciliar(m)}
                          >
                            Conciliar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {aConciliar && <ConciliarModal key={aConciliar.id} deposito={aConciliar} onClose={() => setAConciliar(null)} />}
    </PaginaCaja>
  );
}
