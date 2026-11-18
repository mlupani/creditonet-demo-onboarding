"use client";

import { useState } from "react";
import { useCuentasBancarias } from "@/lib/caja-store";
import {
  bancoTexto,
  cargarBoletaDeposito,
  crearMovimiento,
  crearPedidoRefuerzo,
  enviarMovimiento,
  errorNuevoMovimiento,
  nombreCaja,
  recibirMovimiento,
  resolverIncidenciaMovimiento,
  resolverPedidoRefuerzo,
  type NuevoMovimiento,
} from "@/lib/caja-operaciones";
import { disponibleParaAutorizar, totalRecuento } from "@/lib/caja-reglas";
import { nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import {
  ESTADOS_MOVIMIENTO,
  TIPO_CAJA_LABEL,
  esTesoro,
  monedasDe,
  type DetalleRecuento,
  type Moneda,
  type MovimientoTesoreria,
  type PedidoRefuerzo,
} from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { aError } from "./Jornada";
import { RecuentoForm } from "./RecuentoForm";
import { ErrorBanner, cajasPropias, dinero } from "./comunes";

const Pie = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <Button variant="outline" onClick={onClose}>
      Cancelar
    </Button>
    {children}
  </div>
);

export const destinoTexto = (m: MovimientoTesoreria) =>
  m.destino.tipo === "CAJA" ? nombreCaja(m.destino.cajaId) : bancoTexto(m.destino.cuentaId);

export const estadoTexto = (m: MovimientoTesoreria) =>
  m.estado === "ACEPTADO" && m.destino.tipo === "BANCO" ? "Depositado" : (ESTADOS_MOVIMIENTO.find((e) => e.id === m.estado)?.label ?? m.estado);

