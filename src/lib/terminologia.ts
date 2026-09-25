// creditonet-84 — Glosario único de la UI y los reportes.
// Cada concepto se nombra igual en toda la aplicación: si un término tiene que
// cambiar, se cambia acá y no en cada pantalla. Usar siempre estas constantes en
// labels, títulos de fila y textos de resumen; no escribir el término a mano.
export const TERMINOS = {
  // Dinero que el cliente tiene libre para extraer de su cuenta.
  disponible: "Disponible",
  // Saldo de la cuenta el día en que se acreditaron los haberes.
  saldoDiaAcreditacion: "Saldo día de la acreditación",
  // Movimientos de salida de la cuenta del cliente.
  transferenciasExtracciones: "Transferencias/extracciones dia de la acreditación",
  // Conceptos del recibo que no integran la remuneración ("débito no
  // remunerativo" era un uso incorrecto del término).
  conceptosNoRemunerativos: "Conceptos no remunerativos",
  // Importe que efectivamente se acredita al cliente: capital solicitado menos
  // cancelaciones propias y de terceros. Antes aparecía como "Acreditación
  // neta" y como "Transferencia neta al cliente".
  saldoAcreditacion: "Saldo de acreditación",
  // Cancelación de deudas que el cliente mantiene con otras entidades.
  cancelacionTerceros: "Cancelación de deudas con terceros",
} as const;
