// Stores del módulo Caja y Bancos. Todo vive en el front: cada lista se persiste en la sesión del
// navegador (crearStoreAbm) y se hidrata junto con el resto de la demo. "Reiniciar demo" la restablece.

import { crearStoreAbm } from "./store-abm";
import {
  ACUERDOS_INICIALES,
  CAJAS_INICIALES,
  CHEQUERAS_INICIALES,
  CHEQUES_INICIALES,
  TIPOS_CHEQUERA_INICIALES,
  CUENTAS_BANCARIAS_INICIALES,
  DENOMINACIONES_INICIALES,
  FERIADOS_INICIALES,
  HORA_DEMO_INICIAL,
  LIBRO_INICIAL,
  MOTIVOS_DIFERENCIA_INICIALES,
  MOVIMIENTOS_TESORERIA_INICIALES,
  PEDIDOS_REFUERZO_INICIALES,
  RESERVAS_INICIALES,
  SUCURSALES_INICIALES,
  TIPOS_MOVIMIENTO_INICIALES,
  USUARIOS_CAJA,
  USUARIO_CAJA_INICIAL,
} from "./caja-datos";
import { fechaIso } from "./caja-reglas";
import type {
  AcuerdoBancario,
  ActaConformidad,
  Arqueo,
  Caja,
  CambioTurno,
  Cheque,
  Chequera,
  TipoChequera,
  CierreSucursal,
  AjusteCierre,
  CuentaBancaria,
  Denominacion,
  ExcepcionHorario,
  Feriado,
  Jornada,
  MotivoDiferencia,
  MovimientoCaja,
  MovimientoTesoreria,
  PedidoRefuerzo,
  RegistroAuditoria,
  Reserva,
  Sucursal,
  TipoMovimientoTesoreria,
  UsuarioCaja,
} from "./caja-tipos";

function crear<T extends { id: string }>(nombre: string, inicial: T[], migrar?: (registro: T) => T) {
  return crearStoreAbm<T>({
    clave: `creditonet.caja.${nombre}.v1`,
    inicial,
    aplicar: () => {},
    valido: (r) => typeof r?.id === "string",
    migrar,
  });
}

// Cajas guardadas antes de los días operativos, el mínimo operativo y el margen de alerta.
const migrarCaja = (c: Caja): Caja => ({
  ...c,
  diasOperativos: c.diasOperativos ?? [1, 2, 3, 4, 5],
  minimoOperativo: c.minimoOperativo ?? { ARS: 0, USD: 0 },
  margenAlertaMin: c.margenAlertaMin ?? 30,
});

// Cierres guardados antes de la v4: "CERRADA" pasa a Cerrada OK y la reapertura de un supervisor se conserva.
const migrarCierreSucursal = (c: CierreSucursal): CierreSucursal => {
  const viejo = c as unknown as { estado: string; reapertura?: { supervisorId?: string; fechaHora?: string; nota?: string; solicitadaPor?: string } };
  if (viejo.estado === "CERRADA") return { ...c, estado: "CERRADA_OK" };
  const r = viejo.reapertura;
  if (r && r.supervisorId && !r.solicitadaPor)
    return { ...c, reapertura: { solicitadaPor: c.usuarioId, motivo: r.nota ?? "", fechaHoraSolicitud: r.fechaHora ?? "", autorizadaPor: r.supervisorId, fechaHoraAutorizacion: r.fechaHora } };
  return c;
};

export const cajaStores = {
  sucursales: crear<Sucursal>("sucursales", SUCURSALES_INICIALES),
  cajas: crear<Caja>("cajas", CAJAS_INICIALES, migrarCaja),
  feriados: crear<Feriado>("feriados", FERIADOS_INICIALES),
  cierresSucursal: crear<CierreSucursal>("cierres-sucursal", [], migrarCierreSucursal),
  ajustesCierre: crear<AjusteCierre>("ajustes-cierre", []),
  denominaciones: crear<Denominacion>("denominaciones", DENOMINACIONES_INICIALES),
  cuentasBancarias: crear<CuentaBancaria>("cuentas-bancarias", CUENTAS_BANCARIAS_INICIALES),
  acuerdos: crear<AcuerdoBancario>("acuerdos", ACUERDOS_INICIALES),
  tiposChequera: crear<TipoChequera>("tipos-chequera", TIPOS_CHEQUERA_INICIALES),
  chequeras: crear<Chequera>("chequeras", CHEQUERAS_INICIALES),
  cheques: crear<Cheque>("cheques", CHEQUES_INICIALES),
  reservas: crear<Reserva>("reservas", RESERVAS_INICIALES),
  motivos: crear<MotivoDiferencia>("motivos", MOTIVOS_DIFERENCIA_INICIALES),
  tipos: crear<TipoMovimientoTesoreria>("tipos", TIPOS_MOVIMIENTO_INICIALES),
  libro: crear<MovimientoCaja>("libro", LIBRO_INICIAL),
  jornadas: crear<Jornada>("jornadas", []),
  arqueos: crear<Arqueo>("arqueos", []),
  cambiosTurno: crear<CambioTurno>("cambios-turno", []),
  movimientos: crear<MovimientoTesoreria>("movimientos", MOVIMIENTOS_TESORERIA_INICIALES),
  pedidos: crear<PedidoRefuerzo>("pedidos", PEDIDOS_REFUERZO_INICIALES),
  excepciones: crear<ExcepcionHorario>("excepciones", []),
  auditoria: crear<RegistroAuditoria>("auditoria", []),
  actas: crear<ActaConformidad>("actas", []),
};

