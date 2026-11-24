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
  finalizarMovimiento,
  nombreCaja,
  origenTexto,
  posicionDeCaja,
  posicionDeCuenta,
  recibirMovimiento,
  registrarExtraccion,
  resolverIncidenciaMovimiento,
  resolverPedidoRefuerzo,
  type NuevoMovimiento,
} from "@/lib/caja-operaciones";
import { TIPO_PEDIDO_TESORO_ID, TIPO_RESTITUCION_ID } from "@/lib/caja-datos";
import { totalRecuento } from "@/lib/caja-reglas";
import { nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import { firmar } from "@/lib/llave";
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
import { LlaveCampos } from "./LlaveCampos";

const Pie = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <Button variant="outline" onClick={onClose}>
      Cancelar
    </Button>
    {children}
  </div>
);

// Llave de autorización (R6) del usuario que está actuando: los campos de clave y código y la firma con la que se
// respalda la operación. Devuelve el id de la firma registrada o el error para mostrar.
function useLlave() {
  const { usuario } = useCajaDatos();
  const [clave, setClave] = useState("");
  const [codigo, setCodigo] = useState("");
  const campos = <LlaveCampos usuarioId={usuario.id} clave={clave} codigo={codigo} onClave={setClave} onCodigo={setCodigo} />;
  const firmarCon = (datos: { operacion: string; referencia: string; importe?: number; moneda?: Moneda; cargadoPor?: string }): { firmaId: string } | { error: string } => {
    const r = firmar({ usuarioId: usuario.id, clave, codigo, ...datos });
    return r.ok ? { firmaId: r.firma.id } : { error: r.error };
  };
  return { campos, firmarCon };
}

export const destinoTexto = (m: MovimientoTesoreria) =>
  m.destino.tipo === "CAJA" ? nombreCaja(m.destino.cajaId) : bancoTexto(m.destino.cuentaId);

export const estadoTexto = (m: MovimientoTesoreria) => {
  const label = ESTADOS_MOVIMIENTO.find((e) => e.id === m.estado)?.label ?? m.estado;
  return m.destino.tipo === "BANCO" && (m.estado === "ACEPTADO" || m.estado === "FINALIZADO") ? `${label} · depositado` : label;
};

