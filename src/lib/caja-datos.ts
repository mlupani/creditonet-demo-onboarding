// Datos de ejemplo del módulo Caja y Bancos. Los saldos salen del libro: los saldos iniciales son
// asientos "Saldo inicial", así que el recuento de apertura se puede contar contra el esperado.

import type {
  AcuerdoBancario,
  Caja,
  Cheque,
  Chequera,
  TipoChequera,
  CuentaBancaria,
  CuentaContable,
  Denominacion,
  Feriado,
  MotivoDiferencia,
  MovimientoCaja,
  MovimientoTesoreria,
  PedidoRefuerzo,
  Reserva,
  Sucursal,
  TipoMovimientoTesoreria,
  UsuarioCaja,
} from "./caja-tipos";

export const USUARIOS_CAJA: UsuarioCaja[] = [
  { id: "ana-gomez", nombre: "Ana Gómez", roles: ["CAJERO"], sucursalId: "SUC-002" },
  { id: "luis-pereyra", nombre: "Luis Pereyra", roles: ["CAJERO"], sucursalId: "SUC-002" },
  { id: "tomas-ruiz", nombre: "Tomás Ruiz", roles: ["TESORERO", "CAJERO"], sucursalId: "SUC-002" },
  { id: "carlos-ibarra", nombre: "Carlos Ibarra", roles: ["TESORERO"], sucursalId: "SUC-001" },
  { id: "marta-diaz", nombre: "Marta Díaz", roles: ["SUPERVISOR"], sucursalId: "SUC-002" },
  { id: "raul-molina", nombre: "Raúl Molina", roles: ["SUPERVISOR"], sucursalId: "SUC-001" },
  { id: "laura-benitez", nombre: "Laura Benítez", roles: ["DIRECTOR"] },
  { id: "ricardo-pena", nombre: "Ricardo Peña", roles: ["TESORERO_CENTRAL"] },
];

// Usuario con el que arranca el módulo.
export const USUARIO_CAJA_INICIAL = "ana-gomez";

// Hora operativa simulada: permite probar apertura y cierre a cualquier hora real.
export const HORA_DEMO_INICIAL = "11:00";

export const CUENTAS_CONTABLES: CuentaContable[] = [
  { codigo: "1.1.01.01", nombre: "Caja · Tesoro central" },
  { codigo: "1.1.01.02", nombre: "Caja · Tesoros de sucursal" },
  { codigo: "1.1.01.03", nombre: "Caja · Cajas de cajero" },
  { codigo: "1.1.01.04", nombre: "Caja · Fondos fijos" },
  { codigo: "1.1.02.01", nombre: "Valores a depositar en tránsito" },
  { codigo: "1.1.02.02", nombre: "Fondos en tránsito entre tesoros" },
  { codigo: "1.1.03.01", nombre: "Bancos · Cuenta corriente Banco Nación" },
  { codigo: "1.1.03.02", nombre: "Bancos · Cuenta corriente Banco Galicia" },
  { codigo: "1.1.03.03", nombre: "Bancos · Caja de ahorro USD Banco Galicia" },
  { codigo: "4.9.01.01", nombre: "Sobrantes de caja" },
  { codigo: "5.9.01.01", nombre: "Faltantes de caja" },
  { codigo: "5.9.01.02", nombre: "Pérdida por billetes falsos" },
  { codigo: "5.9.01.03", nombre: "Diferencias a regularizar" },
  { codigo: "2.1.01.01", nombre: "Facturas a pagar" },
  { codigo: "5.2.01.01", nombre: "Gastos de oficina" },
  { codigo: "5.2.01.02", nombre: "Servicios y mantenimiento" },
  { codigo: "5.2.01.03", nombre: "Honorarios profesionales" },
];

const cuentaBancaria = (
  n: number,
  banco: string,
  tipo: CuentaBancaria["tipo"],
  numero: string,
  cbu: string,
  moneda: "ARS" | "USD",
  cuentaContable: string
): CuentaBancaria => ({
  id: `CB-${String(n).padStart(3, "0")}`,
  banco,
  tipo,
  numero,
  cbu,
  moneda,
  cuentaContable,
  estado: "ACTIVO",
  fechaAlta: "2026-11-01",
  usuarioAlta: "Marina Costa",
});

