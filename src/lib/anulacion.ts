// Caída del crédito (creditonet-118): el cliente desiste y la solicitud queda Anulada. Funciones
// puras, sin React, para poder probarlas con `npm test`.

import type { CreditApplication } from "./types";
import type { CreditoDB } from "./creditos-db";

// Anula una solicitud: estado ANULADO, suelta la toma del analista, descarta lo pendiente de
// la oferta y deja el motivo en la observación (así se ve en la bandeja y en el historial).
export function aplicarAnulacion<T extends CreditApplication>(prev: T, nota: string, fecha: string): T {
  return {
    ...prev,
    estado: "ANULADO",
    analista: {
      ...prev.analista,
      tomado: false,
      cambioOfertaPendiente: null,
      derivacionCambioFinanciero: null,
      observacion: { motivo: "Anulada", nota, fecha, pantallas: [] },
    },
  };
}

// Deja la solicitud anulada como un registro más de la DB simulada. Sin esto, soltar la solicitud
// en curso (el vendedor sigue con otra) descartaba el crédito anulado en vez de listarlo.
// Si todavía no tiene ID de Crédito, `idSinNumero` hace de id estable del registro.
export function registrarAnulacion(
  base: CreditoDB[],
  app: CreditApplication,
  idRegistro: string | null,
  idSinNumero: string,
  nota: string,
  fecha: string
): CreditoDB[] {
  const id = idRegistro ?? app.numeroCredito ?? idSinNumero;
  const previo = base.find((c) => c._id === id);
  const anulada = aplicarAnulacion(app, nota, fecha);
  const registro: CreditoDB = {
    _bandeja: "vendedor",
    _descripcion: "Anulado por el canal de venta",
    ...previo,
    ...anulada,
    _id: id,
  };
  return [...base.filter((c) => c._id !== id), registro];
}
