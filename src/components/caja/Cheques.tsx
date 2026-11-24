"use client";

import { useState } from "react";
import { esResponsable } from "@/lib/caja-reglas";
import { hoy, useCajas, useChequeras, useCheques, useCuentasBancarias, useTiposChequera, useUsuarioActual } from "@/lib/caja-store";
import { ESTADO_CHEQUE_LABEL, FORMA_CHEQUE_LABEL, monedasDe, type Cheque, type EstadoCheque, type FormaCheque, type Moneda } from "@/lib/caja-tipos";
import {
  anularChequePropio,
  debitarChequePropio,
  depositarCheque,
  emitirChequePropio,
  entregarCheque,
  entregarChequePropio,
  presentarChequePropio,
  rechazarCheque,
  rechazarChequePropio,
  recibirChequeTercero,
} from "@/lib/cheques-operaciones";
import { diasHastaPago, formaDeTipo, numeracionDe, totalPorMoneda, vencePronto } from "@/lib/cheques-reglas";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorBanner, NotaModal, PaginaCaja, descargarXlsx, dinero } from "./comunes";

type Tono = "success" | "warning" | "danger" | "neutral" | "info";
const TONO_ESTADO: Record<EstadoCheque, Tono> = {
  EN_CUSTODIA: "info",
  DEPOSITADO: "success",
  RECHAZADO: "danger",
  ENTREGADO: "neutral",
  EMITIDO: "info",
  PRESENTADO: "warning",
  DEBITADO: "success",
  ANULADO: "neutral",
};

// Un cheque propio sigue vigente (y con su importe reservado) hasta que el banco lo debita o se anula/rechaza.
const PROPIO_VIGENTE: EstadoCheque[] = ["EMITIDO", "ENTREGADO", "PRESENTADO"];

const aNumero = (texto: string) => Number(texto.replace(",", "."));

function Vencimiento({ cheque }: { cheque: Cheque }) {
  const dias = diasHastaPago(cheque.fechaPago, hoy());
  const vivo = cheque.estado === "EN_CUSTODIA" || PROPIO_VIGENTE.includes(cheque.estado);
  return (
    <span className="whitespace-nowrap">
      {cheque.fechaPago}
      {vivo && dias < 0 && <StatusBadge tone="danger" className="ml-2">Vencido</StatusBadge>}
      {vivo && dias >= 0 && dias <= 7 && <StatusBadge tone="warning" className="ml-2">{dias === 0 ? "Vence hoy" : `Vence en ${dias} d`}</StatusBadge>}
    </span>
  );
}

function TrazaModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Historial de ${cheque.id}`} maxWidth="max-w-lg">
      <ol className="space-y-2 text-sm">
        {cheque.traza.map((t, i) => (
          <li key={i} className="rounded-lg border border-ink-100 p-3">
            <p className="font-semibold text-ink-900">{ESTADO_CHEQUE_LABEL[t.estado]}</p>
            <p className="text-ink-600">{t.detalle}</p>
            <p className="text-xs text-ink-400">
              {t.usuario} · {t.fechaHora}
            </p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function RecibirModal({ onClose }: { onClose: () => void }) {
  const usuario = useUsuarioActual();
  const operables = useCajas().filter((c) => c.estado === "ACTIVO" && esResponsable(c, usuario.id));
  const [cajaId, setCajaId] = useState(operables[0]?.id ?? "");
  const [forma, setForma] = useState<FormaCheque>("FISICO");
  const [banco, setBanco] = useState("");
  const [numero, setNumero] = useState("");
  const [importe, setImporte] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [librador, setLibrador] = useState("");
  const [emision, setEmision] = useState(hoy());
  const [pago, setPago] = useState("");
  const [error, setError] = useState<string | null>(null);
  const caja = operables.find((c) => c.id === cajaId);
  const monedas = caja ? monedasDe(caja.moneda) : [];
  const monedaOk = monedas.includes(moneda) ? moneda : (monedas[0] ?? moneda);

  const grabar = () => {
    const r = recibirChequeTercero({
      cajaId,
      forma,
      banco,
      numero,
      importe: aNumero(importe),
      moneda: monedaOk,
      librador,
      fechaEmision: emision,
      fechaPago: pago,
    });
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Recibir cheque en custodia"
      maxWidth="max-w-xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={grabar} disabled={operables.length === 0}>
            Registrar
          </Button>
        </div>
      }
    >
      {operables.length === 0 ? (
        <Banner tone="info">{usuario.nombre} no es responsable de ninguna caja. Cambiá el usuario en «Actuar como».</Banner>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="ch-caja" label="Caja que lo custodia" required value={cajaId} onChange={setCajaId} options={operables.map((c) => ({ value: c.id, label: c.nombre }))} />
          <SelectField id="ch-forma" label="Forma" required value={forma} onChange={(v) => setForma(v as FormaCheque)} options={[{ value: "FISICO", label: "Físico" }, { value: "ECHEQ", label: "E-cheq" }]} />
          <FormField id="ch-banco" label="Banco" required value={banco} onChange={setBanco} />
          <FormField id="ch-numero" label="Número" required value={numero} onChange={setNumero} />
          <FormField id="ch-importe" label="Importe" required inputMode="numeric" value={importe} onChange={setImporte} />
          <SelectField id="ch-moneda" label="Moneda" required value={monedaOk} onChange={(v) => setMoneda(v as Moneda)} options={monedas.map((m) => ({ value: m, label: m }))} />
          <FormField id="ch-librador" label="Librador" required value={librador} onChange={setLibrador} className="sm:col-span-2" />
          <FormField id="ch-emision" label="Fecha de emisión" type="date" required value={emision} onChange={setEmision} />
          <FormField id="ch-pago" label="Fecha de pago (vencimiento)" type="date" required value={pago} onChange={setPago} />
        </div>
      )}
      <ErrorBanner error={error} />
    </Modal>
  );
}

function DepositarModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  const cuentas = useCuentasBancarias().filter((c) => c.estado === "ACTIVO" && c.moneda === cheque.moneda);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Depositar ${cheque.id}`}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const r = depositarCheque(cheque.id, cuentaId, fecha);
              if (r.ok) onClose();
              else setError(r.error);
            }}
          >
            Depositar
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        {cheque.banco} {cheque.numero} · {dinero(cheque.moneda, cheque.importe)}. El cheque sale de la custodia; no mueve el efectivo de la caja.
      </p>
      <div className="space-y-4">
        <SelectField
          id="dep-cuenta"
          label="Cuenta bancaria"
          required
          value={cuentaId}
          onChange={setCuentaId}
          placeholder={cuentas.length === 0 ? `Sin cuentas en ${cheque.moneda}` : undefined}
          options={cuentas.map((c) => ({ value: c.id, label: `${c.banco} · ${c.numero}` }))}
        />
        <FormField id="dep-fecha" label="Fecha del depósito" type="date" required value={fecha} onChange={setFecha} />
      </div>
      <ErrorBanner error={error} />
    </Modal>
  );
}

