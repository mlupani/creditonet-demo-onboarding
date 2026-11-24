// Stores de la Función 6 Proveedores. Igual que Caja: cada lista se persiste en la sesión del navegador
// y "Reiniciar demo" la restablece.

import { crearStoreAbm } from "./store-abm";
import {
  COMPROBANTES_INICIALES,
  LOTES_INICIALES,
  ORDENES_PAGO_INICIALES,
  PAGOS_INICIALES,
  PROVEEDORES_INICIALES,
  TIPOS_COMPROBANTE_INICIALES,
} from "./proveedores-datos";
import type { Comprobante, LoteComprobantes, OrdenPago, PagoProveedor, Proveedor, TipoComprobante } from "./proveedores-tipos";

function crear<T extends { id: string }>(nombre: string, inicial: T[]) {
  return crearStoreAbm<T>({
    clave: `creditonet.caja.prov-${nombre}.v2`,
    inicial,
    aplicar: () => {},
    valido: (r) => typeof r?.id === "string",
  });
}

export const provStores = {
  proveedores: crear<Proveedor>("proveedores", PROVEEDORES_INICIALES),
  tiposComprobante: crear<TipoComprobante>("tipos-comprobante", TIPOS_COMPROBANTE_INICIALES),
  comprobantes: crear<Comprobante>("comprobantes", COMPROBANTES_INICIALES),
  // Las claves llevan v2: cambió el modelo (orden de pago por proveedor, pagos con estados).
  ordenesPago: crearStoreAbm<OrdenPago>({
    clave: "creditonet.caja.prov-ordenes-pago.v2",
    inicial: ORDENES_PAGO_INICIALES,
    aplicar: () => {},
    valido: (r) => typeof r?.id === "string",
  }),
  pagos: crearStoreAbm<PagoProveedor>({
    clave: "creditonet.caja.prov-pagos.v2",
    inicial: PAGOS_INICIALES,
    aplicar: () => {},
    valido: (r) => typeof r?.id === "string" && Array.isArray(r.aplicaciones),
  }),
  lotes: crear<LoteComprobantes>("lotes", LOTES_INICIALES),
};

export const useProveedores = provStores.proveedores.useLista;
export const useTiposComprobante = provStores.tiposComprobante.useLista;
export const useComprobantes = provStores.comprobantes.useLista;
export const useOrdenesPago = provStores.ordenesPago.useLista;
export const usePagosProveedor = provStores.pagos.useLista;
export const useLotes = provStores.lotes.useLista;

export function hidratarProveedores() {
  for (const s of Object.values(provStores)) s.hidratar();
}

// "Reiniciar demo": vuelve a los datos de ejemplo.
export function reiniciarProveedores() {
  provStores.proveedores.commit(PROVEEDORES_INICIALES);
  provStores.tiposComprobante.commit(TIPOS_COMPROBANTE_INICIALES);
  provStores.comprobantes.commit(COMPROBANTES_INICIALES);
  provStores.ordenesPago.commit(ORDENES_PAGO_INICIALES);
  provStores.pagos.commit(PAGOS_INICIALES);
  provStores.lotes.commit(LOTES_INICIALES);
}