// Contexto de la demo: qué usuario opera el módulo y qué fecha y hora operativas simula (así apertura,
// cierre, feriados y alertas se pueden probar cualquier día y a cualquier hora real). Una fecha vacía
// significa la fecha real.
interface ContextoCaja {
  id: "ctx";
  usuarioId: string;
  hora: string;
  fecha: string;
}
const CONTEXTO_INICIAL: ContextoCaja[] = [{ id: "ctx", usuarioId: USUARIO_CAJA_INICIAL, hora: HORA_DEMO_INICIAL, fecha: "" }];
const contextoStore = crear<ContextoCaja>("contexto", CONTEXTO_INICIAL, (c) => ({ ...c, fecha: c.fecha ?? "" }));

export const useSucursales = cajaStores.sucursales.useLista;
export const useCajas = cajaStores.cajas.useLista;
export const useFeriados = cajaStores.feriados.useLista;
export const useCierresSucursal = cajaStores.cierresSucursal.useLista;
export const useAjustesCierre = cajaStores.ajustesCierre.useLista;
export const useDenominaciones = cajaStores.denominaciones.useLista;
export const useCuentasBancarias = cajaStores.cuentasBancarias.useLista;
export const useAcuerdos = cajaStores.acuerdos.useLista;
export const useTiposChequera = cajaStores.tiposChequera.useLista;
export const useChequeras = cajaStores.chequeras.useLista;
export const useCheques = cajaStores.cheques.useLista;
export const useReservas = cajaStores.reservas.useLista;
export const useMotivosDiferencia =cajaStores.motivos.useLista;
export const useTiposMovimiento = cajaStores.tipos.useLista;
export const useLibro = cajaStores.libro.useLista;
export const useJornadas = cajaStores.jornadas.useLista;
export const useArqueos = cajaStores.arqueos.useLista;
export const useCambiosTurno = cajaStores.cambiosTurno.useLista;
export const useMovimientosTesoreria = cajaStores.movimientos.useLista;
export const usePedidosRefuerzo = cajaStores.pedidos.useLista;
export const useExcepciones = cajaStores.excepciones.useLista;
export const useAuditoria = cajaStores.auditoria.useLista;
export const useActas = cajaStores.actas.useLista;

const contexto = () => contextoStore.get()[0] ?? CONTEXTO_INICIAL[0];

export const usuarioPorId = (id: string): UsuarioCaja | undefined => USUARIOS_CAJA.find((u) => u.id === id);
export const nombreUsuario = (id: string) => usuarioPorId(id)?.nombre ?? id;

export const usuarioActual = (): UsuarioCaja => usuarioPorId(contexto().usuarioId) ?? USUARIOS_CAJA[0];
export const horaActual = () => contexto().hora;
// Fecha y hora operativas: las simuladas de la demo y, si no se fijó fecha, la real del día.
export const hoy = () => contexto().fecha || fechaIso(new Date());
export const ahoraTexto = () => `${hoy()} ${horaActual()}`;

export function useUsuarioActual(): UsuarioCaja {
  const lista = contextoStore.useLista();
  return usuarioPorId(lista[0]?.usuarioId ?? USUARIO_CAJA_INICIAL) ?? USUARIOS_CAJA[0];
}
export function useHoraDemo(): string {
  return contextoStore.useLista()[0]?.hora ?? HORA_DEMO_INICIAL;
}
export function useFechaDemo(): string {
  return contextoStore.useLista()[0]?.fecha || fechaIso(new Date());
}
// Una fecha vacía vuelve a la fecha real.
export function fijarFechaDemo(fecha: string) {
  if (fecha === "" || /^\d{4}-\d{2}-\d{2}$/.test(fecha)) contextoStore.commit([{ ...contexto(), fecha }]);
}
export function fijarUsuarioActual(usuarioId: string) {
  contextoStore.commit([{ ...contexto(), usuarioId }]);
}
export function fijarHoraDemo(hora: string) {
  if (/^\d{2}:\d{2}$/.test(hora)) contextoStore.commit([{ ...contexto(), hora }]);
}