export const CUENTAS_BANCARIAS_INICIALES: CuentaBancaria[] = [
  {
    ...cuentaBancaria(1, "Banco Nación", "CUENTA_CORRIENTE", "0110-4412-90", "0110441230044129000019", "ARS", "1.1.03.01"),
    alias: "CREDITONET.NACION",
    sucursalBanco: "Sucursal Plaza de Mayo",
    direccionBanco: "Bartolomé Mitre 326, CABA",
    oficialNombre: "Julieta Ferreyra",
    oficialTelefono: "11 4347-6000",
    oficialMail: "jferreyra@bna.example.com",
    mailSucursal: "plazademayo@bna.example.com",
    fechaApertura: "2024-03-12",
    saldoInicial: 8000000,
  },
  {
    ...cuentaBancaria(2, "Banco Galicia", "CUENTA_CORRIENTE", "0070-8821-15", "0070882130008821150014", "ARS", "1.1.03.02"),
    alias: "CREDITONET.GALICIA",
    sucursalBanco: "Sucursal Microcentro",
    direccionBanco: "Tte. Gral. Perón 407, CABA",
    oficialNombre: "Martín Sosa",
    oficialTelefono: "11 6329-0000",
    oficialMail: "msosa@galicia.example.com",
    mailSucursal: "microcentro@galicia.example.com",
    fechaApertura: "2024-06-03",
    saldoInicial: 3000000,
  },
  {
    ...cuentaBancaria(3, "Banco Galicia", "CAJA_AHORRO", "0070-8821-77", "0070882140008821770016", "USD", "1.1.03.03"),
    alias: "CREDITONET.GALICIA.USD",
    sucursalBanco: "Sucursal Microcentro",
    direccionBanco: "Tte. Gral. Perón 407, CABA",
    oficialNombre: "Martín Sosa",
    oficialTelefono: "11 6329-0000",
    oficialMail: "msosa@galicia.example.com",
    mailSucursal: "microcentro@galicia.example.com",
    fechaApertura: "2025-01-20",
    saldoInicial: 20000,
  },
];

const alta = { estado: "ACTIVO", fechaAlta: "2026-11-01", usuarioAlta: "Marina Costa" } as const;

export const ACUERDOS_INICIALES: AcuerdoBancario[] = [
  { id: "ACU-001", cuentaId: "CB-001", fecha: "2026-09-15", importe: 25000000, tasa: 62.5, vencimiento: "2027-03-15", ...alta },
  { id: "ACU-002", cuentaId: "CB-002", fecha: "2026-10-01", importe: 12000000, tasa: 58, vencimiento: "2026-12-30", ...alta },
];

export const TIPOS_CHEQUERA_INICIALES: TipoChequera[] = [
  { id: "TCH-001", descripcion: "Física", ...alta },
  { id: "TCH-002", descripcion: "E-cheq", ...alta },
];

export const CHEQUERAS_INICIALES: Chequera[] = [
  { id: "CHQ-001", tipoId: "TCH-001", cuentaId: "CB-001", fecha: "2026-10-05", desde: "10001", hasta: "10050", ...alta },
  { id: "CHQ-002", tipoId: "TCH-002", cuentaId: "CB-002", fecha: "2026-10-20", desde: "", hasta: "", ...alta },
];

const trazaAlta = (fechaHora: string, usuario: string, estado: Cheque["estado"], detalle: string): Cheque["traza"] => [
  { estado, usuario, fechaHora, detalle },
];