function EmitirModal({ onClose }: { onClose: () => void }) {
  const cuentas = useCuentasBancarias().filter((c) => c.estado === "ACTIVO");
  const chequeras = useChequeras().filter((q) => q.estado === "ACTIVO");
  const tipos = useTiposChequera();
  const cheques = useCheques();
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const delasCuenta = chequeras.filter((q) => q.cuentaId === cuentaId);
  const [chequeraElegida, setChequeraElegida] = useState("");
  const chequeraId = delasCuenta.some((q) => q.id === chequeraElegida) ? chequeraElegida : (delasCuenta[0]?.id ?? "");
  const [importe, setImporte] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [pago, setPago] = useState("");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title="Emitir cheque propio"
      maxWidth="max-w-xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const r = emitirChequePropio({ cuentaId, chequeraId: chequeraId || undefined, importe: aNumero(importe), beneficiario, fechaPago: pago, referencia });
              if (r.ok) onClose();
              else setError(r.error);
            }}
          >
            Emitir
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="em-cuenta" label="Cuenta bancaria" required value={cuentaId} onChange={setCuentaId} options={cuentas.map((c) => ({ value: c.id, label: `${c.banco} · ${c.numero} (${c.moneda})` }))} />
        <SelectField
          id="em-chequera"
          label="Chequera"
          required
          value={chequeraId}
          onChange={setChequeraElegida}
          placeholder={delasCuenta.length === 0 ? "La cuenta no tiene chequeras" : undefined}
          options={delasCuenta.map((q) => {
            const n = numeracionDe(q, cheques);
            return {
              value: q.id,
              label: `${q.id} · ${tipos.find((t) => t.id === q.tipoId)?.descripcion ?? ""}${n.conRango ? ` · ${n.disponibles} disponibles` : ""}`,
            };
          })}
        />
        <FormField id="em-benef" label="Beneficiario" required value={beneficiario} onChange={setBeneficiario} className="sm:col-span-2" />
        <FormField id="em-importe" label="Importe" required inputMode="numeric" value={importe} onChange={setImporte} />
        <FormField id="em-pago" label="Fecha de pago" type="date" required value={pago} onChange={setPago} />
        <FormField id="em-ref" label="Referencia" value={referencia} onChange={setReferencia} placeholder="Ej.: factura" className="sm:col-span-2" />
      </div>
      <ErrorBanner error={error} />
    </Modal>
  );
}

type Accion =
  | { tipo: "recibir" }
  | { tipo: "emitir" }
  | { tipo: "depositar" | "rechazar" | "entregar" | "anular" | "traza" | "entregar-propio" | "rechazar-propio"; cheque: Cheque };