export function NuevoMovimientoModal({ cajaInicial, onClose }: { cajaInicial: string; onClose: () => void }) {
  const { cajas, tipos, usuario } = useCajaDatos();
  const propias = cajasPropias(cajas, usuario);
  // El pedido a otro tesoro tiene su propia pantalla; el pedido a banco sí se carga acá.
  const tiposActivos = tipos.filter((t) => t.estado === "ACTIVO" && t.id !== TIPO_PEDIDO_TESORO_ID);
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
  const [rendDetalle, setRendDetalle] = useState("");
  const [rendComprobantes, setRendComprobantes] = useState("");
  const [rendImporte, setRendImporte] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tipo = tiposActivos.find((t) => t.id === tipoId);
  const pedidoABanco = !!tipo?.origenBanco;
  const esRestitucion = tipo?.id === TIPO_RESTITUCION_ID;
  // En un pedido a banco el origen es la cuenta y el tesoro propio es quien recibe: se elige entre los tesoros del usuario.
  const origenesPosibles = pedidoABanco ? propias.filter((c) => tipo?.destinos.includes(c.tipo)) : propias;
  const origenSel = origenesPosibles.some((c) => c.id === origenId) ? origenId : (origenesPosibles[0]?.id ?? "");
  const origen = cajas.find((c) => c.id === origenSel);
  const bancoPosible = !pedidoABanco && !!tipo?.destinos.includes("BANCO");
  const banco = bancoPosible && (haciaBanco || !tipo?.destinos.some((d) => d !== "BANCO"));
  const destinosCaja = cajas.filter((c) => c.estado === "ACTIVO" && c.id !== origenSel && tipo?.destinos.includes(c.tipo));
  const destinoElegido = destinosCaja.some((c) => c.id === destinoId) ? destinoId : (destinosCaja[0]?.id ?? "");
  const monedas = origen ? monedasDe(origen.moneda) : (["ARS"] as Moneda[]);
  const monedaElegida = monedas.includes(moneda) ? moneda : monedas[0];
  const cuentasMoneda = cuentas.filter((c) => c.moneda === monedaElegida);
  const cuentaElegida = cuentasMoneda.some((c) => c.id === cuentaId) ? cuentaId : (cuentasMoneda[0]?.id ?? "");

  const nuevo: NuevoMovimiento = {
    tipoId,
    origenId: origenSel,
    destino: pedidoABanco ? { tipo: "CAJA", cajaId: origenSel } : banco ? { tipo: "BANCO", cuentaId: cuentaElegida } : { tipo: "CAJA", cajaId: destinoElegido },
    ...(pedidoABanco ? { origenBancoId: cuentaElegida } : {}),
    ...(esRestitucion ? { rendicion: { detalle: rendDetalle, comprobantes: Number(rendComprobantes) || 0, importe: rendImporte } } : {}),
    moneda: monedaElegida,
    importe,
    motivo,
    transportista: { tipo: tipoTransp, nombre, documento },
    precinto,
    observaciones,
  };
  const estimadoOrigen = pedidoABanco ? posicionDeCuenta(cuentaElegida).estimado : origen ? posicionDeCaja(origen.id, monedaElegida).estimado : 0;
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
          <SelectField
            id="mt-origen"
            label={pedidoABanco ? "Tesoro que recibe los fondos" : "Origen"}
            required
            value={origenSel}
            onChange={setOrigenId}
            options={origenesPosibles.map((c) => ({ value: c.id, label: `${c.nombre} · ${TIPO_CAJA_LABEL[c.tipo]}` }))}
            placeholder={pedidoABanco ? "No sos responsable de un tesoro" : undefined}
          />
          {bancoPosible && tipo?.destinos.some((d) => d !== "BANCO") && (
            <SelectField id="mt-punta" label="Destino" value={haciaBanco ? "banco" : "caja"} onChange={(v) => setHaciaBanco(v === "banco")} options={[{ value: "caja", label: "Tesoro o caja" }, { value: "banco", label: "Banco" }]} />
          )}
          {pedidoABanco ? (
            <SelectField id="mt-cuenta-origen" label="Cuenta bancaria de origen" required value={cuentaElegida} onChange={setCuentaId} options={cuentasMoneda.map((c) => ({ value: c.id, label: `${c.banco} · ${c.numero}` }))} placeholder="Sin cuentas en esa moneda" />
          ) : banco ? (
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
              pedidoABanco
                ? `Estimado de la cuenta: ${dinero(monedaElegida, Math.max(0, estimadoOrigen))} (real menos lo ya comprometido).`
                : origen
                  ? `Estimado de ${origen.nombre}: ${dinero(monedaElegida, Math.max(0, estimadoOrigen))} (real menos lo ya reservado y comprometido).`
                  : undefined
            }
          />
          <FormField id="mt-motivo" label="Motivo" required value={motivo} onChange={setMotivo} className="sm:col-span-2" />
          {esRestitucion && (
            <>
              <FormField id="mt-rend-detalle" label="Rendición de gastos del fondo fijo" required value={rendDetalle} onChange={setRendDetalle} placeholder="Ej.: limpieza, librería, mensajería" className="sm:col-span-2" />
              <FormField id="mt-rend-comp" label="Comprobantes adjuntos" required value={rendComprobantes} onChange={(v) => setRendComprobantes(v.replace(/\D/g, ""))} inputMode="numeric" hint="Cantidad de comprobantes de la rendición (adjunto simulado)." />
              <MoneyInput id="mt-rend-importe" label="Importe rendido" required value={rendImporte} onChange={setRendImporte} hint="La restitución es por el importe de los gastos rendidos." />
            </>
          )}
          <SelectField id="mt-transp" label={pedidoABanco ? "Responsable de la extracción" : "Responsable del traslado"} value={tipoTransp} onChange={(v) => setTipoTransp(v as "EMPLEADO" | "EMPRESA")} options={[{ value: "EMPLEADO", label: "Empleado" }, { value: "EMPRESA", label: "Empresa transportadora" }]} />
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
      <p className="mb-3 text-xs text-ink-600">El pedido no mueve dinero: el tesoro lo aprueba total o parcialmente, o lo rechaza, y recién ahí se genera el envío.</p>
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
  const llave = useLlave();
  const resolver = (aprobar: boolean) => {
    // Aprobar el pedido se firma con la llave de autorización; rechazarlo sólo pide el motivo.
    let firmaId: string | undefined;
    if (aprobar) {
      const f = llave.firmarCon({ operacion: "Aprobación de pedido de refuerzo", referencia: pedido.id, importe, moneda: pedido.moneda, cargadoPor: pedido.usuarioId });
      if ("error" in f) return setError(f.error);
      firmaId = f.firmaId;
    }
    const e = aError(resolverPedidoRefuerzo(pedido.id, aprobar, importe, nota, firmaId));
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
      <p className="mb-3 text-xs text-ink-600">
        {nombreCaja(pedido.solicitanteCajaId)} pide {dinero(pedido.moneda, pedido.importe)}: {pedido.motivo}
      </p>
      <MoneyInput id="rp-importe" label="Importe a aprobar" value={importe} onChange={setImporte} hint="Menor al pedido = aprobación parcial." />
      <FormField id="rp-nota" label="Motivo (obligatorio si rechazás)" value={nota} onChange={setNota} className="mt-3" />
      {llave.campos}
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function EnviarModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const { denominaciones } = useCajaDatos();
  const [detalle, setDetalle] = useState<DetalleRecuento>({});
  const [conformidad, setConformidad] = useState(false);
  const [portador, setPortador] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const llave = useLlave();
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
              // Acta de entrega al portador: firma con llave de quien entrega y conformidad del portador.
              const f = llave.firmarCon({ operacion: "Acta de entrega de remesa al portador", referencia: mov.id, importe: mov.importe, moneda: mov.moneda });
              if ("error" in f) return setError(f.error);
              const e = aError(enviarMovimiento(mov.id, detalle, conformidad, { firmaId: f.firmaId, portadorConforme: portador }));
              if (e) setError(e);
              else onClose();
            }}
          >
            Confirmar envío
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-xs text-ink-600">
        Importe a entregar: <strong>{dinero(mov.moneda, mov.importe)}</strong> a {destinoTexto(mov)}. Al confirmar pasa a «En tránsito»: deja de figurar en el origen y todavía no figura en el destino.
      </p>
      <RecuentoForm monedas={[mov.moneda]} detalle={detalle} onChange={setDetalle} ayuda={{ [mov.moneda]: mov.importe }} />
      <p className={`mt-2 text-xs ${contado === mov.importe ? "text-success-700" : "text-ink-500"}`}>
        Contado {dinero(mov.moneda, contado)} de {dinero(mov.moneda, mov.importe)}.
      </p>
      <div className="mt-3">
        <Checkbox checked={conformidad} onChange={setConformidad} label="Conformidad de quien entrega" description="El origen confirma lo que entrega al transportista." />
      </div>
      <div className="mt-2">
        <Checkbox
          checked={portador}
          onChange={setPortador}
          label="El portador recibe y firma el acta"
          description={mov.transportista ? `${mov.transportista.nombre} (${mov.transportista.documento}) recibe ${dinero(mov.moneda, mov.importe)} sellado.` : "El portador recibe el efectivo."}
        />
      </div>
      <p className="mt-3 text-xs text-ink-500">Acta de entrega y recepción: firmás con tu llave de autorización (usuario, clave y código temporal).</p>
      {llave.campos}
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function RecibirModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const [detalle, setDetalle] = useState<DetalleRecuento>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  const llave = useLlave();
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
                // Acta de recepción: quien recibe cuenta y firma con su llave.
                const f = llave.firmarCon({ operacion: "Acta de recepción de remesa", referencia: mov.id, importe: mov.importe, moneda: mov.moneda });
                if ("error" in f) return setError(f.error);
                const r = recibirMovimiento(mov.id, detalle, f.firmaId);
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
          <p className="mb-3 text-xs text-ink-600">
            {origenTexto(mov)} {mov.origenBancoId ? "entregó los fondos extraídos" : "envió el movimiento"}. Abrilo, contá por denominación y aceptá. Si no coincide, se carga la diferencia y queda con incidencia.
          </p>
          <RecuentoForm monedas={[mov.moneda]} detalle={detalle} onChange={setDetalle} ayuda={{ [mov.moneda]: mov.importe }} />
          <p className="mt-3 text-xs text-ink-500">Acta de recepción: firmás con tu llave de autorización (usuario, clave y código temporal).</p>
          {llave.campos}
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
      <p className="mb-3 text-xs text-ink-600">
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
      <p className="mb-3 text-xs text-ink-600">
        {dinero(mov.moneda, mov.importe)} a {destinoTexto(mov)}. El movimiento queda en tránsito hasta cargar la boleta (o conciliar la acreditación en Bancos).
      </p>
      <FormField id="bo-numero" label="Número de boleta de depósito" required value={boleta} onChange={setBoleta} />
      <ErrorBanner error={error} />
    </Modal>
  );
}