// Cheques de terceros en custodia (uno vence en la semana) y propios emitidos de CHQ-001 y CHQ-002.
export const CHEQUES_INICIALES: Cheque[] = [
  {
    id: "CHE-0001", origen: "TERCERO", forma: "FISICO", banco: "Banco Santander", numero: "00458120", importe: 185000, moneda: "ARS",
    parte: "Distribuidora Norte SA", fechaEmision: "2026-11-10", fechaPago: "2026-11-23", cajaId: "CAJ-001",
    estado: "EN_CUSTODIA", traza: trazaAlta("2026-11-10 10:30", "Carlos Ibarra", "EN_CUSTODIA", "Recibido en custodia"),
    fechaAlta: "2026-11-10", usuarioAlta: "Carlos Ibarra",
  },
  {
    id: "CHE-0002", origen: "TERCERO", forma: "ECHEQ", banco: "Banco Macro", numero: "E-7741002", importe: 420000, moneda: "ARS",
    parte: "Servicios del Sur SRL", fechaEmision: "2026-11-12", fechaPago: "2026-12-12", cajaId: "CAJ-001",
    estado: "EN_CUSTODIA", traza: trazaAlta("2026-11-12 11:05", "Carlos Ibarra", "EN_CUSTODIA", "Recibido en custodia"),
    fechaAlta: "2026-11-12", usuarioAlta: "Carlos Ibarra",
  },
  {
    id: "CHE-0003", origen: "TERCERO", forma: "FISICO", banco: "Banco Provincia", numero: "00921733", importe: 96500, moneda: "ARS",
    parte: "Comercial Patagonia", fechaEmision: "2026-11-13", fechaPago: "2026-12-05", cajaId: "CAJ-002",
    estado: "EN_CUSTODIA", traza: trazaAlta("2026-11-13 15:20", "Tomás Ruiz", "EN_CUSTODIA", "Recibido en custodia"),
    fechaAlta: "2026-11-13", usuarioAlta: "Tomás Ruiz",
  },
  {
    id: "CHE-0004", origen: "TERCERO", forma: "FISICO", banco: "Banco Itaú", numero: "00112908", importe: 2500, moneda: "USD",
    parte: "Andes Import SA", fechaEmision: "2026-11-09", fechaPago: "2026-12-20", cajaId: "CAJ-001",
    estado: "EN_CUSTODIA", traza: trazaAlta("2026-11-09 12:00", "Carlos Ibarra", "EN_CUSTODIA", "Recibido en custodia"),
    fechaAlta: "2026-11-09", usuarioAlta: "Carlos Ibarra",
  },
  {
    id: "CHE-0005", origen: "PROPIO", forma: "FISICO", banco: "Banco Nación", numero: "10001", importe: 310000, moneda: "ARS",
    parte: "Papelera Central SA", fechaEmision: "2026-10-28", fechaPago: "2026-11-27", cuentaId: "CB-001", chequeraId: "CHQ-001",
    referencia: "Factura 0001-00004412", estado: "ENTREGADO",
    traza: [
      { estado: "EMITIDO", usuario: "Marina Costa", fechaHora: "2026-10-28 16:00", detalle: "Emitido desde chequera CHQ-001" },
      { estado: "ENTREGADO", usuario: "Marina Costa", fechaHora: "2026-10-29 10:15", detalle: "Entregado al beneficiario" },
    ],
    fechaAlta: "2026-10-28", usuarioAlta: "Marina Costa",
  },
  {
    id: "CHE-0006", origen: "PROPIO", forma: "ECHEQ", banco: "Banco Galicia", numero: "E-0001", importe: 150000, moneda: "ARS",
    parte: "Limpieza Total SRL", fechaEmision: "2026-11-02", fechaPago: "2026-12-02", cuentaId: "CB-002", chequeraId: "CHQ-002",
    referencia: "Factura 0003-00001289", estado: "EMITIDO",
    traza: trazaAlta("2026-11-02 09:40", "Marina Costa", "EMITIDO", "Emitido desde chequera CHQ-002"),
    fechaAlta: "2026-11-02", usuarioAlta: "Marina Costa",
  },
];

// Reservas vigentes de los datos de ejemplo: los dos cheques propios todavía no debitados (su
// `operacionId` es el cheque porque no nacieron de un pago de la demo) y la transferencia PAG-0003
// preparada (ver proveedores-datos.ts).
export const RESERVAS_INICIALES: Reserva[] = [
  {
    id: "RSV-0001", origenTipo: "BANCO", origenId: "CB-001", moneda: "ARS", importe: 310000, operacionTipo: "PAGO", operacionId: "CHE-0005",
    estado: "ACTIVA", creada: { usuarioId: "carlos-ibarra", fechaHora: "2026-10-28 16:00" },
  },
  {
    id: "RSV-0002", origenTipo: "BANCO", origenId: "CB-002", moneda: "ARS", importe: 150000, operacionTipo: "PAGO", operacionId: "CHE-0006",
    estado: "ACTIVA", creada: { usuarioId: "carlos-ibarra", fechaHora: "2026-11-02 09:40" },
  },
  {
    id: "RSV-0003", origenTipo: "BANCO", origenId: "CB-001", moneda: "ARS", importe: 100000, operacionTipo: "PAGO", operacionId: "PAG-0003",
    estado: "ACTIVA", creada: { usuarioId: "ricardo-pena", fechaHora: "2026-11-17 16:30" },
  },
];

