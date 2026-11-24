// Stores del control interno (v4). Igual que el resto del módulo, todo vive en el front: cada lista se
// persiste en la sesión del navegador y se hidrata junto con la demo. "Reiniciar demo" la restablece.

import { crearStoreAbm } from "./store-abm";
import { ALERTAS_CONFIG_INICIALES, LLAVES_INICIALES, MATRIZ_INICIAL, PLAZOS_INICIALES } from "./control-datos";
import type { AlertaEnviada, ConfigAlerta, Firma, LlaveUsuario, PlazosControl, ReglaMatriz } from "./control-tipos";

function crear<T extends { id: string }>(nombre: string, inicial: T[]) {
  return crearStoreAbm<T>({
    clave: `creditonet.control.${nombre}.v1`,
    inicial,
    aplicar: () => {},
    valido: (r) => typeof r?.id === "string",
  });
}

export const controlStores = {
  firmas: crear<Firma>("firmas", []),
  llaves: crear<LlaveUsuario>("llaves", LLAVES_INICIALES),
  matriz: crear<ReglaMatriz>("matriz", MATRIZ_INICIAL),
  alertasConfig: crear<ConfigAlerta>("alertas-config", ALERTAS_CONFIG_INICIALES),
  plazos: crear<PlazosControl>("plazos", PLAZOS_INICIALES),
  alertasEnviadas: crear<AlertaEnviada>("alertas-enviadas", []),
};

export const useFirmas = controlStores.firmas.useLista;
export const useLlaves = controlStores.llaves.useLista;
export const useMatriz = controlStores.matriz.useLista;
export const useAlertasConfig = controlStores.alertasConfig.useLista;
export const usePlazos = controlStores.plazos.useLista;
export const useAlertasEnviadas = controlStores.alertasEnviadas.useLista;

export const plazosControl = (): PlazosControl => controlStores.plazos.get()[0] ?? PLAZOS_INICIALES[0];

export function hidratarControl() {
  for (const s of Object.values(controlStores)) s.hidratar();
}

// "Reiniciar demo": vuelve a los datos de ejemplo.
export function reiniciarControl() {
  controlStores.firmas.commit([]);
  controlStores.llaves.commit(LLAVES_INICIALES);
  controlStores.matriz.commit(MATRIZ_INICIAL);
  controlStores.alertasConfig.commit(ALERTAS_CONFIG_INICIALES);
  controlStores.plazos.commit(PLAZOS_INICIALES);
  controlStores.alertasEnviadas.commit([]);
}
