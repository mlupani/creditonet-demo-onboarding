// Stores del módulo Caja y Bancos. Todo vive en el front: cada lista se persiste en la sesión del
// navegador (crearStoreAbm) y se hidrata junto con el resto de la demo. "Reiniciar demo" la restablece.

import { crearStoreAbm } from "./store-abm";
import {
  CAJAS_INICIALES,
  CUENTAS_BANCARIAS_INICIALES,
  DENOMINACIONES_INICIALES,
  HORA_DEMO_INICIAL,
  LIBRO_INICIAL,
  MOTIVOS_DIFERENCIA_INICIALES,
  MOVIMIENTOS_TESORERIA_INICIALES,
  PEDIDOS_REFUERZO_INICIALES,
  SUCURSALES_INICIALES,
  TIPOS_MOVIMIENTO_INICIALES,
  USUARIOS_CAJA,
  USUARIO_CAJA_INICIAL,
} from "./caja-datos";
import { fechaHoraIso, fechaIso } from "./caja-reglas";
import type {
  Arqueo,
  Caja,
  CambioTurno,
  CuentaBancaria,
  Denominacion,
  ExcepcionHorario,
  Jornada,
  MotivoDiferencia,
  MovimientoCaja,
  MovimientoTesoreria,
  PedidoRefuerzo,
  RegistroAuditoria,
  Sucursal,
  TipoMovimientoTesoreria,
  UsuarioCaja,
} from "./caja-tipos";

function crear<T extends { id: string }>(nombre: string, inicial: T[]) {
  return crearStoreAbm<T>({
    clave: `creditonet.caja.${nombre}.v1`,
    inicial,
    aplicar: () => {},
    valido: (r) => typeof r?.id === "string",
  });
}

export const cajaStores = {
  sucursales: crear<Sucursal>("sucursales", SUCURSALES_INICIALES),
  cajas: crear<Caja>("cajas", CAJAS_INICIALES),
  denominaciones: crear<Denominacion>("denominaciones", DENOMINACIONES_INICIALES),
  cuentasBancarias: crear<CuentaBancaria>("cuentas-bancarias", CUENTAS_BANCARIAS_INICIALES),
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
};

// Contexto de la demo: qué usuario opera el módulo y qué hora operativa simula (así apertura y cierre
// se pueden probar a cualquier hora real).
interface ContextoCaja {
  id: "ctx";
  usuarioId: string;
  hora: string;
}
const CONTEXTO_INICIAL: ContextoCaja[] = [{ id: "ctx", usuarioId: USUARIO_CAJA_INICIAL, hora: HORA_DEMO_INICIAL }];
const contextoStore = crear<ContextoCaja>("contexto", CONTEXTO_INICIAL);

export const useSucursales = cajaStores.sucursales.useLista;
export const useCajas = cajaStores.cajas.useLista;
export const useDenominaciones = cajaStores.denominaciones.useLista;
export const useCuentasBancarias = cajaStores.cuentasBancarias.useLista;
export const useMotivosDiferencia = cajaStores.motivos.useLista;
export const useTiposMovimiento = cajaStores.tipos.useLista;
export const useLibro = cajaStores.libro.useLista;
export const useJornadas = cajaStores.jornadas.useLista;
export const useArqueos = cajaStores.arqueos.useLista;
export const useCambiosTurno = cajaStores.cambiosTurno.useLista;
export const useMovimientosTesoreria = cajaStores.movimientos.useLista;
export const usePedidosRefuerzo = cajaStores.pedidos.useLista;
export const useExcepciones = cajaStores.excepciones.useLista;
export const useAuditoria = cajaStores.auditoria.useLista;

const contexto = () => contextoStore.get()[0] ?? CONTEXTO_INICIAL[0];

export const usuarioPorId = (id: string): UsuarioCaja | undefined => USUARIOS_CAJA.find((u) => u.id === id);
export const nombreUsuario = (id: string) => usuarioPorId(id)?.nombre ?? id;

export const usuarioActual = (): UsuarioCaja => usuarioPorId(contexto().usuarioId) ?? USUARIOS_CAJA[0];
export const horaActual = () => contexto().hora;
// La fecha es la real (cada día tiene su jornada); la hora es la simulada.
export const hoy = () => fechaIso(new Date());
export const ahoraTexto = () => fechaHoraIso(new Date(), horaActual());

export function useUsuarioActual(): UsuarioCaja {
  const lista = contextoStore.useLista();
  return usuarioPorId(lista[0]?.usuarioId ?? USUARIO_CAJA_INICIAL) ?? USUARIOS_CAJA[0];
}
export function useHoraDemo(): string {
  return contextoStore.useLista()[0]?.hora ?? HORA_DEMO_INICIAL;
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
  cajaStores.denominaciones.commit(DENOMINACIONES_INICIALES);
  cajaStores.cuentasBancarias.commit(CUENTAS_BANCARIAS_INICIALES);
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
}

// Un único hook para las pantallas operativas, que necesitan casi todo el estado a la vez.
export function useCajaDatos() {
  return {
    sucursales: useSucursales(),
    cajas: useCajas(),
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
  };
}