export function PantallaCheques() {
  const cheques = useCheques();
  const cajas = useCajas();
  const cuentas = useCuentasBancarias();
  const chequeras = useChequeras();
  const tipos = useTiposChequera();
  const usuario = useUsuarioActual();
  const [pestana, setPestana] = useState<"custodia" | "propios">("custodia");
  const [estado, setEstado] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [forma, setForma] = useState("");
  const [soloPronto, setSoloPronto] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origen = pestana === "custodia" ? "TERCERO" : "PROPIO";
  const estados = (Object.keys(ESTADO_CHEQUE_LABEL) as EstadoCheque[]).filter((e) => (pestana === "custodia" ? ["EN_CUSTODIA", "DEPOSITADO", "RECHAZADO", "ENTREGADO"] : ["EMITIDO", "ENTREGADO", "PRESENTADO", "DEBITADO", "ANULADO", "RECHAZADO"]).includes(e));
  const filas = cheques
    .filter((c) => c.origen === origen)
    .filter((c) => !estado || c.estado === estado)
    .filter((c) => !forma || c.forma === forma)
    .filter((c) => pestana !== "custodia" || !cajaId || c.cajaId === cajaId)
    .filter((c) => !soloPronto || vencePronto({ ...c, estado: "EN_CUSTODIA" }, hoy()) || (PROPIO_VIGENTE.includes(c.estado) && diasHastaPago(c.fechaPago, hoy()) <= 7))
    .sort((a, b) => a.fechaPago.localeCompare(b.fechaPago));

  const enCustodiaTotal = cheques.filter((c) => c.origen === "TERCERO" && c.estado === "EN_CUSTODIA");
  const totales = totalPorMoneda(enCustodiaTotal);
  const porVencer = enCustodiaTotal.filter((c) => vencePronto(c, hoy())).length;
  const cajaNombre = (id?: string) => cajas.find((c) => c.id === id)?.nombre ?? "—";
  const cuentaTexto = (id?: string) => {
    const c = cuentas.find((x) => x.id === id);
    return c ? `${c.banco} · ${c.numero}` : "—";
  };
  const puedeOperar = (c: Cheque) => {
    const caja = cajas.find((x) => x.id === c.cajaId);
    return !!caja && esResponsable(caja, usuario.id);
  };
  const puedePropios = usuario.roles.some((r) => r === "TESORERO" || r === "TESORERO_CENTRAL" || r === "SUPERVISOR");

  const correr = (r: { ok: true } | { ok: false; error: string }) => setError(r.ok ? null : r.error);

  const exportar = () => {
    const encabezado =
      pestana === "custodia"
        ? ["ID", "Caja", "Forma", "Banco", "Número", "Librador", "Importe", "Moneda", "Emisión", "Vencimiento", "Estado"]
        : ["ID", "Forma", "Banco", "Número", "Cuenta", "Beneficiario", "Importe", "Moneda", "Emisión", "Vencimiento", "Referencia", "Estado"];
    const datos = filas.map((c) =>
      pestana === "custodia"
        ? [c.id, cajaNombre(c.cajaId), FORMA_CHEQUE_LABEL[c.forma], c.banco, c.numero, c.parte, String(c.importe), c.moneda, c.fechaEmision, c.fechaPago, ESTADO_CHEQUE_LABEL[c.estado]]
        : [c.id, FORMA_CHEQUE_LABEL[c.forma], c.banco, c.numero, cuentaTexto(c.cuentaId), c.parte, String(c.importe), c.moneda, c.fechaEmision, c.fechaPago, c.referencia ?? "", ESTADO_CHEQUE_LABEL[c.estado]]
    );
    descargarXlsx(pestana === "custodia" ? "cheques-en-custodia.xlsx" : "cheques-propios.xlsx", "Cheques", [encabezado, ...datos]);
  };

  return (
    <PaginaCaja
      seccion="Bancos"
      titulo="Cheques y valores"
      descripcion="Cheques de terceros en custodia de cada caja (se cuentan aparte del efectivo) y cheques propios emitidos desde las chequeras."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">En custodia</p>
          <p className="mt-1 text-lg font-bold text-ink-900">{enCustodiaTotal.length} cheques</p>
          <p className="text-sm text-ink-500">{(["ARS", "USD"] as Moneda[]).filter((m) => totales[m] > 0).map((m) => dinero(m, totales[m])).join(" y ") || "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Vencen en 7 días</p>
          <p className="mt-1 text-lg font-bold text-ink-900">{porVencer}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Propios emitidos</p>
          <p className="mt-1 text-lg font-bold text-ink-900">{cheques.filter((c) => c.origen === "PROPIO" && PROPIO_VIGENTE.includes(c.estado)).length} sin debitar</p>
        </Card>
      </div>

      <div className="mb-4 flex gap-2" role="tablist">
        {([["custodia", "En custodia de caja"], ["propios", "Propios emitidos"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => {
              setPestana(id);
              setEstado("");
              setError(null);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${pestana === id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-600 hover:bg-ink-25"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pestana === "propios" && (
        <Card className="mb-5">
          <CardHeader title="Numeración por chequera" description="Números usados y disponibles de cada chequera activa." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {chequeras
              .filter((q) => q.estado === "ACTIVO")
              .map((q) => {
                const n = numeracionDe(q, cheques);
                const tipo = tipos.find((t) => t.id === q.tipoId);
                return (
                  <div key={q.id} className="rounded-xl border border-ink-200 p-3 text-sm">
                    <p className="font-semibold text-ink-900">
                      {q.id} · {tipo?.descripcion ?? "—"} · {cuentaTexto(q.cuentaId)}
                    </p>
                    <p className="text-ink-600">
                      {n.conRango
                        ? `Rango ${q.desde} a ${q.hasta}: ${n.usados} usados de ${n.total}, ${n.disponibles} disponibles`
                        : `${formaDeTipo(tipo) === "ECHEQ" ? "E-cheq sin rango" : "Sin rango"}: ${n.usados} emitidos`}
                    </p>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SelectField id="f-estado" label="Estado" value={estado} onChange={setEstado} placeholder="Todos" options={estados.map((e) => ({ value: e, label: ESTADO_CHEQUE_LABEL[e] }))} />
        <SelectField id="f-forma" label="Forma" value={forma} onChange={setForma} placeholder="Todas" options={[{ value: "FISICO", label: "Físico" }, { value: "ECHEQ", label: "E-cheq" }]} />
        {pestana === "custodia" && (
          <SelectField id="f-caja" label="Caja" value={cajaId} onChange={setCajaId} placeholder="Todas" options={cajas.filter((c) => c.estado === "ACTIVO").map((c) => ({ value: c.id, label: c.nombre }))} />
        )}
        <label className="flex h-10 items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={soloPronto} onChange={(e) => setSoloPronto(e.target.checked)} className="size-4" />
          Vencen en 7 días
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
          {pestana === "custodia" ? (
            <Button onClick={() => setAccion({ tipo: "recibir" })}>Recibir cheque</Button>
          ) : (
            <Button onClick={() => setAccion({ tipo: "emitir" })}>Emitir cheque</Button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} />

      <Card className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-4 py-2.5">ID</th>
              <th className="px-4 py-2.5">{pestana === "custodia" ? "Caja" : "Cuenta"}</th>
              <th className="px-4 py-2.5">Cheque</th>
              <th className="px-4 py-2.5">{pestana === "custodia" ? "Librador" : "Beneficiario"}</th>
              <th className="px-4 py-2.5 text-right">Importe</th>
              <th className="px-4 py-2.5">Vencimiento</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-400">
                  No hay cheques con esos filtros.
                </td>
              </tr>
            )}
            {filas.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold text-ink-900">{c.id}</td>
                <td className="px-4 py-3 text-ink-700">{pestana === "custodia" ? cajaNombre(c.cajaId) : cuentaTexto(c.cuentaId)}</td>
                <td className="px-4 py-3 text-ink-700">
                  {FORMA_CHEQUE_LABEL[c.forma]} · {c.banco} {c.numero}
                  {c.referencia && <span className="block text-xs text-ink-400">{c.referencia}</span>}
                </td>
                <td className="px-4 py-3 text-ink-700">{c.parte}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-900">{dinero(c.moneda, c.importe)}</td>
                <td className="px-4 py-3 text-ink-700">
                  <Vencimiento cheque={c} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={TONO_ESTADO[c.estado]}>{ESTADO_CHEQUE_LABEL[c.estado]}</StatusBadge>
                  {c.origen === "PROPIO" && PROPIO_VIGENTE.includes(c.estado) && <span className="mt-1 block text-xs text-ink-400">Importe reservado</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.origen === "TERCERO" && c.estado === "EN_CUSTODIA" && (
                      <>
                        <Button size="sm" variant="outline" disabled={!puedeOperar(c)} title={puedeOperar(c) ? undefined : "Sólo un responsable de la caja"} onClick={() => setAccion({ tipo: "depositar", cheque: c })}>
                          Depositar
                        </Button>
                        <Button size="sm" variant="outline" disabled={!puedeOperar(c)} onClick={() => setAccion({ tipo: "entregar", cheque: c })}>
                          Entregar
                        </Button>
                      </>
                    )}
                    {c.origen === "TERCERO" && (c.estado === "EN_CUSTODIA" || c.estado === "DEPOSITADO") && (
                      <Button size="sm" variant="outline" disabled={!puedeOperar(c)} onClick={() => setAccion({ tipo: "rechazar", cheque: c })}>
                        Rechazar
                      </Button>
                    )}
                    {c.origen === "PROPIO" && c.estado === "EMITIDO" && (
                      <>
                        <Button size="sm" variant="outline" disabled={!puedePropios} title={puedePropios ? undefined : "Sólo Tesorero, Tesorero central o Supervisor"} onClick={() => setAccion({ tipo: "entregar-propio", cheque: c })}>
                          Entregar
                        </Button>
                        <Button size="sm" variant="outline" disabled={!puedePropios} onClick={() => setAccion({ tipo: "anular", cheque: c })}>
                          Anular
                        </Button>
                      </>
                    )}
                    {c.origen === "PROPIO" && c.estado === "ENTREGADO" && (
                      <Button size="sm" variant="outline" disabled={!puedePropios} title="El beneficiario lo presentó al cobro" onClick={() => correr(presentarChequePropio(c.id))}>
                        Presentado
                      </Button>
                    )}
                    {c.origen === "PROPIO" && c.estado === "PRESENTADO" && (
                      <>
                        <Button size="sm" variant="outline" disabled={!puedePropios} title="Debitado en el extracto: baja el saldo real" onClick={() => correr(debitarChequePropio(c.id))}>
                          Debitado
                        </Button>
                        <Button size="sm" variant="outline" disabled={!puedePropios} onClick={() => setAccion({ tipo: "rechazar-propio", cheque: c })}>
                          Rechazado por el banco
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setAccion({ tipo: "traza", cheque: c })}>
                      Historial
                    </Button>
                  </div>
                  <span className="mt-1 block text-xs text-ink-400">Alta: {c.usuarioAlta} · {c.fechaAlta}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {accion?.tipo === "recibir" && <RecibirModal onClose={() => setAccion(null)} />}
      {accion?.tipo === "emitir" && <EmitirModal onClose={() => setAccion(null)} />}
      {accion?.tipo === "depositar" && <DepositarModal cheque={accion.cheque} onClose={() => setAccion(null)} />}
      {accion?.tipo === "traza" && <TrazaModal cheque={accion.cheque} onClose={() => setAccion(null)} />}
      {accion?.tipo === "rechazar" && (
        <NotaModal
          open
          titulo={`Rechazar ${accion.cheque.id}`}
          descripcion="El banco rechazó el cheque o no se puede cobrar."
          etiquetaNota="Motivo del rechazo"
          requerida
          confirmar="Rechazar"
          tono="danger"
          onClose={() => setAccion(null)}
          onConfirmar={(nota) => {
            const r = rechazarCheque(accion.cheque.id, nota);
            return r.ok ? null : r.error;
          }}
        />
      )}
      {accion?.tipo === "entregar" && (
        <NotaModal
          open
          titulo={`Entregar ${accion.cheque.id}`}
          descripcion="El cheque sale de la custodia de la caja (por ejemplo, para pagar a un proveedor)."
          etiquetaNota="Entregado a"
          requerida
          confirmar="Entregar"
          onClose={() => setAccion(null)}
          onConfirmar={(nota) => {
            const r = entregarCheque(accion.cheque.id, nota);
            return r.ok ? null : r.error;
          }}
        />
      )}
      {accion?.tipo === "entregar-propio" && (
        <NotaModal
          open
          titulo={`Entregar ${accion.cheque.id}`}
          descripcion="Con la entrega al beneficiario (o el envío del e-cheq) el pago al proveedor queda hecho y su orden de pago pasa a Pagada. El banco todavía no lo debitó: el saldo real no cambia."
          etiquetaNota="Entregado a"
          requerida
          confirmar="Entregar"
          onClose={() => setAccion(null)}
          onConfirmar={(nota) => {
            const r = entregarChequePropio(accion.cheque.id, nota);
            return r.ok ? null : r.error;
          }}
        />
      )}
      {accion?.tipo === "rechazar-propio" && (
        <NotaModal
          open
          titulo={`Rechazo del banco: ${accion.cheque.id}`}
          descripcion="El banco rechazó el cheque presentado: se libera la reserva y la deuda vuelve a quedar pendiente en la orden de pago."
          etiquetaNota="Motivo del rechazo"
          requerida
          confirmar="Registrar rechazo"
          tono="danger"
          onClose={() => setAccion(null)}
          onConfirmar={(nota) => {
            const r = rechazarChequePropio(accion.cheque.id, nota);
            return r.ok ? null : r.error;
          }}
        />
      )}
      {accion?.tipo === "anular" && (
        <NotaModal
          open
          titulo={`Anular ${accion.cheque.id}`}
          descripcion="El número del cheque anulado queda consumido en la chequera."
          etiquetaNota="Motivo de la anulación"
          requerida
          confirmar="Anular"
          tono="danger"
          onClose={() => setAccion(null)}
          onConfirmar={(nota) => {
            const r = anularChequePropio(accion.cheque.id, nota);
            return r.ok ? null : r.error;
          }}
        />
      )}
    </PaginaCaja>
  );
}