export const FERIADOS_INICIALES: Feriado[] = [
  { id: "FER-001", fecha: "2026-11-23", descripcion: "Día de la Soberanía Nacional (trasladado)", estado: "ACTIVO" },
  { id: "FER-002", fecha: "2026-12-08", descripcion: "Inmaculada Concepción de María", estado: "ACTIVO" },
  { id: "FER-003", fecha: "2026-12-25", descripcion: "Navidad", estado: "ACTIVO" },
];

export const SUCURSALES_INICIALES: Sucursal[] = [
  {
    id: "SUC-001",
    nombre: "Casa Central",
    direccion: "Av. Corrientes 1234, piso 5",
    localidad: "CABA",
    provincia: "Buenos Aires",
    codigoPostal: "C1043",
    telefono: "011 4000-1000",
    mail: "centraldeoperaciones@creditonet.demo",
    estado: "ACTIVO",
    fechaAlta: "2026-11-01",
    usuarioAlta: "Marina Costa",
  },
  {
    id: "SUC-002",
    nombre: "Sucursal Bariloche",
    direccion: "Mitre 345",
    localidad: "San Carlos de Bariloche",
    provincia: "Río Negro",
    codigoPostal: "R8400",
    telefono: "0294 442-2200",
    mail: "bariloche@creditonet.demo",
    estado: "ACTIVO",
    fechaAlta: "2026-11-01",
    usuarioAlta: "Marina Costa",
  },
  {
    id: "SUC-003",
    nombre: "Sucursal Neuquén",
    direccion: "Av. Argentina 880",
    localidad: "Neuquén",
    provincia: "Neuquén",
    codigoPostal: "Q8300",
    telefono: "0299 447-3100",
    mail: "neuquen@creditonet.demo",
    estado: "ACTIVO",
    fechaAlta: "2026-11-02",
    usuarioAlta: "Marina Costa",
  },
  {
    id: "SUC-004",
    nombre: "Sucursal Mendoza",
    direccion: "San Martín 1500",
    localidad: "Mendoza",
    provincia: "Mendoza",
    codigoPostal: "M5500",
    telefono: "0261 429-5000",
    mail: "mendoza@creditonet.demo",
    estado: "SUSPENDIDO",
    fechaAlta: "2026-11-02",
    usuarioAlta: "Marina Costa",
  },
];

