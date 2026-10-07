// Parámetros impositivos generales: por ahora, la alícuota de IVA (%) que usan todos los productos
// que calculan IVA. Es editable desde /parametros, se persiste en la sesión y arranca en 21 %.

import { crearStoreAbm } from "./store-abm";

interface Impositivos {
  ivaPct: number;
}

export const IVA_INICIAL = 21;

const store = crearStoreAbm<Impositivos>({
  clave: "creditonet.impositivos.v1",
  inicial: [{ ivaPct: IVA_INICIAL }],
  valido: (r) => typeof r?.ivaPct === "number",
  aplicar: () => {},
});

export const hidratarImpositivos = store.hidratar;

export function getIvaPct(): number {
  return store.get()[0]?.ivaPct ?? IVA_INICIAL;
}

export function useIvaPct(): number {
  return store.useLista()[0]?.ivaPct ?? IVA_INICIAL;
}

export function guardarIvaPct(ivaPct: number) {
  store.commit([{ ivaPct }]);
}
