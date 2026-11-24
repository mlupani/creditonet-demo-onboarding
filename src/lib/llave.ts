// Llave de autorización (R6). Toda autorización o firma de acta se confirma con usuario y clave más un
// segundo factor personal. En la demo la clave es la misma para todos (CLAVE_DEMO) y el código
// temporal —el que llegaría al celular— se deriva de la fecha y la hora simuladas, así que cambia
// cuando cambia el reloj de la demo y se muestra en pantalla.
//
// Cada firma queda registrada y no se edita ni se borra. Un usuario no puede firmar una operación que
// cargó él mismo, aunque tenga varios roles.

import { ahoraTexto, horaActual, hoy, siguienteId, usuarioPorId } from "./caja-store";
import type { Res } from "./caja-operaciones";
import type { Moneda, RolCaja, UsuarioCaja } from "./caja-tipos";
import { CLAVE_DEMO } from "./control-datos";
import { controlStores } from "./control-store";
import type { Firma } from "./control-tipos";

// Orden de jerarquía para elegir con qué rol firma quien tiene varios.
const JERARQUIA: RolCaja[] = ["DIRECTOR", "TESORERO_CENTRAL", "SUPERVISOR", "TESORERO", "CAJERO"];
export const rolDeFirma = (u: UsuarioCaja): RolCaja => JERARQUIA.find((r) => u.roles.includes(r)) ?? u.roles[0];

// Casa Central: Director y Tesorero central (sin sucursal) y los usuarios de SUC-001.
export const esCasaCentral = (u: UsuarioCaja) => !u.sucursalId || u.sucursalId === "SUC-001";

// Código de 6 dígitos (FNV-1a) derivado del usuario, la fecha y la hora simuladas.
export function codigoTemporal(usuarioId: string, fecha = hoy(), hora = horaActual()): string {
  let h = 0x811c9dc5;
  for (const c of `${usuarioId}|${fecha}|${hora}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return String(h % 1000000).padStart(6, "0");
}

export const equipoDe = (u: UsuarioCaja, remota = false) => (remota ? "PC-CASA-CENTRAL-01" : `PC-${u.sucursalId ?? "SUC-001"}-01`);

export interface EntradaFirma {
  usuarioId: string;
  clave: string;
  codigo: string;
  operacion: string;
  referencia: string;
  importe?: number;
  moneda?: Moneda;
  // Quien cargó la operación: no puede firmarla.
  cargadoPor?: string;
  // Rol con el que firma (por defecto el de mayor jerarquía del usuario).
  rol?: RolCaja;
  // Firma remota de Casa Central: no equivale a la verificación física.
  remota?: boolean;
}

export function firmar(e: EntradaFirma): Res<{ firma: Firma }> {
  const usuario = usuarioPorId(e.usuarioId);
  if (!usuario) return { ok: false, error: "Elegí el usuario que firma." };
  const llave = controlStores.llaves.get().find((l) => l.id === usuario.id);
  if (!llave || llave.estado === "BAJA") return { ok: false, error: `${usuario.nombre} no tiene una llave de autorización activa.` };
  if (llave.estado === "BLOQUEADA") return { ok: false, error: `La llave de ${usuario.nombre} está bloqueada: pedí que se desbloquee en Parámetros.` };
  if (e.cargadoPor && e.cargadoPor === usuario.id)
    return { ok: false, error: "No podés autorizar ni firmar una operación que cargaste vos, aunque tengas otros roles." };
  if (e.clave !== CLAVE_DEMO) return { ok: false, error: "La clave es incorrecta." };
  if (e.codigo.trim() !== codigoTemporal(usuario.id)) return { ok: false, error: "El código temporal es incorrecto o venció." };
  const rol = e.rol ?? rolDeFirma(usuario);
  if (!usuario.roles.includes(rol)) return { ok: false, error: `${usuario.nombre} no tiene el rol ${rol}.` };
  if (e.remota && !esCasaCentral(usuario)) return { ok: false, error: "La firma remota la da un usuario de Casa Central." };

  const firmas = controlStores.firmas.get();
  const firma: Firma = {
    id: siguienteId("FIR", firmas.map((f) => f.id), 4),
    usuarioId: usuario.id,
    rol,
    fechaHora: ahoraTexto(),
    equipo: equipoDe(usuario, e.remota),
    operacion: e.operacion,
    referencia: e.referencia,
    importe: e.importe,
    moneda: e.moneda,
    modalidad: e.remota ? "REMOTA" : "PRESENCIAL",
  };
  controlStores.firmas.commit([...firmas, firma]);
  return { ok: true, firma };
}

export const firmaPorId = (id: string | undefined): Firma | undefined =>
  id ? controlStores.firmas.get().find((f) => f.id === id) : undefined;