export const CAJAS_INICIALES: Caja[] = [
  {
    id: "CAJ-001",
    nombre: "Tesoro central",
    sucursalId: "SUC-001",
    tipo: "TESORO_CENTRAL",
    moneda: "AMBAS",
    tesoreroId: "carlos-ibarra",
    cajeros: [{ usuarioId: "carlos-ibarra", desde: "09:00", hasta: "18:00", estado: "ACTIVO" }],
    horarioDesde: "09:00",
    horarioHasta: "18:00",
    importeMaximo: { ARS: 80000000, USD: 200000 },
    toleranciaSobrante: { ARS: 1000, USD: 5 },
    toleranciaFaltante: { ARS: 1000, USD: 5 },
    relevo: "POR_TESORO",
    frecuenciaArqueo: "MENSUAL",
    diasOperativos: [1, 2, 3, 4, 5],
    minimoOperativo: { ARS: 5000000, USD: 10000 },
    margenAlertaMin: 30,
    cuentaContable: "1.1.01.01",
    estado: "ACTIVO",
    fechaAlta: "2026-11-01",
    usuarioAlta: "Marina Costa",
  },
  {
    id: "CAJ-002",
    nombre: "Tesoro Sucursal Bariloche",
    sucursalId: "SUC-002",
    tipo: "TESORO_SUCURSAL",
    moneda: "AMBAS",
    tesoreroId: "tomas-ruiz",
    cajeros: [{ usuarioId: "tomas-ruiz", desde: "10:00", hasta: "18:00", estado: "ACTIVO" }],
    horarioDesde: "10:00",
    horarioHasta: "18:00",
    importeMaximo: { ARS: 15000000, USD: 20000 },
    toleranciaSobrante: { ARS: 1000, USD: 5 },
    toleranciaFaltante: { ARS: 1000, USD: 5 },
    relevo: "POR_TESORO",
    frecuenciaArqueo: "MENSUAL",
    diasOperativos: [1, 2, 3, 4, 5],
    minimoOperativo: { ARS: 500000, USD: 500 },
    margenAlertaMin: 30,
    cuentaContable: "1.1.01.02",
    estado: "ACTIVO",
    fechaAlta: "2026-11-01",
    usuarioAlta: "Marina Costa",
  },
  {
    id: "CAJ-003",
    nombre: "Caja 1 Sucursal Bariloche",
    sucursalId: "SUC-002",
    tipo: "CAJA_CAJERO",
    moneda: "ARS",
    tesoreroId: "",
    cajeros: [
      { usuarioId: "ana-gomez", desde: "10:00", hasta: "14:00", estado: "ACTIVO" },
      { usuarioId: "luis-pereyra", desde: "14:00", hasta: "18:00", estado: "ACTIVO" },
    ],
    horarioDesde: "10:00",
    horarioHasta: "18:00",
    importeMaximo: { ARS: 1500000, USD: 0 },
    toleranciaSobrante: { ARS: 500, USD: 0 },
    toleranciaFaltante: { ARS: 500, USD: 0 },
    relevo: "DIRECTO",
    frecuenciaArqueo: "SEMANAL",
    diasOperativos: [1, 2, 3, 4, 5],
    minimoOperativo: { ARS: 0, USD: 0 },
    margenAlertaMin: 30,
    cuentaContable: "1.1.01.03",
    estado: "ACTIVO",
    fechaAlta: "2026-11-01",
    usuarioAlta: "Marina Costa",
  },
  {
    id: "CAJ-004",
    nombre: "Fondo fijo Sucursal Bariloche",
    sucursalId: "SUC-002",
    tipo: "FONDO_FIJO",
    moneda: "ARS",
    tesoreroId: "",
    cajeros: [{ usuarioId: "tomas-ruiz", desde: "10:00", hasta: "18:00", estado: "ACTIVO" }],
    horarioDesde: "10:00",
    horarioHasta: "18:00",
    importeMaximo: { ARS: 300000, USD: 0 },
    toleranciaSobrante: { ARS: 200, USD: 0 },
    toleranciaFaltante: { ARS: 200, USD: 0 },
    relevo: "POR_TESORO",
    frecuenciaArqueo: "MENSUAL",
    diasOperativos: [1, 2, 3, 4, 5],
    minimoOperativo: { ARS: 0, USD: 0 },
    margenAlertaMin: 30,
    cuentaContable: "1.1.01.04",
    estado: "ACTIVO",
    fechaAlta: "2026-11-01",
    usuarioAlta: "Marina Costa",
  },
];

const billetes = (moneda: "ARS" | "USD", valores: number[]): Denominacion[] =>
  valores.map((valor) => ({ id: "", moneda, tipo: "BILLETE", valor, estado: "ACTIVA" }));
const monedas = (valores: number[]): Denominacion[] =>
  valores.map((valor) => ({ id: "", moneda: "ARS", tipo: "MONEDA", valor, estado: "ACTIVA" }));

export const DENOMINACIONES_INICIALES: Denominacion[] = [
  ...billetes("ARS", [20000, 10000, 2000, 1000, 500, 200, 100]),
  ...monedas([50, 25, 10, 5, 2, 1]),
  ...billetes("USD", [100, 50, 20, 10, 5, 1]),
].map((d, i) => ({ ...d, id: `DEN-${String(i + 1).padStart(3, "0")}` }));

export const MOTIVOS_DIFERENCIA_INICIALES: MotivoDiferencia[] = [
  { id: "MDC-001", descripcion: "Error de vuelto", cuentaSobrante: "4.9.01.01", cuentaFaltante: "5.9.01.01", estado: "ACTIVO" },
  { id: "MDC-002", descripcion: "Billete falso", cuentaSobrante: "4.9.01.01", cuentaFaltante: "5.9.01.02", estado: "ACTIVO" },
  { id: "MDC-003", descripcion: "Error de carga de una operación", cuentaSobrante: "4.9.01.01", cuentaFaltante: "5.9.01.01", estado: "ACTIVO" },
  { id: "MDC-004", descripcion: "Diferencia sin explicar", cuentaSobrante: "4.9.01.01", cuentaFaltante: "5.9.01.03", estado: "ACTIVO" },
];

const TESOROS: ("TESORO_CENTRAL" | "TESORO_SUCURSAL")[] = ["TESORO_CENTRAL", "TESORO_SUCURSAL"];

