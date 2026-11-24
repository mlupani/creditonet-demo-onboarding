"use client";

import { useState } from "react";
import { conciliarDeposito, bancoTexto, nombreCaja, saldosBancarios } from "@/lib/caja-operaciones";
import { useCheques, useCuentasBancarias, useMovimientosTesoreria, useReservas, useUsuarioActual } from "@/lib/caja-store";
import { usePagosProveedor } from "@/lib/proveedores-store";
import { SIMBOLO, TIPO_CUENTA_LABEL, type MovimientoTesoreria } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Cifra, PanelVentana, Pill, TablaCompacta, Td, Th, type Fase } from "./compacto";
import { ErrorBanner, PaginaCaja, descargarXlsx, dinero, hoy, quien } from "./comunes";

type Filtro = "PENDIENTES" | "CONCILIADOS" | "TODOS";

const estadoDeposito = (m: MovimientoTesoreria): { label: string; fase: Fase } =>
  m.conciliacion
    ? { label: "Conciliado", fase: "ok" }
    : m.boletaDeposito
      ? { label: "Con boleta · sin conciliar", fase: "espera" }
      : m.estado === "EN_TRANSITO"
        ? { label: "En tránsito", fase: "proceso" }
        : { label: "Sin conciliar", fase: "espera" };

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
          <Button variant="dangerOutline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="success" onClick={conciliar}>Conciliar acreditación</Button>
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
  usePagosProveedor(); // las transferencias ejecutadas bajan el saldo real de la cuenta
  useCheques(); // los cheques debitados, también
  useReservas(); // y lo comprometido (transferencias preparadas, cheques emitidos) baja el estimado
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
      <Banner tone="info" title="Detalle pendiente en la especificación" className="mb-3">
        La importación de extractos bancarios (2.3.1) y la consulta de conciliaciones (2.3.2) están pendientes de definición. Por ahora se
        concilian a mano las acreditaciones de los depósitos en banco, y el listado de abajo permite consultar las ya conciliadas.
      </Banner>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cuentas
          .filter((c) => c.estado !== "ELIMINADO")
          .map((c) => {
            const s = saldos.find((x) => x.cuentaId === c.id);
            return (
              <Cifra key={c.id} label={`${c.banco} · ${TIPO_CUENTA_LABEL[c.tipo]} ${c.numero} · ${c.moneda}${c.estado === "SUSPENDIDO" ? " · suspendida" : ""}`} tono={(s?.estimado ?? 0) < 0 ? "malo" : "neutro"}>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-500">Saldo estimado</span>
                {dinero(c.moneda, s?.estimado ?? 0)}
                <span className="mt-1 block text-[11px] font-normal leading-snug text-ink-500">
                  Real {dinero(c.moneda, s?.real ?? 0)} − comprometido {dinero(c.moneda, s?.comprometido ?? 0)} (transferencias preparadas y cheques sin debitar)
                </span>
                <span className="mt-0.5 block text-[11px] font-normal leading-snug text-ink-500">
                  Real = inicial {dinero(c.moneda, s?.saldoInicial ?? 0)} + conciliado {dinero(c.moneda, s?.conciliado ?? 0)} − transferencias ejecutadas y cheques
                  debitados {dinero(c.moneda, s?.pagado ?? 0)}
                </span>
                <span className="mt-1 block text-[11px] font-normal text-ink-500">
                  A recibir (en tránsito o sin conciliar):{" "}
                  <span className="font-semibold tabular-nums text-ink-700">
                    {SIMBOLO[c.moneda]} {(s?.enTransito ?? 0).toLocaleString("es-AR")}
                  </span>
                </span>
              </Cifra>
            );
          })}
      </div>

      <PanelVentana
        className="mt-4"
        titulo="Depósitos en banco"
        accion={
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Filtrar depósitos" className="flex gap-0.5 rounded-md bg-ink-200 p-0.5">
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
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${filtro === id ? "bg-white text-brand-700 shadow-xs" : "text-ink-500 hover:text-ink-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button size="xs" variant="navyOutline" onClick={exportar}>
              Exportar a Excel
            </Button>
          </div>
        }
      >
        {depositos.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">
            {filtro === "PENDIENTES" ? "No hay depósitos pendientes de conciliar." : "No hay depósitos para mostrar."}
          </p>
        ) : (
          <TablaCompacta etiqueta="Depósitos en banco" minWidth="min-w-[52rem]">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Enviado</Th>
                <Th>Origen</Th>
                <Th>Cuenta</Th>
                <Th derecha>Importe</Th>
                <Th>Estado</Th>
                <Th>Acreditación</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {depositos.map((m) => {
                const e = estadoDeposito(m);
                return (
                  <tr key={m.id}>
                    <Td className="font-mono font-bold text-brand-700">{m.id}</Td>
                    <Td className="whitespace-nowrap">{m.envio?.fechaHora}</Td>
                    <Td>{nombreCaja(m.origenId)}</Td>
                    <Td>{bancoTexto(cuentaDe(m))}</Td>
                    <Td derecha className="font-semibold text-ink-900">{dinero(m.moneda, m.importe)}</Td>
                    <Td>
                      <Pill fase={e.fase}>{e.label}</Pill>
                    </Td>
                    <Td className="text-ink-600">
                      {m.conciliacion ? (
                        <>
                          {m.conciliacion.fechaAcreditacion} · ref. {m.conciliacion.referencia}
                          <br />
                          <span className="text-ink-400">Concilió {quien(m.conciliacion.usuarioId)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right">
                      {!m.conciliacion && (
                        <Button
                          size="xs"
                          variant="successOutline"
                          disabled={!esTesorero}
                          title={esTesorero ? undefined : "Sólo el Tesorero concilia las acreditaciones."}
                          onClick={() => setAConciliar(m)}
                        >
                          Conciliar
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TablaCompacta>
        )}
      </PanelVentana>

      {aConciliar && <ConciliarModal key={aConciliar.id} deposito={aConciliar} onClose={() => setAConciliar(null)} />}
    </PaginaCaja>
  );
}