export function NuevoMovimientoModal({ cajaInicial, onClose }: { cajaInicial: string; onClose: () => void }) {
  const { cajas, tipos, usuario, libro, movimientos } = useCajaDatos();
  const propias = cajasPropias(cajas, usuario);
  const tiposActivos = tipos.filter((t) => t.estado === "ACTIVO" && !t.descripcion.startsWith("Pedido"));
  const [tipoId, setTipoId] = useState(tiposActivos[0]?.id ?? "");
  const [origenId, setOrigenId] = useState(propias.some((c) => c.id === cajaInicial) ? cajaInicial : (propias[0]?.id ?? ""));
  const [haciaBanco, setHaciaBanco] = useState(false);
  const [destinoId, setDestinoId] = useState("");
  const cuentas = useCuentasBancarias().filter((c) => c.estado === "ACTIVO");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [importe, setImporte] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [tipoTransp, setTipoTransp] = useState<"EMPLEADO" | "EMPRESA">("EMPLEADO");
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [precinto, setPrecinto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tipo = tiposActivos.find((t) => t.id === tipoId);
  const origen = cajas.find((c) => c.id === origenId);
  const bancoPosible = !!tipo?.destinos.includes("BANCO");
  const banco = bancoPosible && (haciaBanco || !tipo?.destinos.some((d) => d !== "BANCO"));
  const destinosCaja = cajas.filter((c) => c.estado === "ACTIVO" && c.id !== origenId && tipo?.destinos.includes(c.tipo));
  const destinoElegido = destinosCaja.some((c) => c.id === destinoId) ? destinoId : (destinosCaja[0]?.id ?? "");
  const monedas = origen ? monedasDe(origen.moneda) : (["ARS"] as Moneda[]);
  const monedaElegida = monedas.includes(moneda) ? moneda : monedas[0];
  const cuentasMoneda = cuentas.filter((c) => c.moneda === monedaElegida);
  const cuentaElegida = cuentasMoneda.some((c) => c.id === cuentaId) ? cuentaId : (cuentasMoneda[0]?.id ?? "");

  const nuevo: NuevoMovimiento = {
    tipoId,
    origenId,
    destino: banco ? { tipo: "BANCO", cuentaId: cuentaElegida } : { tipo: "CAJA", cajaId: destinoElegido },
    moneda: monedaElegida,
    importe,
    motivo,
    transportista: { tipo: tipoTransp, nombre, documento },
    precinto,
    observaciones,
  };
  const vivo = importe > 0 || motivo ? errorNuevoMovimiento(nuevo) : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo movimiento de tesorería"
      maxWidth="max-w-2xl"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const r = crearMovimiento(nuevo);
              if (r.ok) onClose();
              else setError(r.error);
            }}
          >
            Solicitar movimiento
          </Button>
        </Pie>
      }
    >
      {propias.length === 0 ? (
        <Banner tone="info">Sólo un responsable de una caja puede cargar movimientos. Cambiá el usuario en «Actuar como».</Banner>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="mt-tipo" label="Tipo de movimiento" required value={tipoId} onChange={setTipoId} options={tiposActivos.map((t) => ({ value: t.id, label: t.descripcion }))} hint={tipo?.requiereAutorizacion ? "Requiere autorización de un supervisor." : "No requiere autorización."} />
          <SelectField id="mt-origen" label="Origen" required value={origenId} onChange={setOrigenId} options={propias.map((c) => ({ value: c.id, label: `${c.nombre} · ${TIPO_CAJA_LABEL[c.tipo]}` }))} />
          {bancoPosible && tipo?.destinos.some((d) => d !== "BANCO") && (
            <SelectField id="mt-punta" label="Destino" value={haciaBanco ? "banco" : "caja"} onChange={(v) => setHaciaBanco(v === "banco")} options={[{ value: "caja", label: "Tesoro o caja" }, { value: "banco", label: "Banco" }]} />
          )}
          {banco ? (
            <SelectField id="mt-cuenta" label="Cuenta bancaria de destino" required value={cuentaElegida} onChange={setCuentaId} options={cuentasMoneda.map((c) => ({ value: c.id, label: `${c.banco} · ${c.numero}` }))} placeholder="Sin cuentas en esa moneda" />
          ) : (
            <SelectField id="mt-destino" label="Destino" required value={destinoElegido} onChange={setDestinoId} options={destinosCaja.map((c) => ({ value: c.id, label: `${c.nombre} · ${TIPO_CAJA_LABEL[c.tipo]}` }))} placeholder="Sin destinos para este tipo" />
          )}
          <SelectField id="mt-moneda" label="Moneda" required value={monedaElegida} onChange={(v) => setMoneda(v as Moneda)} options={monedas.map((m) => ({ value: m, label: m === "ARS" ? "Pesos" : "Dólares" }))} />
          <MoneyInput
            id="mt-importe"
            label="Importe"
            required
            value={importe}
            onChange={setImporte}
            hint={
              origen
                ? `Disponible en ${origen.nombre}: ${dinero(monedaElegida, Math.max(0, disponibleParaAutorizar(libro, movimientos, origen, monedaElegida)))} (saldo menos lo reservado y el mínimo operativo).`
                : undefined
            }
          />
          <FormField id="mt-motivo" label="Motivo" required value={motivo} onChange={setMotivo} className="sm:col-span-2" />
          <SelectField id="mt-transp" label="Responsable del traslado" value={tipoTransp} onChange={(v) => setTipoTransp(v as "EMPLEADO" | "EMPRESA")} options={[{ value: "EMPLEADO", label: "Empleado" }, { value: "EMPRESA", label: "Empresa transportadora" }]} />
          <FormField id="mt-nombre" label="Nombre" value={nombre} onChange={setNombre} />
          <FormField id="mt-doc" label="Documento" value={documento} onChange={setDocumento} />
          <FormField id="mt-precinto" label="Precinto, sobre o boleta" value={precinto} onChange={setPrecinto} />
          <FormField id="mt-obs" label="Observaciones" value={observaciones} onChange={setObservaciones} className="sm:col-span-2" />
        </div>
      )}
      {vivo && <Banner tone="warning" className="mt-4">{vivo}</Banner>}
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function PedidoModal({ cajaId, onClose }: { cajaId: string; onClose: () => void }) {
  const { cajas, usuario } = useCajaDatos();
  const propias = cajasPropias(cajas, usuario);
  const [solicitante, setSolicitante] = useState(propias.some((c) => c.id === cajaId) ? cajaId : (propias[0]?.id ?? ""));
  const tesoros = cajas.filter((c) => c.estado === "ACTIVO" && esTesoro(c.tipo) && c.id !== solicitante);
  const [a, setA] = useState("");
  const aElegido = tesoros.some((c) => c.id === a) ? a : (tesoros[0]?.id ?? "");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [importe, setImporte] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo pedido de refuerzo"
      maxWidth="max-w-lg"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const r = crearPedidoRefuerzo({ solicitanteCajaId: solicitante, aCajaId: aElegido, moneda, importe, motivo });
              if (r.ok) onClose();
              else setError(r.error);
            }}
          >
            Enviar pedido
          </Button>
        </Pie>
      }
    >
      <p className="mb-4 text-sm text-ink-600">El pedido no mueve dinero: el tesoro lo aprueba total o parcialmente, o lo rechaza, y recién ahí se genera el envío.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="pr-sol" label="Caja que pide" required value={solicitante} onChange={setSolicitante} options={propias.map((c) => ({ value: c.id, label: c.nombre }))} />
        <SelectField id="pr-a" label="Se pide a" required value={aElegido} onChange={setA} options={tesoros.map((c) => ({ value: c.id, label: c.nombre }))} />
        <SelectField id="pr-moneda" label="Moneda" required value={moneda} onChange={(v) => setMoneda(v as Moneda)} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
        <MoneyInput id="pr-importe" label="Importe" required value={importe} onChange={setImporte} />
        <FormField id="pr-motivo" label="Motivo" required value={motivo} onChange={setMotivo} className="sm:col-span-2" />
      </div>
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function ResolverPedidoModal({ pedido, onClose }: { pedido: PedidoRefuerzo; onClose: () => void }) {
  const [importe, setImporte] = useState(pedido.importe);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolver = (aprobar: boolean) => {
    const e = aError(resolverPedidoRefuerzo(pedido.id, aprobar, importe, nota));
    if (e) setError(e);
    else onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Pedido ${pedido.id}`}
      maxWidth="max-w-md"
      footer={
        <Pie onClose={onClose}>
          <Button variant="danger" onClick={() => resolver(false)}>
            Rechazar
          </Button>
          <Button variant="success" onClick={() => resolver(true)}>
            {importe < pedido.importe ? "Aprobar parcialmente" : "Aprobar total"}
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        {nombreCaja(pedido.solicitanteCajaId)} pide {dinero(pedido.moneda, pedido.importe)}: {pedido.motivo}
      </p>
      <MoneyInput id="rp-importe" label="Importe a aprobar" value={importe} onChange={setImporte} hint="Menor al pedido = aprobación parcial." />
      <FormField id="rp-nota" label="Motivo (obligatorio si rechazás)" value={nota} onChange={setNota} className="mt-3" />
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function EnviarModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const { denominaciones } = useCajaDatos();
  const [detalle, setDetalle] = useState<DetalleRecuento>({});
  const [conformidad, setConformidad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contado = totalRecuento(detalle, denominaciones)[mov.moneda];
  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar el envío de ${mov.id}`}
      maxWidth="max-w-3xl"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const e = aError(enviarMovimiento(mov.id, detalle, conformidad));
              if (e) setError(e);
              else onClose();
            }}
          >
            Confirmar envío
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        Importe a entregar: <strong>{dinero(mov.moneda, mov.importe)}</strong> a {destinoTexto(mov)}. Al confirmar pasa a «En tránsito»: deja de figurar en el origen y todavía no figura en el destino.
      </p>
      <RecuentoForm monedas={[mov.moneda]} detalle={detalle} onChange={setDetalle} ayuda={{ [mov.moneda]: mov.importe }} />
      <p className={`mt-2 text-sm ${contado === mov.importe ? "text-success-700" : "text-ink-500"}`}>
        Contado {dinero(mov.moneda, contado)} de {dinero(mov.moneda, mov.importe)}.
      </p>
      <div className="mt-3">
        <Checkbox checked={conformidad} onChange={setConformidad} label="Conformidad de quien entrega" description="El origen confirma lo que entrega al transportista." />
      </div>
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function RecibirModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const [detalle, setDetalle] = useState<DetalleRecuento>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Recibir ${mov.id}`}
      maxWidth="max-w-3xl"
      footer={
        aviso ? (
          <Button onClick={onClose}>Entendido</Button>
        ) : (
          <Pie onClose={onClose}>
            <Button
              onClick={() => {
                const r = recibirMovimiento(mov.id, detalle);
                if (!r.ok) setError(r.error);
                else if (r.estado === "CON_INCIDENCIA") setAviso(true);
                else onClose();
              }}
            >
              Contar y aceptar
            </Button>
          </Pie>
        )
      }
    >
      {aviso ? (
        <Banner tone="warning" title="El recuento no coincide">
          El movimiento quedó «Con incidencia»: el dinero no se integra a la caja hasta que un supervisor resuelva.
        </Banner>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-600">
            {nombreCaja(mov.origenId)} envió el movimiento. Abrilo, contá por denominación y aceptá. Si no coincide, se carga la diferencia y queda con incidencia.
          </p>
          <RecuentoForm monedas={[mov.moneda]} detalle={detalle} onChange={setDetalle} ayuda={{ [mov.moneda]: mov.importe }} />
        </>
      )}
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function ResolverIncidenciaModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const [importe, setImporte] = useState(mov.recepcion?.importe ?? 0);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Resolver la incidencia de ${mov.id}`}
      maxWidth="max-w-md"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const e = aError(resolverIncidenciaMovimiento(mov.id, importe, nota));
              if (e) setError(e);
              else onClose();
            }}
          >
            Resolver
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        Enviado {dinero(mov.moneda, mov.importe)} · contado por {nombreUsuario(mov.recepcion?.usuarioId ?? "")}: {dinero(mov.moneda, mov.recepcion?.importe ?? 0)}.
      </p>
      <MoneyInput id="ri-importe" label="Importe a integrar a la caja destino" value={importe} onChange={setImporte} />
      <FormField id="ri-nota" label="Resolución" required value={nota} onChange={setNota} className="mt-3" />
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function BoletaModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const [boleta, setBoleta] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Boleta de depósito de ${mov.id}`}
      maxWidth="max-w-md"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const e = aError(cargarBoletaDeposito(mov.id, boleta));
              if (e) setError(e);
              else onClose();
            }}
          >
            Confirmar depósito
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        {dinero(mov.moneda, mov.importe)} a {destinoTexto(mov)}. El movimiento queda en tránsito hasta cargar la boleta (o conciliar la acreditación en Bancos).
      </p>
      <FormField id="bo-numero" label="Número de boleta de depósito" required value={boleta} onChange={setBoleta} />
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function DetalleMovimientoModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const hitos: [string, string][] = [
    ["Solicitud", `${nombreUsuario(mov.solicitanteId)} · ${mov.fechaSolicitud}`],
  ];
  if (mov.autorizacion)
    hitos.push([mov.autorizacion.resultado === "APROBADA" ? "Autorización" : "Rechazo", `${nombreUsuario(mov.autorizacion.supervisorId)} · ${mov.autorizacion.fechaHora}${mov.autorizacion.nota ? ` · ${mov.autorizacion.nota}` : ""}`]);
  if (mov.envio) hitos.push(["Envío", `${nombreUsuario(mov.envio.usuarioId)} · ${mov.envio.fechaHora} · ${dinero(mov.moneda, mov.envio.importe)}${mov.envio.conformidad ? " · conformidad del origen" : ""}`]);
  if (mov.recepcion) hitos.push(["Recepción", `${nombreUsuario(mov.recepcion.usuarioId)} · ${mov.recepcion.fechaHora} · contó ${dinero(mov.moneda, mov.recepcion.importe)}`]);
  if (mov.resolucion) hitos.push(["Resolución de incidencia", `${nombreUsuario(mov.resolucion.supervisorId)} · ${mov.resolucion.fechaHora} · integró ${dinero(mov.moneda, mov.resolucion.importeAceptado)} · ${mov.resolucion.nota}`]);
  if (mov.boletaDeposito) hitos.push(["Boleta de depósito", mov.boletaDeposito]);
  return (
    <Modal open onClose={onClose} title={`Movimiento ${mov.id}`} maxWidth="max-w-xl" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-sm">
        {[
          ["Estado", estadoTexto(mov)],
          ["Origen", nombreCaja(mov.origenId)],
          ["Destino", destinoTexto(mov)],
          ["Importe", dinero(mov.moneda, mov.importe)],
          ["Motivo", mov.motivo],
          ["Traslado", mov.transportista ? `${mov.transportista.tipo === "EMPRESA" ? "Empresa" : "Empleado"}: ${mov.transportista.nombre} (${mov.transportista.documento})` : "—"],
          ["Precinto o comprobante", mov.precinto || "—"],
          ["Observaciones", mov.observaciones || "—"],
        ].map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-500">{k}</dt>
            <dd className="text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest text-ink-700">Línea de tiempo</h3>
      <ol className="space-y-2 border-l-2 border-brand-200 pl-4">
        {hitos.map(([k, v]) => (
          <li key={k} className="text-sm">
            <p className="font-semibold text-ink-900">{k}</p>
            <p className="text-ink-600">{v}</p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