// Pedido de refuerzo a banco: alguien extrae los fondos y se carga la boleta de extracción. Recién entonces el
// importe sale de la cuenta (baja el real y se consume la reserva) y queda en tránsito hacia el tesoro.
export function ExtraccionModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const [boleta, setBoleta] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Boleta de extracción de ${mov.id}`}
      maxWidth="max-w-md"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const e = aError(registrarExtraccion(mov.id, boleta));
              if (e) setError(e);
              else onClose();
            }}
          >
            Confirmar extracción
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-xs text-ink-600">
        {dinero(mov.moneda, mov.importe)} de {origenTexto(mov)} para {destinoTexto(mov)}. Al cargar la boleta el importe sale de la cuenta y queda en tránsito hasta que el tesoro lo cuente y acepte.
      </p>
      <FormField id="ex-boleta" label="Número de boleta de extracción" required value={boleta} onChange={setBoleta} />
      <ErrorBanner error={error} />
    </Modal>
  );
}

// Un movimiento aceptado se cierra con su documento: el acta de recepción o la boleta de depósito o de extracción.
export function DocumentarModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const [documento, setDocumento] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Documentar ${mov.id}`}
      maxWidth="max-w-md"
      footer={
        <Pie onClose={onClose}>
          <Button
            onClick={() => {
              const e = aError(finalizarMovimiento(mov.id, documento));
              if (e) setError(e);
              else onClose();
            }}
          >
            Finalizar movimiento
          </Button>
        </Pie>
      }
    >
      <p className="mb-3 text-xs text-ink-600">
        El destino ya aceptó {dinero(mov.moneda, mov.importe)}. Para finalizarlo cargá el número de acta (o de boleta de depósito o de extracción) que lo documenta: pasa al histórico y no se modifica más.
      </p>
      <FormField id="doc-numero" label="Número de acta o de boleta" required value={documento} onChange={setDocumento} />
      <ErrorBanner error={error} />
    </Modal>
  );
}

