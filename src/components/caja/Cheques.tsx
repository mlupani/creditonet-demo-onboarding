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
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { Campo, Cifra, INPUT_COMPACTO, PanelVentana, Pill, TablaCompacta, Td, Th, type Fase } from "./compacto";
import { ErrorBanner, NotaModal, PaginaCaja, descargarXlsx, dinero } from "./comunes";

const FASE_ESTADO: Record<EstadoCheque, Fase> = {
  EN_CUSTODIA: "proceso",
  DEPOSITADO: "ok",
  RECHAZADO: "rechazo",
  ENTREGADO: "proceso",
  EMITIDO: "espera",
  PRESENTADO: "espera",
  DEBITADO: "ok",
  ANULADO: "rechazo",
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
      {vivo && dias < 0 && <Pill fase="rechazo" className="ml-2">Vencido</Pill>}
      {vivo && dias >= 0 && dias <= 7 && <Pill fase="espera" className="ml-2">{dias === 0 ? "Vence hoy" : `Vence en ${dias} d`}</Pill>}
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
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Cifra label="En custodia">
          {enCustodiaTotal.length} cheques
          <span className="mt-0.5 block text-[11px] font-normal text-ink-500">{(["ARS", "USD"] as Moneda[]).filter((m) => totales[m] > 0).map((m) => dinero(m, totales[m])).join(" y ") || "—"}</span>
        </Cifra>
        <Cifra label="Vencen en 7 días" tono={porVencer > 0 ? "malo" : "neutro"}>{porVencer}</Cifra>
        <Cifra label="Propios emitidos">{cheques.filter((c) => c.origen === "PROPIO" && PROPIO_VIGENTE.includes(c.estado)).length} sin debitar</Cifra>
      </div>

      <div className="mb-3 flex gap-1.5" role="tablist">
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
            className={`rounded-md border px-3.5 py-1.5 text-xs font-bold ${pestana === id ? "border-navy-800 bg-navy-800 text-white" : "border-ink-300 bg-white text-ink-600 hover:bg-ink-25"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pestana === "propios" && (
        <PanelVentana className="mb-4" titulo="Numeración por chequera · números usados y disponibles de cada chequera activa">
          <div className="grid gap-2 sm:grid-cols-2">
            {chequeras
              .filter((q) => q.estado === "ACTIVO")
              .map((q) => {
                const n = numeracionDe(q, cheques);
                const tipo = tipos.find((t) => t.id === q.tipoId);
                return (
                  <div key={q.id} className="rounded-md border border-ink-200 px-3 py-2 text-xs">
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
        </PanelVentana>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Campo label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado" className={`${INPUT_COMPACTO} w-40`}>
            <option value="">Todos</option>
            {estados.map((e) => (
              <option key={e} value={e}>{ESTADO_CHEQUE_LABEL[e]}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Forma">
          <select value={forma} onChange={(e) => setForma(e.target.value)} aria-label="Forma" className={`${INPUT_COMPACTO} w-32`}>
            <option value="">Todas</option>
            <option value="FISICO">Físico</option>
            <option value="ECHEQ">E-cheq</option>
          </select>
        </Campo>
        {pestana === "custodia" && (
          <Campo label="Caja">
            <select value={cajaId} onChange={(e) => setCajaId(e.target.value)} aria-label="Caja" className={`${INPUT_COMPACTO} w-56`}>
              <option value="">Todas</option>
              {cajas.filter((c) => c.estado === "ACTIVO").map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Campo>
        )}
        <label className="flex h-8 items-center gap-2 text-xs text-ink-700">
          <input type="checkbox" checked={soloPronto} onChange={(e) => setSoloPronto(e.target.checked)} className="size-3.5" />
          Vencen en 7 días
        </label>
        <div className="ml-auto flex gap-1.5">
          <Button size="xs" variant="navyOutline" onClick={exportar}>
            Exportar a Excel
          </Button>
          {pestana === "custodia" ? (
            <Button size="xs" variant="success" onClick={() => setAccion({ tipo: "recibir" })}>Recibir cheque</Button>
          ) : (
            <Button size="xs" variant="success" onClick={() => setAccion({ tipo: "emitir" })}>Emitir cheque</Button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} />

      <div className="mt-3">
        <TablaCompacta etiqueta={pestana === "custodia" ? "Cheques en custodia" : "Cheques propios"} minWidth="min-w-[58rem]">
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>{pestana === "custodia" ? "Caja" : "Cuenta"}</Th>
              <Th>Cheque</Th>
              <Th>{pestana === "custodia" ? "Librador" : "Beneficiario"}</Th>
              <Th derecha>Importe</Th>
              <Th>Vencimiento</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-5 text-center text-ink-400">
                  No hay cheques con esos filtros.
                </Td>
              </tr>
            )}
            {filas.map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold text-ink-900">{c.id}</Td>
                <Td>{pestana === "custodia" ? cajaNombre(c.cajaId) : cuentaTexto(c.cuentaId)}</Td>
                <Td>
                  {FORMA_CHEQUE_LABEL[c.forma]} · {c.banco} {c.numero}
                  {c.referencia && <span className="block text-[11px] text-ink-400">{c.referencia}</span>}
                </Td>
                <Td>{c.parte}</Td>
                <Td derecha className="text-ink-900">{dinero(c.moneda, c.importe)}</Td>
                <Td>
                  <Vencimiento cheque={c} />
                </Td>
                <Td>
                  <Pill fase={FASE_ESTADO[c.estado]}>{ESTADO_CHEQUE_LABEL[c.estado]}</Pill>
                  {c.origen === "PROPIO" && PROPIO_VIGENTE.includes(c.estado) && <span className="mt-0.5 block text-[11px] text-ink-400">Importe reservado</span>}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {c.origen === "TERCERO" && c.estado === "EN_CUSTODIA" && (
                      <>
                        <Button size="xs" variant="successOutline" disabled={!puedeOperar(c)} title={puedeOperar(c) ? undefined : "Sólo un responsable de la caja"} onClick={() => setAccion({ tipo: "depositar", cheque: c })}>
                          Depositar
                        </Button>
                        <Button size="xs" variant="brandOutline" disabled={!puedeOperar(c)} onClick={() => setAccion({ tipo: "entregar", cheque: c })}>
                          Entregar
                        </Button>
                      </>
                    )}
                    {c.origen === "TERCERO" && (c.estado === "EN_CUSTODIA" || c.estado === "DEPOSITADO") && (
                      <Button size="xs" variant="dangerOutline" disabled={!puedeOperar(c)} onClick={() => setAccion({ tipo: "rechazar", cheque: c })}>
                        Rechazar
                      </Button>
                    )}
                    {c.origen === "PROPIO" && c.estado === "EMITIDO" && (
                      <>
                        <Button size="xs" variant="successOutline" disabled={!puedePropios} title={puedePropios ? undefined : "Sólo Tesorero, Tesorero central o Supervisor"} onClick={() => setAccion({ tipo: "entregar-propio", cheque: c })}>
                          Entregar
                        </Button>
                        <Button size="xs" variant="dangerOutline" disabled={!puedePropios} onClick={() => setAccion({ tipo: "anular", cheque: c })}>
                          Anular
                        </Button>
                      </>
                    )}
                    {c.origen === "PROPIO" && c.estado === "ENTREGADO" && (
                      <Button size="xs" variant="brandOutline" disabled={!puedePropios} title="El beneficiario lo presentó al cobro" onClick={() => correr(presentarChequePropio(c.id))}>
                        Presentado
                      </Button>
                    )}
                    {c.origen === "PROPIO" && c.estado === "PRESENTADO" && (
                      <>
                        <Button size="xs" variant="successOutline" disabled={!puedePropios} title="Debitado en el extracto: baja el saldo real" onClick={() => correr(debitarChequePropio(c.id))}>
                          Debitado
                        </Button>
                        <Button size="xs" variant="dangerOutline" disabled={!puedePropios} onClick={() => setAccion({ tipo: "rechazar-propio", cheque: c })}>
                          Rechazado por el banco
                        </Button>
                      </>
                    )}
                    <Button size="xs" variant="navyOutline" onClick={() => setAccion({ tipo: "traza", cheque: c })}>
                      Historial
                    </Button>
                  </div>
                  <span className="mt-1 block text-[11px] text-ink-400">Alta: {c.usuarioAlta} · {c.fechaAlta}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TablaCompacta>
      </div>

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