export const TIPOS_MOVIMIENTO_INICIALES: TipoMovimientoTesoreria[] = [
  { id: "TMT-001", descripcion: "Fondo inicial", origenes: TESOROS, destinos: ["CAJA_CAJERO", "FONDO_FIJO"], requiereAutorizacion: true, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-002", descripcion: "Pedido de refuerzo a tesoro", origenes: ["TESORO_SUCURSAL", "CAJA_CAJERO"], destinos: TESOROS, requiereAutorizacion: false, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-003", descripcion: "Refuerzo", origenes: TESOROS, destinos: ["TESORO_SUCURSAL", "CAJA_CAJERO", "FONDO_FIJO"], requiereAutorizacion: true, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-004", descripcion: "Retiro de excedente", origenes: ["CAJA_CAJERO", "TESORO_SUCURSAL"], destinos: TESOROS, requiereAutorizacion: true, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-005", descripcion: "Remesa", origenes: TESOROS, destinos: TESOROS, requiereAutorizacion: true, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-006", descripcion: "Pase entre cajeros", origenes: ["CAJA_CAJERO"], destinos: ["CAJA_CAJERO"], requiereAutorizacion: false, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-007", descripcion: "Depósito en banco", origenes: TESOROS, destinos: ["BANCO"], requiereAutorizacion: true, cuentaTransito: "1.1.02.01", estado: "ACTIVO" },
  { id: "TMT-008", descripcion: "Restitución de fondo fijo", origenes: ["TESORO_SUCURSAL"], destinos: ["FONDO_FIJO"], requiereAutorizacion: true, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  { id: "TMT-009", descripcion: "Fondo de cierre", origenes: ["CAJA_CAJERO", "FONDO_FIJO"], destinos: ["TESORO_SUCURSAL"], requiereAutorizacion: false, cuentaTransito: "1.1.02.02", estado: "ACTIVO" },
  // El tesoro pide fondos de una cuenta bancaria: se autoriza, alguien va a extraerlos y se cierra con la boleta.
  { id: "TMT-010", descripcion: "Pedido de refuerzo a banco", origenes: [], destinos: TESOROS, requiereAutorizacion: true, cuentaTransito: "1.1.02.01", origenBanco: true, estado: "ACTIVO" },
];

// Los pedidos de refuerzo no mueven dinero: el tipo "Refuerzo" es el del envío que se genera al aprobarlos.
export const TIPO_REFUERZO_ID = "TMT-003";
// El pedido a otro tesoro tiene su propia pantalla (Nuevo pedido de refuerzo); no se carga como movimiento.
export const TIPO_PEDIDO_TESORO_ID = "TMT-002";
export const TIPO_PEDIDO_BANCO_ID = "TMT-010";
// La restitución se hace contra la rendición de gastos del fondo fijo.
export const TIPO_RESTITUCION_ID = "TMT-008";

const saldoInicial = (n: number, cajaId: string, moneda: "ARS" | "USD", importe: number): MovimientoCaja => ({
  id: `LB-${String(n).padStart(4, "0")}`,
  cajaId,
  fecha: "2026-11-10",
  hora: "09:00",
  turnoUsuarioId: "carlos-ibarra",
  tipo: "Saldo inicial",
  descripcion: "Saldo inicial de la caja",
  comprobante: "SI-0001",
  moneda,
  ingreso: importe,
  egreso: 0,
  medio: "EFECTIVO",
  responsableId: "carlos-ibarra",
  estado: "CONFIRMADO",
});

export const LIBRO_INICIAL: MovimientoCaja[] = [
  saldoInicial(1, "CAJ-001", "ARS", 60000000),
  saldoInicial(2, "CAJ-001", "USD", 120000),
  saldoInicial(3, "CAJ-002", "ARS", 5000000),
  saldoInicial(4, "CAJ-002", "USD", 5000),
  saldoInicial(5, "CAJ-003", "ARS", 600000),
  saldoInicial(6, "CAJ-004", "ARS", 150000),
  // MT-0001: remesa de $ 3.000.000 del tesoro central al de Bariloche, aceptada. Mismo ID en ambos libros.
  {
    id: "LB-0007",
    cajaId: "CAJ-001",
    fecha: "2026-11-12",
    hora: "10:30",
    turnoUsuarioId: "carlos-ibarra",
    tipo: "Remesa",
    descripcion: "Remesa a Tesoro Sucursal Bariloche",
    comprobante: "MT-0001",
    moneda: "ARS",
    ingreso: 0,
    egreso: 3000000,
    medio: "EFECTIVO",
    responsableId: "carlos-ibarra",
    estado: "CONFIRMADO",
    refId: "MT-0001",
  },
  {
    id: "LB-0008",
    cajaId: "CAJ-002",
    fecha: "2026-11-12",
    hora: "15:10",
    turnoUsuarioId: "tomas-ruiz",
    tipo: "Remesa",
    descripcion: "Remesa de Tesoro central",
    comprobante: "MT-0001",
    moneda: "ARS",
    ingreso: 3000000,
    egreso: 0,
    medio: "EFECTIVO",
    responsableId: "tomas-ruiz",
    estado: "CONFIRMADO",
    refId: "MT-0001",
  },
  // Ejemplo de anulación (v4, 2.2): el cobro con el importe erróneo y su contramovimiento quedan los
  // dos en el libro, vinculados y con el motivo. Se compensan: no cambian el saldo de la caja.
  {
    id: "LB-0009",
    cajaId: "CAJ-003",
    fecha: "2026-11-12",
    hora: "11:02",
    turnoUsuarioId: "ana-gomez",
    tipo: "Cobro cuota",
    descripcion: "Cobro de cuota 4 · crédito CRED-5521",
    comprobante: "CRED-5521 cuota 4",
    moneda: "ARS",
    ingreso: 45000,
    egreso: 0,
    medio: "EFECTIVO",
    responsableId: "ana-gomez",
    estado: "ANULADO",
    anuladoPor: "LB-0010",
  },
  {
    id: "LB-0010",
    cajaId: "CAJ-003",
    fecha: "2026-11-12",
    hora: "11:15",
    turnoUsuarioId: "ana-gomez",
    tipo: "Anulación de cobro cuota",
    descripcion: "Anula LB-0009: Cobro de cuota 4 · crédito CRED-5521",
    comprobante: "CRED-5521 cuota 4",
    moneda: "ARS",
    ingreso: 0,
    egreso: 45000,
    medio: "EFECTIVO",
    responsableId: "marta-diaz",
    estado: "CONFIRMADO",
    anulaA: "LB-0009",
    motivoAnulacion: "Importe erróneo",
  },
];

export const MOVIMIENTOS_TESORERIA_INICIALES: MovimientoTesoreria[] = [
  {
    id: "MT-0001",
    tipoId: "TMT-005",
    origenId: "CAJ-001",
    destino: { tipo: "CAJA", cajaId: "CAJ-002" },
    moneda: "ARS",
    importe: 3000000,
    motivo: "Provisión de efectivo para la sucursal",
    transportista: { tipo: "EMPRESA", nombre: "Transportadora Andina", documento: "30-71234567-8" },
    precinto: "PRE-48812",
    observaciones: "",
    estado: "FINALIZADO",
    solicitanteId: "carlos-ibarra",
    fechaSolicitud: "2026-11-12 09:40",
    autorizacion: { supervisorId: "marta-diaz", fechaHora: "2026-11-12 10:05", resultado: "APROBADA", nota: "" },
    envio: { usuarioId: "carlos-ibarra", fechaHora: "2026-11-12 10:30", detalle: {}, importe: 3000000, conformidad: true, portadorConforme: true },
    recepcion: { usuarioId: "tomas-ruiz", fechaHora: "2026-11-12 15:10", detalle: {}, importe: 3000000 },
    finalizacion: { usuarioId: "tomas-ruiz", fechaHora: "2026-11-12 15:10", documento: "Acta de recepción de remesa MT-0001" },
  },
  {
    id: "MT-0002",
    tipoId: "TMT-003",
    origenId: "CAJ-002",
    destino: { tipo: "CAJA", cajaId: "CAJ-003" },
    moneda: "ARS",
    importe: 400000,
    motivo: "Refuerzo de la caja 1 para el pico de la tarde",
    precinto: "",
    observaciones: "",
    estado: "SOLICITADO",
    solicitanteId: "tomas-ruiz",
    fechaSolicitud: "2026-11-17 16:20",
  },
];

export const PEDIDOS_REFUERZO_INICIALES: PedidoRefuerzo[] = [
  {
    id: "PR-0001",
    solicitanteCajaId: "CAJ-002",
    aCajaId: "CAJ-001",
    moneda: "ARS",
    importe: 2000000,
    motivo: "Reponer efectivo del tesoro de sucursal",
    fecha: "2026-11-17",
    usuarioId: "tomas-ruiz",
    estado: "PENDIENTE",
  },
];