export function DetalleMovimientoModal({ mov, onClose }: { mov: MovimientoTesoreria; onClose: () => void }) {
  const hitos: [string, string][] = [
    ["Solicitud", `${nombreUsuario(mov.solicitanteId)} · ${mov.fechaSolicitud}`],
  ];
  if (mov.autorizacion)
    hitos.push([mov.autorizacion.resultado === "APROBADA" ? "Autorización" : "Rechazo", `${nombreUsuario(mov.autorizacion.supervisorId)} · ${mov.autorizacion.fechaHora}${mov.autorizacion.firmaId ? ` · firma ${mov.autorizacion.firmaId}` : ""}${mov.autorizacion.nota ? ` · ${mov.autorizacion.nota}` : ""}`]);
  if (mov.extraccion) hitos.push(["Extracción del banco", `${nombreUsuario(mov.extraccion.usuarioId)} · ${mov.extraccion.fechaHora} · ${dinero(mov.moneda, mov.extraccion.importe)} · boleta ${mov.extraccion.boleta}`]);
  if (mov.envio)
    hitos.push([
      "Envío",
      `${nombreUsuario(mov.envio.usuarioId)} · ${mov.envio.fechaHora} · ${dinero(mov.moneda, mov.envio.importe)}${mov.envio.conformidad ? " · conformidad del origen" : ""}${mov.envio.portadorConforme ? " · conformidad del portador" : ""}${mov.envio.firmaId ? ` · acta de entrega, firma ${mov.envio.firmaId}` : ""}`,
    ]);
  if (mov.recepcion) hitos.push(["Recepción", `${nombreUsuario(mov.recepcion.usuarioId)} · ${mov.recepcion.fechaHora} · contó ${dinero(mov.moneda, mov.recepcion.importe)}${mov.recepcion.firmaId ? ` · acta de recepción, firma ${mov.recepcion.firmaId}` : ""}`]);
  if (mov.resolucion) hitos.push(["Resolución de incidencia", `${nombreUsuario(mov.resolucion.supervisorId)} · ${mov.resolucion.fechaHora} · integró ${dinero(mov.moneda, mov.resolucion.importeAceptado)} · ${mov.resolucion.nota}`]);
  if (mov.boletaDeposito) hitos.push(["Boleta de depósito", mov.boletaDeposito]);
  if (mov.finalizacion) hitos.push(["Finalizado", `${nombreUsuario(mov.finalizacion.usuarioId)} · ${mov.finalizacion.fechaHora} · ${mov.finalizacion.documento}`]);
  return (
    <Modal open onClose={onClose} title={`Movimiento ${mov.id}`} maxWidth="max-w-xl" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-xs">
        {[
          ["Estado", estadoTexto(mov)],
          ["Origen", origenTexto(mov)],
          ["Destino", destinoTexto(mov)],
          ["Importe", dinero(mov.moneda, mov.importe)],
          ["Motivo", mov.motivo],
          ...(mov.rendicion ? [["Rendición de gastos", `${mov.rendicion.detalle} · ${mov.rendicion.comprobantes} comprobantes · ${dinero(mov.moneda, mov.rendicion.importe)}`]] : []),
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
          <li key={k} className="text-xs">
            <p className="font-semibold text-ink-900">{k}</p>
            <p className="text-ink-600">{v}</p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