// Siguiente ID correlativo con el formato del prefijo (por ejemplo SUC-005).
export function siguienteId(prefijo: string, ids: string[], ancho = 3): string {
  const n = Math.max(0, ...ids.map((id) => Number(id.replace(`${prefijo}-`, "")) || 0)) + 1;
  return `${prefijo}-${String(n).padStart(ancho, "0")}`;
}

// ---------- Auditoría de los ABM: usuario, fecha y hora, valor anterior y nuevo ----------

type Plano = Record<string, unknown>;

// Texto legible con sólo los campos que cambiaron (antes y después).
export function cambios(antes: Plano | null, despues: Plano): { antes: string | null; despues: string } {
  const texto = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "—"));
  if (!antes) {
    return { antes: null, despues: Object.entries(despues).filter(([k]) => !["fechaAlta", "usuarioAlta"].includes(k)).map(([k, v]) => `${k}: ${texto(v)}`).join(" · ") };
  }
  const claves = Object.keys(despues).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
  return {
    antes: claves.map((k) => `${k}: ${texto(antes[k])}`).join(" · ") || "—",
    despues: claves.map((k) => `${k}: ${texto(despues[k])}`).join(" · ") || "—",
  };
}

export function auditar(
  entidad: string,
  registroId: string,
  accion: RegistroAuditoria["accion"],
  antes: string | null,
  despues: string | null
) {
  const lista = cajaStores.auditoria.get();
  cajaStores.auditoria.commit([
    ...lista,
    {
      id: siguienteId("AUD", lista.map((a) => a.id), 5),
      entidad,
      registroId,
      accion,
      usuario: usuarioActual().nombre,
      fechaHora: ahoraTexto(),
      antes,
      despues,
    },
  ]);
}

// ---------- Hidratación y reinicio ----------

export function hidratarCaja() {
  contextoStore.hidratar();
  for (const s of Object.values(cajaStores)) s.hidratar();
}

// "Reiniciar demo": vuelve a los datos de ejemplo.
export function reiniciarCaja() {
  contextoStore.commit(CONTEXTO_INICIAL);
  cajaStores.sucursales.commit(SUCURSALES_INICIALES);
  cajaStores.cajas.commit(CAJAS_INICIALES);
  cajaStores.feriados.commit(FERIADOS_INICIALES);
  cajaStores.cierresSucursal.commit([]);
  cajaStores.ajustesCierre.commit([]);
  cajaStores.denominaciones.commit(DENOMINACIONES_INICIALES);
  cajaStores.cuentasBancarias.commit(CUENTAS_BANCARIAS_INICIALES);
  cajaStores.acuerdos.commit(ACUERDOS_INICIALES);
  cajaStores.tiposChequera.commit(TIPOS_CHEQUERA_INICIALES);
  cajaStores.chequeras.commit(CHEQUERAS_INICIALES);
  cajaStores.cheques.commit(CHEQUES_INICIALES);
  cajaStores.reservas.commit(RESERVAS_INICIALES);
  cajaStores.motivos.commit(MOTIVOS_DIFERENCIA_INICIALES);
  cajaStores.tipos.commit(TIPOS_MOVIMIENTO_INICIALES);
  cajaStores.libro.commit(LIBRO_INICIAL);
  cajaStores.jornadas.commit([]);
  cajaStores.arqueos.commit([]);
  cajaStores.cambiosTurno.commit([]);
  cajaStores.movimientos.commit(MOVIMIENTOS_TESORERIA_INICIALES);
  cajaStores.pedidos.commit(PEDIDOS_REFUERZO_INICIALES);
  cajaStores.excepciones.commit([]);
  cajaStores.auditoria.commit([]);
  cajaStores.actas.commit([]);
}

// Un único hook para las pantallas operativas, que necesitan casi todo el estado a la vez.
export function useCajaDatos() {
  return {
    sucursales: useSucursales(),
    cajas: useCajas(),
    feriados: useFeriados(),
    cierresSucursal: useCierresSucursal(),
    denominaciones: useDenominaciones(),
    motivos: useMotivosDiferencia(),
    tipos: useTiposMovimiento(),
    libro: useLibro(),
    jornadas: useJornadas(),
    arqueos: useArqueos(),
    cambiosTurno: useCambiosTurno(),
    movimientos: useMovimientosTesoreria(),
    pedidos: usePedidosRefuerzo(),
    excepciones: useExcepciones(),
    usuario: useUsuarioActual(),
    hora: useHoraDemo(),
    fecha: useFechaDemo(),
  };
}
