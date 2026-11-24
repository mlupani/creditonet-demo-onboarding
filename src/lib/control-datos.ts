// Datos de ejemplo del control interno (v4): matriz de autorizaciones, destinatarios de alertas,
// plazos y llaves de autorización.

import { USUARIOS_CAJA } from "./caja-datos";
import type { RolCaja } from "./caja-tipos";
import {
  EVENTOS_ALERTA,
  type ConfigAlerta,
  type LlaveUsuario,
  type PlazosControl,
  type ReglaMatriz,
  type TipoOperacionMatriz,
} from "./control-tipos";

// Clave y segundo factor de la demo: la clave es la misma para todos y el código temporal se deriva
// de la fecha y la hora simuladas (ver llave.ts), así que se puede probar sin celular.
export const CLAVE_DEMO = "1234";

const alta = { estado: "ACTIVO", fechaAlta: "2026-11-20", usuarioAlta: "Marina Costa" } as const;
const SIN_TOPE = { ARS: null, USD: null };

let n = 0;
function regla(
  operacion: TipoOperacionMatriz,
  perfilCarga: RolCaja[],
  perfilAutoriza: RolCaja[],
  importeHasta: ReglaMatriz["importeHasta"],
  extra: Partial<Pick<ReglaMatriz, "admiteRemota" | "dobleAutorizacion" | "escalaA">> = {}
): ReglaMatriz {
  n += 1;
  return {
    id: `MTX-${String(n).padStart(3, "0")}`,
    operacion,
    perfilCarga,
    perfilAutoriza,
    importeHasta,
    admiteRemota: extra.admiteRemota ?? false,
    dobleAutorizacion: extra.dobleAutorizacion ?? false,
    escalaA: extra.escalaA ?? [],
    ...alta,
  };
}

export const MATRIZ_INICIAL: ReglaMatriz[] = [
  regla("MOVIMIENTO_TESORERIA", ["CAJERO", "TESORERO"], ["SUPERVISOR"], { ARS: 5000000, USD: 5000 }, { escalaA: ["TESORERO_CENTRAL"] }),
  regla("MOVIMIENTO_TESORERIA", ["CAJERO", "TESORERO"], ["TESORERO_CENTRAL"], { ARS: 50000000, USD: 50000 }, { admiteRemota: true, escalaA: ["DIRECTOR"] }),
  regla("MOVIMIENTO_TESORERIA", ["CAJERO", "TESORERO"], ["DIRECTOR"], SIN_TOPE, { admiteRemota: true, dobleAutorizacion: true }),
  regla("ORDEN_PAGO", ["TESORERO", "TESORERO_CENTRAL"], ["TESORERO_CENTRAL"], { ARS: 20000000, USD: 20000 }, { escalaA: ["DIRECTOR"] }),
  regla("ORDEN_PAGO", ["TESORERO", "TESORERO_CENTRAL"], ["DIRECTOR"], SIN_TOPE, { dobleAutorizacion: true }),
  regla("COMPROBANTE", ["CAJERO", "TESORERO", "TESORERO_CENTRAL"], ["SUPERVISOR", "TESORERO"], { ARS: 2000000, USD: 2000 }, { escalaA: ["TESORERO_CENTRAL"] }),
  regla("COMPROBANTE", ["CAJERO", "TESORERO", "TESORERO_CENTRAL"], ["TESORERO_CENTRAL"], { ARS: 20000000, USD: 20000 }, { admiteRemota: true, escalaA: ["DIRECTOR"] }),
  regla("COMPROBANTE", ["CAJERO", "TESORERO", "TESORERO_CENTRAL"], ["DIRECTOR"], SIN_TOPE, { admiteRemota: true }),
  regla("AJUSTE_DIFERENCIA", ["CAJERO", "TESORERO", "SUPERVISOR"], ["SUPERVISOR"], { ARS: 100000, USD: 100 }, { escalaA: ["TESORERO_CENTRAL"] }),
  regla("AJUSTE_DIFERENCIA", ["CAJERO", "TESORERO", "SUPERVISOR"], ["TESORERO_CENTRAL"], { ARS: 1000000, USD: 1000 }, { admiteRemota: true, escalaA: ["DIRECTOR"] }),
  regla("AJUSTE_DIFERENCIA", ["CAJERO", "TESORERO", "SUPERVISOR"], ["DIRECTOR"], SIN_TOPE, { admiteRemota: true }),
  regla("REAPERTURA", ["TESORERO", "SUPERVISOR"], ["TESORERO_CENTRAL", "DIRECTOR"], SIN_TOPE, { admiteRemota: true }),
  regla("PAGO_PRESTAMO", ["TESORERO_CENTRAL"], ["TESORERO_CENTRAL"], { ARS: 10000000, USD: 10000 }, { escalaA: ["DIRECTOR"] }),
  regla("PAGO_PRESTAMO", ["TESORERO_CENTRAL"], ["DIRECTOR"], SIN_TOPE, { dobleAutorizacion: true }),
];

export const ALERTAS_CONFIG_INICIALES: ConfigAlerta[] = EVENTOS_ALERTA.map((e, i) => ({
  id: `ALC-${String(i + 1).padStart(3, "0")}`,
  evento: e.id,
  destinatarios: e.destinatarios,
  ...alta,
}));

export const PLAZOS_INICIALES: PlazosControl[] = [
  {
    id: "plazos",
    diasAvisoAcuerdos: 15,
    margenCajaSinCerrarMin: 30,
    horaLimiteCierreDiario: "20:00",
    ventanaAjusteHoras: 24,
    plazoReaperturaDias: 5,
    superiorEscalamiento: "TESORERO_CENTRAL",
  },
];

export const LLAVES_INICIALES: LlaveUsuario[] = USUARIOS_CAJA.map((u) => ({ id: u.id, estado: "ACTIVA" }));
