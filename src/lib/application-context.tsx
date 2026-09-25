"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CHEQUEO_PENDIENTE } from "./types";
import { intentosChequeo } from "./historial";
import type {
  AccionLegajo,
  ArchivoLegajo,
  ClienteDatos,
  CreditApplication,
  DatoFinancieroCorregido,
  Observacion,
  DeudaTerceros,
  Domicilio,
  IntentoFirma,
  LaboralIngresos,
  MetodoFirma,
  Oferta,
  PantallaPostOfertaId,
  PersonaVinculada,
  Plazo,
  PostOferta,
  ReglaInstitucional,
  ResultadoChequeo,
  ResultadoFirma,
  ResultadoLimites,
  RiskResultado,
  RiskRule,
  TarjetaTokenizada,
  TipoPersona,
  TipoPersonaVinculada,
  TipoTarjeta,
} from "./types";
import {
  crearAplicacionInicial,
  consultarPersonaMock,
  obtenerCasoPorDocumento,
  precargarPostOferta,
} from "./mocks";
import { creditosSeed, ordenarPorFechaDesc, type CreditoDB } from "./creditos-db";
import {
  CAPITAL_MAXIMO_BASE,
  CAPITAL_MAXIMO_CON_PRECANCELACION,
  calcularLimites,
  conMoraCancelada,
  cambiosOfertaDe,
  observacionesDe,
  ofertaAnalistaDe,
  recalcularOferta,
} from "./credit";
import { evaluarReglas, reglaBloquea, resolverResultado, seleccionarMotor } from "./motores";
import { evaluarInstitucionales, institucionalesBloquean } from "./reglas-institucionales";
import {
  aplicarCambioCampo,
  aplicarCambioDomicilio,
  sanitizarCampoDomicilio,
  type PantallaConCampos,
} from "./campos-post-oferta";
import { fechaHoy, onlyDigits, selloTiempo } from "./format";
import { formatTelefono } from "./telefono";
import { BANCOS } from "./parametros";
import { PLANES_CUOTAS, SESION, SESION_ANALISTA, SESION_SUPERVISOR, seleccionarLinea } from "./config";
import { hidratarProductos } from "./productos";
import {
  intentoActual,
  metodoPorDefecto,
  modalidadFirma,
  puedeLiquidar,
  puedeRefirmar,
  requiereChequeoTelefonico,
} from "./firma";
import { hidratarPlanes } from "./planes";
import { hidratarOrganismos } from "./organismos";

// Plazo de la oferta dentro de la grilla del plan; si el plan no lo tiene, el primero de la grilla.
// Campos de `analista` que deja una observación nueva: la vigente y su lugar en el historial.
function conObservacion(prev: CreditApplication, observacion: Observacion) {
  return { observacion, historialObservaciones: [...observacionesDe(prev), observacion] };
}

// Firma aprobada (y, si se pidió, visto bueno del superior): sigue el chequeo telefónico si el
// producto lo exige; si no, queda para liquidar.
function pasoTrasFirma(firmada: CreditApplication, anterior: CreditApplication): CreditApplication {
  if (!requiereChequeoTelefonico(firmada.configuracion))
    return puedeLiquidar(firmada) ? { ...firmada, estado: "PARA_LIQUIDAR" } : anterior;
  return { ...firmada, estado: "CHEQUEO_TELEFONICO", chequeoTelefonico: { ...CHEQUEO_PENDIENTE, fechaInicio: selloTiempo() } };
}

function plazoValido(planId: string | null, plazo: Plazo): Plazo {
  const grilla = planId ? PLANES_CUOTAS[planId]?.grilla : undefined;
  return grilla && grilla.length > 0 && !grilla.some((f) => f.plazo === plazo)
    ? grilla[0].plazo
    : plazo;
}

// Simula el emisor que devolvería la API de tokenización a partir de un identificador estable.
function emisorMock(semilla: string): string {
  let hash = 0;
  for (const ch of semilla) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return BANCOS[hash % BANCOS.length];
}

// Estado por pestaña (sessionStorage): la solicitud abierta, el paso y la pantalla.
const STORAGE_KEY = "creditonet.demo.v22";
// Base de créditos compartida entre pestañas (localStorage, creditonet-92): permite simular al
// vendedor y al analista en pestañas distintas. El evento `storage` la sincroniza en vivo.
const DB_KEY = "creditonet.demo.db.v1";
// Aviso de "Reiniciar demo" a las demás pestañas.
const RESET_KEY = "creditonet.demo.reset.v1";

// Un registro de la DB sin los metadatos de bandeja: es lo que se abre en `app`.
function sinMeta(registro: CreditoDB): CreditApplication {
  const { _bandeja: _b, _descripcion: _d, _id: _i, ...rest } = registro;
  void _b;
  void _d;
  void _i;
  return rest as CreditApplication;
}

// Cierra la firma en curso (la última del historial) con la decisión del analista.
function cerrarIntentoActual(firmas: IntentoFirma[], resultado: ResultadoFirma): IntentoFirma[] {
  const actual = intentoActual(firmas);
  if (!actual) return firmas;
  return [...firmas.slice(0, -1), { ...actual, resultado, fechaResultado: selloTiempo() }];
}

// Referencias y garantes comparten estructura (Onboarding §7–§8).
function conPersonas(
  po: PostOferta,
  tipo: TipoPersonaVinculada,
  cambiar: (lista: PersonaVinculada[]) => PersonaVinculada[]
): PostOferta {
  return tipo === "referencia"
    ? { ...po, referencias: cambiar(po.referencias) }
    : { ...po, garantes: cambiar(po.garantes) };
}

interface EstadoPersistido {
  app: CreditApplication;
  paso: number;
  pasoMaximo: number;
  pantallaActual: PantallaPostOfertaId;
  // Sólo en sesiones anteriores a la base compartida (migración); ahora vive en DB_KEY.
  creditosDB?: CreditoDB[];
  appDbId: string | null;
}

export interface ResultadoEvaluacion {
  // Si alguna regla institucional bloqueante no pasa, la solicitud se rechaza sin ejecutar
  // el motor: motorId y resultado quedan en null y no hay reglas del motor (Motor §6).
  institucionales: ReglaInstitucional[];
  motorId: string | null;
  reglas: RiskRule[];
  resultado: RiskResultado | null;
  // Línea aplicable. Si es null, no había plan para la combinación del cliente y la
  // solicitud se rechaza sin que el motor tenga nada que ver (reunión 11/09, 02:28).
  planId: string | null;
  sinLineaMotivo: string | null;
  limites: ResultadoLimites | null;
}

// Cambio de oferta del analista (reunión 11/09, 01:14–01:35).
export interface CambioOferta {
  montoSolicitado: number;
  plazo: Plazo;
  nota: string;
}

// Cambio de datos financieros del analista (creditonet-69): a diferencia del cambio de
// oferta, estos datos pueden modificar la capacidad de endeudamiento y por eso disparan de
// nuevo el Motor de Riesgo en lugar de aplicarse tal cual.
export interface CambioDatosFinancieros {
  ingresoBruto: number;
  ingresoNeto: number;
  disponible: number;
  debitosNoRemunerativos: number;
  extraccionesImporte: number;
  transferenciasImporte: number;
  // Datos que el analista corrigió, con el valor anterior y el nuevo (para el historial).
  datos: DatoFinancieroCorregido[];
  nota: string;
}

/**
 * Reglas institucionales → Motor de riesgo → línea → límites, con los datos actuales de
 * `app` (creditonet-69). Es la misma secuencia que arma la primera evaluación
 * (PasoEvaluacion), expuesta como función pura para poder previsualizar el resultado de un
 * cambio de datos financieros antes de aplicarlo y para aplicarlo después.
 */
export function evaluarSolicitud(app: CreditApplication): ResultadoEvaluacion {
  const institucionales = evaluarInstitucionales(app, "EVALUACION");
  const rechazoInstitucional = institucionalesBloquean(institucionales);

  const { motor } = seleccionarMotor(
    app.configuracion,
    app.laboral.condicionLaboral,
    app.identificacion.tipoCliente,
    app.situaciones
  );
  const reglas = rechazoInstitucional ? [] : evaluarReglas(app, motor, app.riesgo.escenario);
  const resultado = rechazoInstitucional ? null : resolverResultado(reglas);

  const linea =
    resultado !== "PASA"
      ? { plan: null, motivo: null }
      : seleccionarLinea(app.configuracion.organismoId, {
          condicionLaboral: app.laboral.condicionLaboral,
          situacionBcra: app.situaciones?.bcra ?? 1,
          perfilInterno: app.situaciones?.interna ?? 1,
        });

  const limites = linea.plan ? calcularLimites(app, { conCancelaciones: false, plan: linea.plan }) : null;

  return {
    institucionales,
    motorId: rechazoInstitucional ? null : motor.id,
    reglas,
    resultado,
    planId: linea.plan?.id ?? null,
    sinLineaMotivo: linea.motivo,
    limites,
  };
}

interface ApplicationContextValue {
  app: CreditApplication;
  // DB simulada (src/data/creditos.json) en estado de React: se sincroniza con `app` mientras
  // haya un registro abierto, así las bandejas ven los cambios del analista/vendedor
  // (creditonet-64).
  creditosDB: CreditoDB[];
  cargarCreditoDeDB: (id: string) => void;
  paso: number;
  // Paso más avanzado alcanzado en la sesión. Volver atrás NO lo reduce: los pasos
  // posteriores siguen completos y navegables (prompt de auditoría §5–§8).
  pasoMaximo: number;
  pantallaActual: PantallaPostOfertaId;
  menuAbierto: boolean;
  hidratado: boolean;

  setPaso: (paso: number) => void;
  setPantallaActual: (id: PantallaPostOfertaId) => void;
  setMenuAbierto: (abierto: boolean) => void;

  patchApp: (patch: Partial<CreditApplication>) => void;
  setTipoPersona: (tipo: TipoPersona) => void;
  consultarCliente: (doc?: string) => void;
  patchCliente: (patch: Partial<ClienteDatos>) => void;
  patchLaboral: (patch: Partial<LaboralIngresos>) => void;
  verificarIdentidad: () => void;
  registrarFirma: (imagen: string) => void;
  borrarFirma: () => void;
  solicitar: () => void;
  finalizarRiesgo: (resultado: ResultadoEvaluacion) => void;
  // Cambio de oferta del analista: rige de inmediato y la solicitud vuelve al vendedor.
  aplicarCambioOferta: (cambio: CambioOferta) => void;
  // El supervisor autoriza un cambio de oferta por encima del límite.
  autorizarExcepcionCambioOferta: () => void;
  // Cambio de datos financieros del analista: recalcula el Motor de Riesgo de inmediato
  // (no requiere refrendación) y puede terminar en Observado (nueva oferta) o Rechazado.
  aplicarCambioDatosFinancieros: (cambio: CambioDatosFinancieros) => void;

  patchOferta: (patch: Partial<Oferta>) => void;
  togglePrecancelar: (id: string) => void;
  setDeudaTerceros: (patch: Partial<DeudaTerceros>) => void;
  aceptarOferta: () => void;
  irAPostOferta: () => void;

  setCampo: (pantalla: PantallaConCampos, campoId: string, valor: string) => void;
  enviarLinkWhatsApp: () => void;
  simularCompletaCliente: (tarjetaId: string) => void;
  tokenizarPresencial: (datos: {
    tipo: TipoTarjeta;
    marca: string;
    numero: string;
    nombreTitular: string;
    vencimiento: string;
    cvv?: string;
  }) => void;
  confirmarTarjetaGuardada: (tarjetaId: string) => void;
  quitarTarjeta: (tarjetaId: string) => void;
  agregarPersona: (tipo: TipoPersonaVinculada) => void;
  actualizarPersona: (
    tipo: TipoPersonaVinculada,
    id: string,
    patch: Partial<PersonaVinculada>
  ) => void;
  actualizarDomicilioPersona: (
    tipo: TipoPersonaVinculada,
    id: string,
    campo: keyof Domicilio,
    valor: string
  ) => void;
  buscarPersonaPorDni: (tipo: TipoPersonaVinculada, id: string) => void;
  quitarPersona: (tipo: TipoPersonaVinculada, id: string) => void;
  adjuntarReciboSueldo: (tipo: TipoPersonaVinculada, id: string) => void;
  quitarReciboSueldo: (tipo: TipoPersonaVinculada, id: string, archivoId: string) => void;
  adjuntarOtroDocumento: (tipo: TipoPersonaVinculada, id: string) => void;
  quitarOtroDocumento: (tipo: TipoPersonaVinculada, id: string, archivoId: string) => void;
  adjuntarDocumento: (tipoId: string) => void;
  quitarArchivo: (tipoId: string, archivoId: string) => void;
  registrarLegajo: (accion: AccionLegajo) => void;
  visitarPantalla: (id: PantallaPostOfertaId) => void;
  finalizarCarga: () => void;

  tomarAnalisis: () => void;
  confirmarObservacion: () => void;
  observarCredito: (
    motivo: string,
    nota: string,
    pantallas: PantallaPostOfertaId[],
    campos: Partial<Record<PantallaPostOfertaId, string[]>>
  ) => void;
  anularCredito: (nota: string) => void;
  agregarComentario: (texto: string, autor?: string) => void;
  soltarAnalisis: () => void;
  retomarObservada: () => void;
  // El vendedor acepta la oferta del analista (o una menor de la grilla): sólo queda finalizar.
  aceptarOfertaAnalista: () => void;
  guardarCorreccion: (pantalla: PantallaPostOfertaId) => void;
  reabrirCorreccion: (pantalla: PantallaPostOfertaId) => void;
  rechazarCredito: (codigo: string, motivo: string, observacion: string) => void;
  // Aprobar abre el tramo de firma (FEL/AFEL); con modalidad "Ambas" se elige el método.
  aprobarCredito: (metodo?: MetodoFirma) => void;
  // Aprueba sin pasar todavía a firma (estado intermedio opcional, creditonet-87).
  dejarAprobado: () => void;
  registrarFirmaCliente: () => void;
  // AFEL: el analista revisó la firma con "Ver firma" y la confirma o la rechaza (creditonet-93).
  confirmarChequeoFirma: () => void;
  verificarFirma: () => void;
  // AFEL → SUP: pide la aprobación de un superior; `aprobarSuperior` la da y sigue el flujo.
  enviarASuperior: () => void;
  aprobarSuperior: () => void;
  solicitarRefirma: () => void;
  // Chequeo telefónico (bandeja del chequeador).
  tomarChequeo: () => void;
  soltarChequeo: () => void;
  finalizarChequeo: (resultado: ResultadoChequeo, comentario: string) => void;
  // Deja el chequeo observado (no se pudo completar) y lo suelta: el canal de venta lo ve.
  observarChequeo: (nota: string) => void;

  reiniciarDemo: () => void;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<CreditApplication>(() => crearAplicacionInicial());
  const [paso, setPasoState] = useState(1);
  const [pasoMaximo, setPasoMaximo] = useState(1);
  const [pantallaActual, setPantallaActual] = useState<PantallaPostOfertaId>("personales");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [hidratado, setHidratado] = useState(false);
  // DB simulada mutable + qué registro está abierto en `app` (null = solicitud nueva, no
  // sembrada desde el JSON). `creditosDBBase` es lo último confirmado; mientras `app` esté
  // ligado a un registro (`appDbId`), la vista expuesta a las bandejas superpone `app` sobre
  // ese registro sin pasar por un efecto — evita el "setState dentro de un efecto" y refleja
  // cada cambio de `app` sin tener que enganchar cada acción del analista/vendedor
  // (creditonet-64).
  const [creditosDBBase, setCreditosDBBase] = useState<CreditoDB[]>(() => creditosSeed());
  const [appDbId, setAppDbId] = useState<string | null>(null);
  const creditosDB = useMemo(() => {
    // Un crédito generado en la demo no viene del JSON (appDbId null) pero, una vez que tiene
    // número, se identifica por él: se superpone si ya es un registro o se agrega como uno nuevo.
    const idActivo = appDbId ?? app.numeroCredito;
    if (idActivo === null) return creditosDBBase;
    const idx = creditosDBBase.findIndex((c) => c._id === idActivo);
    if (idx === -1) {
      if (appDbId !== null) return creditosDBBase;
      const nuevo: CreditoDB = {
        ...app,
        _bandeja: "vendedor",
        _descripcion: "Generado en esta demo",
        _id: idActivo,
      };
      return ordenarPorFechaDesc([...creditosDBBase, nuevo]);
    }
    const next = [...creditosDBBase];
    next[idx] = { ...creditosDBBase[idx], ...app };
    return ordenarPorFechaDesc(next);
  }, [creditosDBBase, appDbId, app]);
  // Copia siempre al día de `creditosDB` para leer en callbacks sin agregarlo a sus
  // dependencias (evita recrearlos en cada cambio de `app`).
  const creditosDBRef = useRef(creditosDB);
  useEffect(() => {
    creditosDBRef.current = creditosDB;
  }, [creditosDB]);

  const reinicioLocal = useCallback(() => {
    // Reinicio total: la bandeja vuelve al JSON base (se descartan los cambios de la
    // sesión) y la solicitud en curso se suelta. Como el estado se persiste en
    // sessionStorage, el reset queda firme ante recargas.
    setCreditosDBBase(creditosSeed());
    setApp(crearAplicacionInicial());
    setPasoState(1);
    setPasoMaximo(1);
    setPantallaActual("personales");
    setMenuAbierto(false);
    // La demo nueva no está ligada a ningún registro de la DB simulada.
    setAppDbId(null);
  }, []);

  // Sincronización entre pestañas (creditonet-92). `ultimoDB` es la última base escrita o leída
  // del storage: evita reescribir lo mismo y que dos pestañas se rebotan cambios sin fin.
  const appRef = useRef(app);
  const appDbIdRef = useRef(appDbId);
  const ultimoDB = useRef<string | null>(null);
  useEffect(() => {
    appRef.current = app;
    appDbIdRef.current = appDbId;
  }, [app, appDbId]);

  // Otra pestaña cambió la base: se toma tal cual y, si esta pestaña tiene abierto uno de esos
  // créditos, se abre su versión nueva (si no, el próximo cambio local pisaría el ajeno).
  const aplicarDBExterna = useCallback((lista: CreditoDB[]) => {
    setCreditosDBBase(lista);
    const id = appDbIdRef.current ?? appRef.current.numeroCredito;
    const registro = id === null ? undefined : lista.find((c) => c._id === id);
    if (!registro) return;
    const nueva = sinMeta(registro);
    setApp((prev) => (JSON.stringify(prev) === JSON.stringify(nueva) ? prev : nueva));
  }, []);

  // Durante el chequeo telefónico el crédito lo gestiona sólo el chequeador: ni el analista ni
  // el canal de venta pueden operarlo desde su bandeja (sólo verlo).
  const setAppOperativo = useCallback((actualizar: (prev: CreditApplication) => CreditApplication) => {
    setApp((prev) => (prev.estado === "CHEQUEO_TELEFONICO" ? prev : actualizar(prev)));
  }, []);

  // Navegar hacia atrás sólo mueve el paso actual. El máximo alcanzado nunca baja, por eso
  // los pasos posteriores conservan su tilde y siguen siendo navegables.
  const setPaso = useCallback((n: number) => {
    setPasoState(n);
    setPasoMaximo((max) => Math.max(max, n));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      // La configuración de los productos (ABM) se hidrata antes que la solicitud: el flujo
      // sólo se muestra cuando `hidratado` es true, así que nunca lee valores desactualizados.
      hidratarProductos();
      hidratarPlanes();
      hidratarOrganismos();
      try {
        // La base compartida manda sobre la de la sesión: la otra pestaña pudo haberla cambiado.
        let dbCompartida: CreditoDB[] | null = null;
        const rawDb = localStorage.getItem(DB_KEY);
        if (rawDb) {
          const lista = JSON.parse(rawDb);
          if (Array.isArray(lista)) {
            dbCompartida = lista as CreditoDB[];
            ultimoDB.current = rawDb;
          }
        }
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<EstadoPersistido> & { app: any };
          if (parsed.app) {
            const appPersistida = parsed.app as CreditApplication & {
              laboral?: Record<string, unknown>;
            };
            const lab: any = appPersistida.laboral;
            if (lab && !Array.isArray(lab.empleadores)) {
              const bancos: string[] = Array.isArray(lab.bancosCobro) ? lab.bancosCobro : [];
              const cuits: string[] = Array.isArray(lab.cuitsEmpleador) ? lab.cuitsEmpleador : [];
              const max = Math.max(bancos.length, cuits.length, 1);
              const empleadores = Array.from({ length: max }, (_, i) => ({
                banco: bancos[i] ?? bancos[0] ?? "",
                cuit: cuits[i] ?? "",
                razonSocial: "",
              })).filter((e, idx, arr) => arr.length === 1 || e.banco || e.cuit || e.razonSocial);
              (appPersistida.laboral as unknown as { empleadores: typeof empleadores }).empleadores = empleadores;
              delete lab.bancosCobro;
              delete lab.cuitsEmpleador;
            } else if (lab && Array.isArray(lab.empleadores)) {
              lab.empleadores = lab.empleadores.map((e: any) => ({
                banco: e.banco ?? "",
                cuit: e.cuit ?? "",
                razonSocial: e.razonSocial ?? "",
              }));
            }
            const idActivo = parsed.appDbId ?? appPersistida.numeroCredito;
            const enDB = idActivo === null ? undefined : dbCompartida?.find((c) => c._id === idActivo);
            setApp(enDB ? sinMeta(enDB) : (appPersistida as CreditApplication));
          }
          if (typeof parsed.paso === "number") setPasoState(parsed.paso);
          if (typeof parsed.pasoMaximo === "number") setPasoMaximo(parsed.pasoMaximo);
          if (parsed.pantallaActual) setPantallaActual(parsed.pantallaActual);
          if (!dbCompartida && Array.isArray(parsed.creditosDB)) setCreditosDBBase(parsed.creditosDB);
          if (parsed.appDbId !== undefined) setAppDbId(parsed.appDbId);
        }
        if (dbCompartida) setCreditosDBBase(dbCompartida);
      } catch {
        /* demo sin persistencia si el storage no está disponible */
      } finally {
        setHidratado(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          app,
          paso,
          pasoMaximo,
          pantallaActual,
          appDbId,
        } satisfies EstadoPersistido)
      );
    } catch {
      /* noop */
    }
  }, [app, paso, pasoMaximo, pantallaActual, appDbId, hidratado]);

  // La base de créditos se comparte con las demás pestañas.
  useEffect(() => {
    if (!hidratado) return;
    try {
      const texto = JSON.stringify(creditosDB);
      if (texto === ultimoDB.current) return;
      ultimoDB.current = texto;
      localStorage.setItem(DB_KEY, texto);
    } catch {
      /* noop */
    }
  }, [creditosDB, hidratado]);

  // Cambios que llegan de otras pestañas. `storage` no se dispara en la pestaña que escribe.
  useEffect(() => {
    if (!hidratado) return;
    const alRecibir = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key === RESET_KEY) {
        reinicioLocal();
        return;
      }
      if (e.key !== DB_KEY || !e.newValue || e.newValue === ultimoDB.current) return;
      try {
        const lista = JSON.parse(e.newValue);
        if (!Array.isArray(lista)) return;
        ultimoDB.current = e.newValue;
        aplicarDBExterna(lista as CreditoDB[]);
      } catch {
        /* noop */
      }
    };
    window.addEventListener("storage", alRecibir);
    return () => window.removeEventListener("storage", alRecibir);
    // reinicioLocal es estable (useCallback sin dependencias).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, aplicarDBExterna]);

  // Abre un crédito de la DB simulada en `app` y recuerda de qué registro vino, para que los
  // cambios posteriores (observar, rechazar, aprobar, tomar análisis, etc.) se reflejen ahí.
  // Antes de soltar el registro anterior, confirma su estado más reciente en la base — si no,
  // el próximo cambio de `app` (que ya representa OTRO crédito) dejaría de superponerse sobre
  // él y esos cambios se perderían.
  const cargarCreditoDeDB = useCallback((id: string) => {
    const registro = creditosDBRef.current.find((c) => c._id === id);
    if (!registro) return;
    setCreditosDBBase(creditosDBRef.current);
    setApp(sinMeta(registro));
    setAppDbId(id);
  }, []);

  /**
   * Recalcula la oferta con la selección actual de precancelaciones (Plan §9).
   *
   * La precancelación es posterior a la primera oferta: marcar un crédito propio libera su
   * cuota, sube la cuota máxima y con ella el capital. Los límites de la primera oferta
   * (`riesgo.limites` y `capitalMaximoBase`) no se tocan; sólo cambia el capital con
   * cancelaciones, que `recalcularOferta` usa mientras haya algún crédito marcado.
   */
  function aplicarLimites(app: CreditApplication): CreditApplication {
    if (app.riesgo.estado !== "COMPLETO" || app.riesgo.resultado !== "PASA") return app;
    if (app.riesgo.planId === null) return app;
    const conCancelaciones = calcularLimites(app, { conCancelaciones: true });
    const oferta = recalcularOferta({
      ...app.oferta,
      capitalMaximoRenovacion: conCancelaciones.capitalConsiderado,
    });
    const cambioCapital = oferta.capitalMaximoActual !== app.oferta.capitalMaximoActual;
    return {
      ...app,
      oferta: recalcularOferta({
        ...oferta,
        // Si la cancelación mueve el capital máximo se arma una nueva oferta sobre ese capital
        // y con el importe se recalculan todas las cuotas. Si no lo mueve, se respeta el
        // importe elegido, sin superar nunca el máximo.
        montoSolicitado: cambioCapital
          ? oferta.capitalMaximoActual
          : Math.min(app.oferta.montoSolicitado, oferta.capitalMaximoActual),
      }),
    };
  }

  const patchApp = useCallback((patch: Partial<CreditApplication>) => {
    setApp((prev) => ({ ...prev, ...patch }));
  }, []);

  const setTipoPersona = useCallback((tipoPersona: TipoPersona) => {
    setApp((prev) => ({ ...prev, tipoPersona }));
  }, []);

  const consultarCliente = useCallback((doc?: string) => {
    setApp((prev) => {
      const docBuscar = doc ?? prev.identificacion.documento;
      const caso = obtenerCasoPorDocumento(docBuscar);

      // Los créditos en mora entran solos en la renovación desde la primera oferta.
      const baseCreditos = conMoraCancelada(caso.creditosActivos.map((c) => ({ ...c })));
      const tienePrecancelacion = baseCreditos.some((c) => c.precancelar);
      const capMax = tienePrecancelacion
        ? CAPITAL_MAXIMO_CON_PRECANCELACION
        : CAPITAL_MAXIMO_BASE;

      const nuevaOferta = recalcularOferta({
        planId: null,
        capitalMaximoBase: CAPITAL_MAXIMO_BASE,
        capitalMaximoRenovacion: CAPITAL_MAXIMO_CON_PRECANCELACION,
        capitalMaximoActual: capMax,
        montoSolicitado: capMax,
        plazo: 12,
        tna: 58,
        valorCuota: 0,
        totalAPagar: 0,
        primeraCuotaVencimiento: "10/10/2026",
        creditosActivos: baseCreditos,
        deudaTerceros: { ...caso.deudaTerceros },
        aceptada: false,
      });

      return {
        ...prev,
        cliente: { ...caso.datos },
        origenCampos: { ...caso.origen },
        numeroCliente: caso.numeroCliente,
        situaciones: { ...caso.situaciones },
        identificacion: {
          ...prev.identificacion,
          documento: caso.datos.dni,
          consultado: true,
          tipoCliente: caso.tipoCliente,
          firmaRegistrada: null,
        },
        laboral: { ...caso.laboral },
        oferta: nuevaOferta,
        rechazo: null,
        riesgo: {
          ...prev.riesgo,
          estado: "PENDIENTE",
          resultado: null,
          escenario: caso.escenarioMotorDefault,
        },
      };
    });
  }, []);

  const patchCliente = useCallback((patch: Partial<ClienteDatos>) => {
    setApp((prev) => {
      if (!prev.cliente) return prev;
      const origenCampos = { ...prev.origenCampos };
      (Object.keys(patch) as (keyof ClienteDatos)[]).forEach((k) => {
        origenCampos[k] = "Manual";
      });
      return { ...prev, cliente: { ...prev.cliente, ...patch }, origenCampos };
    });
  }, []);

  const patchLaboral = useCallback((patch: Partial<LaboralIngresos>) => {
    setApp((prev) => ({ ...prev, laboral: { ...prev.laboral, ...patch } }));
  }, []);

  // Registro de firma del cliente nuevo (referencia para comparar la firma física del legajo).
  const registrarFirma = useCallback((imagen: string) => {
    setApp((prev) => ({
      ...prev,
      identificacion: { ...prev.identificacion, firmaRegistrada: { imagen, fecha: selloTiempo() } },
    }));
  }, []);

  const borrarFirma = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      identificacion: { ...prev.identificacion, firmaRegistrada: null },
    }));
  }, []);

  const verificarIdentidad = useCallback(() => {
    setApp((prev) => ({ ...prev, identidadVerificada: true }));
  }, []);

  // "Solicitar" (Guía §8): genera el ID de Crédito inalterable y la solicitud pasa a En trámite.
  const solicitar = useCallback(() => {
    // Número siguiente al más alto de la DB simulada: uno fijo choca con un registro existente
    // y el crédito nuevo queda invisible en las bandejas (creditonet-64).
    const maxNumero = creditosDBRef.current.reduce(
      (m, c) => Math.max(m, Number((c.numeroCredito ?? "").replace(/\D/g, "")) || 0),
      0
    );
    const nuevoNumero = `CR-${String(maxNumero + 1).padStart(6, "0")}`;
    setApp((prev) => ({
      ...prev,
      numeroCredito: prev.numeroCredito ?? nuevoNumero,
      numeroCliente:
        prev.numeroCliente ??
        (prev.identificacion.tipoCliente === "NUEVO" ? "001450" : "000928"),
      estado: "EN_TRAMITE",
      fechaSolicitud: prev.fechaSolicitud ?? fechaHoy(),
      riesgo: { ...prev.riesgo, estado: "EVALUANDO" },
    }));
  }, []);

  const finalizarRiesgo = useCallback((ev: ResultadoEvaluacion) => {
    setApp((prev) => {
      // Orden del flujo: reglas institucionales → motor → línea (Arquitectura §2).
      const rechazoInstitucional = institucionalesBloquean(ev.institucionales);
      const rechazadoPorMotor = !rechazoInstitucional && ev.resultado === "NO_PASA";
      const sinLinea = !rechazoInstitucional && !rechazadoPorMotor && ev.planId === null;
      const rechazado = rechazoInstitucional || rechazadoPorMotor || sinLinea;
      const detalle = (reglas: { nombre: string; valorEvaluado: string }[]) =>
        reglas.map((r) => `${r.nombre}: ${r.valorEvaluado}`).join(" · ");
      const institucionalesNoPasan = ev.institucionales.filter(reglaBloquea);
      const motorNoPasan = ev.reglas.filter(reglaBloquea);

      const siguiente: CreditApplication = {
        ...prev,
        estado: rechazado ? "RECHAZADO" : prev.estado,
        rechazo: rechazoInstitucional
          ? {
              origen: "INSTITUCIONAL",
              codigos: institucionalesNoPasan.map((r) => r.codigo),
              motivo: "Regla institucional bloqueante no superada",
              observacion: detalle(institucionalesNoPasan),
              fecha: fechaHoy(),
            }
          : rechazadoPorMotor
            ? {
                origen: "MOTOR",
                codigos: motorNoPasan.map((r) => r.codigo),
                motivo: "Regla bloqueante del motor de riesgo no superada",
                observacion: detalle(motorNoPasan),
                fecha: fechaHoy(),
              }
            : sinLinea
              ? {
                  origen: "SIN_LINEA",
                  codigos: ["LN-01"],
                  motivo: "Sin línea disponible para la combinación del cliente",
                  observacion: ev.sinLineaMotivo ?? "",
                  fecha: fechaHoy(),
                }
              : null,
        // La primera oferta se arma con el límite más restrictivo, sin cancelaciones.
        oferta:
          rechazado || !ev.limites
            ? prev.oferta
            : recalcularOferta({
                ...prev.oferta,
                // La oferta se arma con la grilla y el sistema del plan elegido; si el plazo
                // que traía no existe en su grilla, se pasa al primero.
                planId: ev.planId,
                plazo: plazoValido(ev.planId, prev.oferta.plazo),
                capitalMaximoBase: ev.limites.capitalConsiderado,
                capitalMaximoRenovacion: ev.limites.capitalConsiderado,
                montoSolicitado: ev.limites.capitalConsiderado,
              }),
        riesgo: {
          ...prev.riesgo,
          estado: "COMPLETO",
          motorId: ev.motorId,
          reglas: ev.reglas,
          institucionales: ev.institucionales,
          resultado: ev.resultado,
          planId: ev.planId,
          limites: ev.limites,
          evaluadoCon: {
            ingresoNeto: prev.laboral.ingresoNeto,
            fechaNacimiento: prev.cliente?.fechaNacimiento ?? "",
            genero: prev.cliente?.genero ?? "",
          },
          fecha: selloTiempo(),
        },
      };
      // Si ya había créditos marcados (se volvió a evaluar desde la oferta), la selección se
      // conserva y se reaplica sobre la primera oferta nueva.
      return rechazado ? siguiente : aplicarLimites(siguiente);
    });
  }, []);

  /**
   * El analista corrige la oferta y la devuelve al canal de venta (reunión 11/09, 01:14–01:35).
   *
   * Puede tocar el capital, el plazo y los sueldos que el vendedor cargó mal; la cuota se
   * recalcula sola. El crédito vuelve al vendedor en estado Observado con el nuevo importe:
   * "el analista dice un millón, se lo devuelve al pedido; va al vendedor, me viene observado".
   */
  // El cambio rige apenas lo confirma el analista: el vendedor lo ve directo, sin refrendación.
  const aplicarCambioOferta = useCallback((cambio: CambioOferta) => {
    setAppOperativo((prev) => {
      return {
        ...prev,
        estado: "OBSERVADO",
        oferta: recalcularOferta({
          ...prev.oferta,
          montoSolicitado: cambio.montoSolicitado,
          plazo: cambio.plazo,
          aceptada: false,
        }),
        analista: {
          ...prev.analista,
          tomado: false,
          reenviada: false,
          pantallasCorregidas: [],
          ofertaAnalista: {
            montoSolicitado: cambio.montoSolicitado,
            plazo: cambio.plazo,
            nota: cambio.nota,
          },
          historialCambiosOferta: [
            ...cambiosOfertaDe(prev),
            {
              tipo: "OFERTA",
              fecha: selloTiempo(),
              montoAnterior: prev.oferta.montoSolicitado,
              plazoAnterior: prev.oferta.plazo,
              montoNuevo: cambio.montoSolicitado,
              plazoNuevo: cambio.plazo,
              nota: cambio.nota,
              autor: SESION_ANALISTA.nombre,
            },
          ],
          ...conObservacion(prev, {
            motivo: "Cambio de oferta del analista",
            nota: cambio.nota,
            fecha: fechaHoy(),
            pantallas: [],
          }),
        },
      };
    });
  }, []);

  const autorizarExcepcionCambioOferta = useCallback(() => {
    setAppOperativo((prev) => ({
      ...prev,
      analista: {
        ...prev.analista,
        excepcionCambioOferta: {
          n: cambiosOfertaDe(prev).length,
          autorizadoPor: SESION_SUPERVISOR.nombre,
          fecha: selloTiempo(),
        },
      },
    }));
  }, []);

  /**
   * Cambio de datos financieros del analista (creditonet-69): a diferencia del cambio de
   * oferta, estos datos pueden modificar la capacidad de endeudamiento, así que en vez de
   * aplicarse tal cual disparan de nuevo la secuencia completa de evaluación
   * (institucionales → Motor de Riesgo → línea → límites). Rige de inmediato, sin
   * refrendación: si la nueva evaluación pasa, la solicitud queda Observada con la oferta
   * que resulte de los nuevos límites; si no pasa, queda Rechazada.
   */
  const aplicarCambioDatosFinancieros = useCallback((cambio: CambioDatosFinancieros) => {
    setAppOperativo((prev) => {
      const nuevoLaboral = {
        ...prev.laboral,
        ingresoBruto: cambio.ingresoBruto,
        ingresoNeto: cambio.ingresoNeto,
        disponible: cambio.disponible,
        debitosNoRemunerativos: cambio.debitosNoRemunerativos,
        extraccionesImporte: cambio.extraccionesImporte,
        transferenciasImporte: cambio.transferenciasImporte,
      };
      const ev = evaluarSolicitud({ ...prev, laboral: nuevoLaboral });

      const rechazoInstitucional = institucionalesBloquean(ev.institucionales);
      const rechazadoPorMotor = !rechazoInstitucional && ev.resultado === "NO_PASA";
      const sinLinea = !rechazoInstitucional && !rechazadoPorMotor && ev.planId === null;
      const rechazado = rechazoInstitucional || rechazadoPorMotor || sinLinea;

      const detalle = (reglas: { nombre: string; valorEvaluado: string }[]) =>
        reglas.map((r) => `${r.nombre}: ${r.valorEvaluado}`).join(" · ");
      const institucionalesNoPasan = ev.institucionales.filter(reglaBloquea);
      const motorNoPasan = ev.reglas.filter(reglaBloquea);

      const base: CreditApplication = {
        ...prev,
        laboral: nuevoLaboral,
        riesgo: {
          ...prev.riesgo,
          estado: "COMPLETO",
          motorId: ev.motorId,
          reglas: ev.reglas,
          institucionales: ev.institucionales,
          resultado: ev.resultado,
          planId: ev.planId,
          limites: ev.limites,
          evaluadoCon: {
            ingresoNeto: nuevoLaboral.ingresoNeto,
            fechaNacimiento: prev.cliente?.fechaNacimiento ?? "",
            genero: prev.cliente?.genero ?? "",
          },
          fecha: selloTiempo(),
        },
      };

      if (rechazado) {
        return {
          ...base,
          estado: "RECHAZADO",
          rechazo: {
            origen: "ANALISTA",
            codigos: rechazoInstitucional
              ? institucionalesNoPasan.map((r) => r.codigo)
              : rechazadoPorMotor
                ? motorNoPasan.map((r) => r.codigo)
                : ["LN-01"],
            motivo: "Cambio de datos financieros: la nueva evaluación no pasa",
            observacion: rechazoInstitucional
              ? detalle(institucionalesNoPasan)
              : rechazadoPorMotor
                ? detalle(motorNoPasan)
                : (ev.sinLineaMotivo ?? ""),
            fecha: fechaHoy(),
          },
          analista: {
            ...prev.analista,
            observacion: {
              motivo: "Cambio de datos financieros del analista",
              nota: cambio.nota,
              fecha: fechaHoy(),
              pantallas: [],
            },
          },
        };
      }

      const ofertaNueva = recalcularOferta({
        ...prev.oferta,
        planId: ev.planId,
        plazo: plazoValido(ev.planId, prev.oferta.plazo),
        capitalMaximoBase: ev.limites!.capitalConsiderado,
        capitalMaximoRenovacion: ev.limites!.capitalConsiderado,
        montoSolicitado: ev.limites!.capitalConsiderado,
        aceptada: false,
      });

      return aplicarLimites({
        ...base,
        estado: "OBSERVADO",
        oferta: ofertaNueva,
        analista: {
          ...prev.analista,
          tomado: false,
          reenviada: false,
          pantallasCorregidas: [],
          cambioOfertaPendiente: null,
          ofertaAnalista: {
            montoSolicitado: ofertaNueva.montoSolicitado,
            plazo: ofertaNueva.plazo,
            nota: cambio.nota,
          },
          historialCambiosOferta: [
            ...cambiosOfertaDe(prev),
            {
              tipo: "DATOS_FINANCIEROS",
              datos: cambio.datos,
              fecha: selloTiempo(),
              montoAnterior: prev.oferta.montoSolicitado,
              plazoAnterior: prev.oferta.plazo,
              montoNuevo: ofertaNueva.montoSolicitado,
              plazoNuevo: ofertaNueva.plazo,
              nota: cambio.nota,
              autor: SESION_ANALISTA.nombre,
            },
          ],
          ...conObservacion(prev, {
            motivo: "Cambio de datos financieros del analista",
            nota: cambio.nota,
            fecha: fechaHoy(),
            // Tras aceptar la nueva oferta, quedan habilitados el legajo virtual (subir más
            // documentación, ver el legajo e imprimir el formulario) y, aparte, la pantalla de
            // impresión del legajo (ver PostOfertaShell).
            pantallas: ["legajo"],
          }),
        },
      });
    });
  }, []);

  const patchOferta = useCallback((patch: Partial<Oferta>) => {
    setApp((prev) => ({ ...prev, oferta: recalcularOferta({ ...prev.oferta, ...patch }) }));
  }, []);

  const togglePrecancelar = useCallback((id: string) => {
    setApp((prev) =>
      aplicarLimites({
        ...prev,
        oferta: recalcularOferta({
          ...prev.oferta,
          creditosActivos: prev.oferta.creditosActivos.map((c) =>
            // Un crédito en mora no se puede sacar de la renovación.
            c.id === id && !c.enMora ? { ...c, precancelar: !c.precancelar } : c
          ),
        }),
      })
    );
  }, []);

  const setDeudaTerceros = useCallback((patch: Partial<DeudaTerceros>) => {
    setApp((prev) => {
      const actual = { ...prev.oferta.deudaTerceros, ...patch };
      return aplicarLimites({
        ...prev,
        oferta: recalcularOferta({
          ...prev.oferta,
          deudaTerceros: { ...actual, importe: Math.max(0, actual.importe) },
        }),
      });
    });
  }, []);

  // El cliente acepta la oferta y arranca la carga post-oferta. La solicitud sigue
  // En trámite: recién al finalizar la carga queda preaprobada (reunión 11/09, 01:03:29).
  const aceptarOferta = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      oferta: { ...prev.oferta, aceptada: true },
      etapa: "TRANSICION",
    }));
  }, []);

  const irAPostOferta = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      etapa: "POST_OFERTA",
      // La primera vez se precarga la carga; si ya existe, se conserva lo cargado.
      postOferta:
        Object.keys(prev.postOferta.precarga).length > 0
          ? prev.postOferta
          : precargarPostOferta(prev),
    }));
  }, []);

  // --- Pantallas de datos (Onboarding §4–§5) ---

  const setCampo = useCallback((pantalla: PantallaConCampos, campoId: string, valor: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        [pantalla]: aplicarCambioCampo(prev.postOferta[pantalla], campoId, valor),
      },
    }));
  }, []);

  // --- Tokenización (Onboarding §6) ---

  // El link del formulario se comparte por WhatsApp al celular precargado: WhatsApp no es una
  // integración del flujo, sólo el medio para compartirlo.
  const enviarLinkWhatsApp = useCallback(() => {
    setApp((prev) => {
      const p = prev.postOferta.personales;
      const tarjeta: TarjetaTokenizada = {
        id: `tarjeta-${Date.now()}`,
        via: "WHATSAPP",
        estado: "ESPERANDO_CLIENTE",
        enviadoA: formatTelefono(
          p["telefono.pais"] ?? "",
          p["telefono.caracteristica"] ?? "",
          p["telefono.numero"] ?? ""
        ),
        tipo: null,
        marca: null,
        nombreTitular: null,
        primeros4: null,
        ultimos4: null,
        vencimiento: null,
        emisor: null,
        fechaTokenizacion: null,
        token: null,
        numeroCompleto: null,
        cvv: null,
      };
      return {
        ...prev,
        postOferta: { ...prev.postOferta, tarjetas: [...prev.postOferta.tarjetas, tarjeta] },
      };
    });
  }, []);

  const simularCompletaCliente = useCallback((tarjetaId: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        tarjetas: prev.postOferta.tarjetas.map((t) =>
          t.id === tarjetaId
            ? {
                ...t,
                estado: "TOKENIZADA",
                tipo: "DEBITO",
                marca: "Visa",
                primeros4: "4509",
                ultimos4: "4821",
                vencimiento: "11/29",
                emisor: emisorMock(tarjetaId),
                fechaTokenizacion: selloTiempo(),
                token: `tok_demo_${tarjetaId.slice(-6).toUpperCase()}`,
                numeroCompleto: "4509953566234821",
                cvv: "123",
              }
            : t
        ),
      },
    }));
  }, []);

  const tokenizarPresencial = useCallback(
    (datos: {
      tipo: TipoTarjeta;
      marca: string;
      numero: string;
      nombreTitular: string;
      vencimiento: string;
      cvv?: string;
    }) => {
      setApp((prev) => {
        const id = `tarjeta-${Date.now()}`;
        const digitos = onlyDigits(datos.numero);
        const tarjeta: TarjetaTokenizada = {
          id,
          via: "PRESENCIAL",
          estado: "TOKENIZADA",
          enviadoA: null,
          tipo: datos.tipo,
          marca: datos.marca,
          nombreTitular: datos.nombreTitular,
          primeros4: digitos.slice(0, 4),
          ultimos4: digitos.slice(-4),
          vencimiento: datos.vencimiento,
          emisor: emisorMock(id),
          fechaTokenizacion: selloTiempo(),
          token: `tok_demo_${id.slice(-6).toUpperCase()}`,
          numeroCompleto: digitos,
          cvv: datos.cvv ? onlyDigits(datos.cvv) : null,
        };
        return {
          ...prev,
          postOferta: { ...prev.postOferta, tarjetas: [...prev.postOferta.tarjetas, tarjeta] },
        };
      });
    },
    []
  );

  const quitarTarjeta = useCallback((tarjetaId: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        tarjetas: prev.postOferta.tarjetas.filter((t) => t.id !== tarjetaId),
      },
    }));
  }, []);

  // El vendedor confirma que la tarjeta guardada de un trámite anterior sigue siendo correcta.
  const confirmarTarjetaGuardada = useCallback((tarjetaId: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        tarjetas: prev.postOferta.tarjetas.map((t) =>
          t.id === tarjetaId ? { ...t, verificada: true } : t
        ),
      },
    }));
  }, []);

  // --- Referencias y garantes (Onboarding §7–§8) ---

  const agregarPersona = useCallback((tipo: TipoPersonaVinculada) => {
    setApp((prev) => ({
      ...prev,
      postOferta: conPersonas(prev.postOferta, tipo, (lista) => [
        ...lista,
        {
          id: `${tipo}-${Date.now()}`,
          vinculo: "",
          dni: "",
          nombre: "",
          apellido: "",
          domicilio: {
            calle: "",
            numero: "",
            piso: "",
            departamento: "",
            provincia: "",
            localidad: "",
            codigoPostal: "",
          },
          email: "",
          telefono: "",
          autocompletado: false,
          condicionLaboral: "",
          ingresoBruto: 0,
          ingresoNeto: 0,
          reciboSueldo: [],
          otrosDocumentos: [],
          empleadorCalle: "",
          empleadorLocalidad: "",
          empleadorCompaniaTelefonica: "",
          empleadorTelefono: "",
          banco: "",
          cbu: "",
        },
      ]),
    }));
  }, []);

  const actualizarPersona = useCallback(
    (tipo: TipoPersonaVinculada, id: string, patch: Partial<PersonaVinculada>) => {
      setApp((prev) => ({
        ...prev,
        postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
          lista.map((p) => (p.id === id ? { ...p, ...patch } : p))
        ),
      }));
    },
    []
  );

  // Domicilio de referencias y garantes (Onboarding §7–§8): mismos efectos de cascada que el
  // domicilio de Datos personales (provincia limpia localidad/CP si ya no corresponden;
  // localidad completa el código postal).
  const actualizarDomicilioPersona = useCallback(
    (tipo: TipoPersonaVinculada, id: string, campo: keyof Domicilio, valor: string) => {
      const valorSanitizado = sanitizarCampoDomicilio(campo, valor);
      setApp((prev) => ({
        ...prev,
        postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
          lista.map((p) =>
            p.id === id
              ? { ...p, domicilio: aplicarCambioDomicilio(p.domicilio, campo, valorSanitizado) }
              : p
          )
        ),
      }));
    },
    []
  );

  // Al ingresar el DNI se completan los datos por API, igual que en el pedido inicial.
  const buscarPersonaPorDni = useCallback((tipo: TipoPersonaVinculada, id: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
        lista.map((p) =>
          p.id === id ? { ...p, ...consultarPersonaMock(p.dni), autocompletado: true } : p
        )
      ),
    }));
  }, []);

  const quitarPersona = useCallback((tipo: TipoPersonaVinculada, id: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: conPersonas(prev.postOferta, tipo, (lista) => lista.filter((p) => p.id !== id)),
    }));
  }, []);

  // Recibo de sueldo del garante (Onboarding §8): demuestra capacidad de pago para firmar.
  const adjuntarReciboSueldo = useCallback((tipo: TipoPersonaVinculada, id: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
        lista.map((p) => {
          if (p.id !== id) return p;
          const archivo: ArchivoLegajo = {
            id: `recibo-${id}-${Date.now()}`,
            nombre: `recibo_sueldo_${p.reciboSueldo.length + 1}.jpg`,
            detalle: `1.1 MB · ${selloTiempo()}`,
          };
          return { ...p, reciboSueldo: [...p.reciboSueldo, archivo] };
        })
      ),
    }));
  }, []);

  const quitarReciboSueldo = useCallback(
    (tipo: TipoPersonaVinculada, id: string, archivoId: string) => {
      setApp((prev) => ({
        ...prev,
        postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
          lista.map((p) =>
            p.id === id
              ? { ...p, reciboSueldo: p.reciboSueldo.filter((a) => a.id !== archivoId) }
              : p
          )
        ),
      }));
    },
    []
  );

  // Otros documentos del garante (opcionales, se cargan en Legajo virtual).
  const adjuntarOtroDocumento = useCallback((tipo: TipoPersonaVinculada, id: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
        lista.map((p) => {
          if (p.id !== id) return p;
          const actual = p.otrosDocumentos ?? [];
          const archivo: ArchivoLegajo = {
            id: `otro-${id}-${Date.now()}`,
            nombre: `doc_garante_${actual.length + 1}.jpg`,
            detalle: `1.0 MB · ${selloTiempo()}`,
          };
          return { ...p, otrosDocumentos: [...actual, archivo] };
        })
      ),
    }));
  }, []);

  const quitarOtroDocumento = useCallback(
    (tipo: TipoPersonaVinculada, id: string, archivoId: string) => {
      setApp((prev) => ({
        ...prev,
        postOferta: conPersonas(prev.postOferta, tipo, (lista) =>
          lista.map((p) =>
            p.id === id
              ? { ...p, otrosDocumentos: (p.otrosDocumentos ?? []).filter((a) => a.id !== archivoId) }
              : p
          )
        ),
      }));
    },
    []
  );

  // --- Legajo virtual e impresión (Onboarding §9–§10) ---

  const adjuntarDocumento = useCallback((tipoId: string) => {
    setApp((prev) => {
      const actuales = prev.postOferta.legajo[tipoId] ?? [];
      const archivo: ArchivoLegajo = {
        id: `${tipoId}-${Date.now()}`,
        nombre: `${tipoId.replace(/-/g, "_")}_${actuales.length + 1}.jpg`,
        detalle: `1.2 MB · ${selloTiempo()}`,
      };
      return {
        ...prev,
        postOferta: {
          ...prev.postOferta,
          legajo: { ...prev.postOferta.legajo, [tipoId]: [...actuales, archivo] },
        },
      };
    });
  }, []);

  const quitarArchivo = useCallback((tipoId: string, archivoId: string) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        legajo: {
          ...prev.postOferta.legajo,
          [tipoId]: (prev.postOferta.legajo[tipoId] ?? []).filter((a) => a.id !== archivoId),
        },
      },
    }));
  }, []);

  // Imprimir o visualizar el PDF deja la pantalla completa y el documento disponible.
  const registrarLegajo = useCallback((accion: AccionLegajo) => {
    setApp((prev) => ({
      ...prev,
      postOferta: { ...prev.postOferta, impresion: { accion, fecha: selloTiempo() } },
    }));
  }, []);

  const visitarPantalla = useCallback((id: PantallaPostOfertaId) => {
    setApp((prev) =>
      prev.pantallasVisitadas.includes(id)
        ? prev
        : { ...prev, pantallasVisitadas: [...prev.pantallasVisitadas, id] }
    );
  }, []);

  // "Finalizar carga" (En trámite → Preaprobado), "Reenviar correcciones" (Observado →
  // Preaprobado) o reenvío con oferta del analista en juego (aceptada o elegida menor):
  // vuelve al analista en CAMBIO_OFERTA para que confirme la oferta final. Se conserva
  // el tope (ofertaAnalista) para poder comparar contra la oferta elegida.
  const finalizarCarga = useCallback(() => {
    setApp((prev) => {
      const tope = ofertaAnalistaDe(prev);
      return {
        ...prev,
        estado: tope !== null ? "CAMBIO_OFERTA" : "PREAPROBADO",
        etapa: "ENVIADA",
        fechaPreaprobacion: prev.fechaPreaprobacion ?? selloTiempo(),
        fechaEnvioAnalisis: selloTiempo(),
        analista: {
          ...prev.analista,
          tomado: false,
          reenviada: prev.estado === "OBSERVADO",
          observacionConfirmada: null,
          ofertaAnalista: tope,
        },
      };
    });
  }, []);

  const tomarAnalisis = useCallback(() => {
    setAppOperativo((prev) => ({
      ...prev,
      estado: "ANALISIS_TOMADO",
      analista: { ...prev.analista, tomado: true },
    }));
  }, []);

  // El analista leyó la observación de una solicitud reenviada: recién ahí puede operarla.
  const confirmarObservacion = useCallback(() => {
    setAppOperativo((prev) => ({
      ...prev,
      analista: { ...prev.analista, observacionConfirmada: { fecha: selloTiempo() } },
    }));
  }, []);

  // Observar devuelve la solicitud a la bandeja del canal de venta (Guía §7.3). El analista
  // indica qué pantalla hay que corregir para que el vendedor vaya derecho ahí (01:09).
  const observarCredito = useCallback(
    (
      motivo: string,
      nota: string,
      pantallas: PantallaPostOfertaId[],
      campos: Partial<Record<PantallaPostOfertaId, string[]>>
    ) => {
      setAppOperativo((prev) => ({
        ...prev,
        estado: "OBSERVADO",
        analista: {
          ...prev.analista,
          tomado: false,
          reenviada: false,
          pantallasCorregidas: [],
          cambioOfertaPendiente: null,
          ofertaAnalista: null,
          observacionConfirmada: null,
          ...conObservacion(prev, { motivo, nota, fecha: fechaHoy(), pantallas, campos }),
        },
      }));
    },
    []
  );

  // Anular: el cliente desistió. No es un rechazo de riesgo (reunión 11/09, 01:19).
  const anularCredito = useCallback((nota: string) => {
    setAppOperativo((prev) => ({
      ...prev,
      estado: "ANULADO",
      analista: {
        ...prev.analista,
        tomado: false,
        cambioOfertaPendiente: null,
        observacion: {
          motivo: "Anulada",
          nota,
          fecha: fechaHoy(),
          pantallas: [],
        },
      },
    }));
  }, []);

  // Comentario sobre la solicitud: lo dejan tanto el canal de venta como el analista.
  const agregarComentario = useCallback((texto: string, autor: string = SESION.nombre) => {
    setApp((prev) => ({
      ...prev,
      comentarios: [
        ...prev.comentarios,
        { id: `comentario-${Date.now()}`, autor, texto, fecha: selloTiempo() },
      ],
    }));
  }, []);

  // Soltar análisis: el analista devuelve la solicitud a la bandeja para que otro la tome.
  const soltarAnalisis = useCallback(() => {
    setAppOperativo((prev) => ({
      ...prev,
      estado: "PREAPROBADO",
      analista: { ...prev.analista, tomado: false, cambioOfertaPendiente: null },
    }));
  }, []);

  // Si el analista cambió la oferta, el vendedor retoma en la pantalla de oferta (última de la
  // originación) y no puede editar nada más: sólo aceptarla o elegir otra menor en la grilla.
  const retomarObservada = useCallback(() => {
    setApp((prev) => {
      const analista = ofertaAnalistaDe(prev);
      return {
        ...prev,
        // Con el tope ya fijado y aceptado, el vendedor sigue en la vista de sólo lectura.
        etapa: analista && !analista.aceptada ? "ORIGINACION" : "POST_OFERTA",
        analista: analista ? { ...prev.analista, ofertaAnalista: analista } : prev.analista,
      };
    });
  }, []);

  // El vendedor acepta la oferta (la del analista u otra menor de la grilla): el resto de la
  // solicitud se muestra completo y bloqueado, y sólo queda finalizar.
  const aceptarOfertaAnalista = useCallback(() => {
    setApp((prev) => {
      const analista = ofertaAnalistaDe(prev);
      if (!analista) return prev;
      return {
        ...prev,
        etapa: "POST_OFERTA",
        oferta: { ...prev.oferta, aceptada: true },
        analista: { ...prev.analista, ofertaAnalista: { ...analista, aceptada: true } },
      };
    });
  }, []);

  // Corrección puntual: el vendedor edita la pantalla observada, la guarda y recién ahí puede
  // enviar nuevamente. Volver a editarla la deja sin guardar.
  const guardarCorreccion = useCallback((pantalla: PantallaPostOfertaId) => {
    setApp((prev) =>
      prev.analista.pantallasCorregidas.includes(pantalla)
        ? prev
        : {
            ...prev,
            analista: {
              ...prev.analista,
              pantallasCorregidas: [...prev.analista.pantallasCorregidas, pantalla],
            },
          }
    );
  }, []);

  const reabrirCorreccion = useCallback((pantalla: PantallaPostOfertaId) => {
    setApp((prev) => ({
      ...prev,
      analista: {
        ...prev.analista,
        pantallasCorregidas: prev.analista.pantallasCorregidas.filter((p) => p !== pantalla),
      },
    }));
  }, []);

  const rechazarCredito = useCallback((codigo: string, motivo: string, observacion: string) => {
    setAppOperativo((prev) => ({
      ...prev,
      estado: "RECHAZADO",
      // Rechazar desde AFEL deja constancia en la firma que se estaba verificando.
      firmas:
        prev.estado === "FIRMADO" ? cerrarIntentoActual(prev.firmas, "RECHAZADA") : prev.firmas,
      rechazo: {
        // Un crédito en SUP lo rechaza el superior; el resto, el analista.
        origen: prev.estado === "SUPERIOR" ? "SUPERIOR" : "ANALISTA",
        codigos: [codigo],
        motivo,
        observacion,
        fecha: fechaHoy(),
      },
    }));
  }, []);

  const dejarAprobado = useCallback(() => {
    setAppOperativo((prev) =>
      prev.estado === "ANALISIS_TOMADO"
        ? {
            ...prev,
            estado: "APROBADO",
            fechaAprobacion: selloTiempo(),
          }
        : prev
    );
  }, []);

  // Aprobar el crédito ya no liquida: abre el tramo de firma. Con cualquier método (manual o
  // electrónica) entra a FEL: el cliente tiene que firmar.
  const aprobarCredito = useCallback((metodo?: MetodoFirma) => {
    setAppOperativo((prev) => {
      const m = metodo ?? metodoPorDefecto(modalidadFirma(prev.configuracion));
      return {
        ...prev,
        estado: "EN_FIRMA",
        // Desde Aprobado se conserva la fecha en que el analista aprobó.
        fechaAprobacion: prev.estado === "APROBADO" ? prev.fechaAprobacion : selloTiempo(),
        firmas: [{ n: 1, metodo: m, fechaFirma: null, resultado: "PENDIENTE", fechaResultado: null }],
        chequeoTelefonico: null,
      };
    });
  }, []);

  // FEL → AFEL: el cliente firmó, en papel o en línea (en la demo se simula con un botón).
  const registrarFirmaCliente = useCallback(() => {
    setAppOperativo((prev) => {
      const actual = intentoActual(prev.firmas);
      if (prev.estado !== "EN_FIRMA" || !actual) return prev;
      return {
        ...prev,
        estado: "FIRMADO",
        firmas: [...prev.firmas.slice(0, -1), { ...actual, fechaFirma: selloTiempo() }],
        firmaChequeada: false,
      };
    });
  }, []);

  // AFEL: el analista chequeó la firma con "Ver firma" y la confirma. Recién ahí se habilita
  // pasar a chequeo/liquidar o a SUP (creditonet-93); el rechazo usa el flujo existente de rechazarCredito.
  const confirmarChequeoFirma = useCallback(() => {
    setAppOperativo((prev) => (prev.estado === "FIRMADO" ? { ...prev, firmaChequeada: true } : prev));
  }, []);

  // AFEL: firma aprobada. Exige haber chequeado la firma primero (creditonet-93).
  const verificarFirma = useCallback(() => {
    setAppOperativo((prev) => {
      if (prev.estado !== "FIRMADO" || !prev.firmaChequeada) return prev;
      return pasoTrasFirma({ ...prev, firmas: cerrarIntentoActual(prev.firmas, "APROBADA") }, prev);
    });
  }, []);

  // AFEL → SUP: la firma se da por verificada y el crédito espera la aprobación de un superior.
  const enviarASuperior = useCallback(() => {
    setAppOperativo((prev) => {
      if (prev.estado !== "FIRMADO" || !prev.firmaChequeada) return prev;
      return {
        ...prev,
        estado: "SUPERIOR",
        firmas: cerrarIntentoActual(prev.firmas, "APROBADA"),
        aprobacionSuperior: {
          enviadaPor: SESION_ANALISTA.nombre,
          fechaEnvio: selloTiempo(),
          aprobadaPor: null,
          fechaAprobacion: null,
        },
      };
    });
  }, []);

  // SUP: el superior aprueba y el crédito sigue como después de AFEL.
  const aprobarSuperior = useCallback(() => {
    setAppOperativo((prev) => {
      if (prev.estado !== "SUPERIOR" || !prev.aprobacionSuperior) return prev;
      return pasoTrasFirma(
        {
          ...prev,
          aprobacionSuperior: {
            ...prev.aprobacionSuperior,
            aprobadaPor: SESION_SUPERVISOR.nombre,
            fechaAprobacion: selloTiempo(),
          },
        },
        prev
      );
    });
  }, []);

  // AFEL: refirma. Sólo una vez; con dos instancias en el historial no hace nada.
  const solicitarRefirma = useCallback(() => {
    setAppOperativo((prev) => {
      const actual = intentoActual(prev.firmas);
      if (prev.estado !== "FIRMADO" || !actual || !puedeRefirmar(prev.firmas)) return prev;
      return {
        ...prev,
        estado: "EN_FIRMA",
        firmas: [
          ...cerrarIntentoActual(prev.firmas, "REFIRMA_SOLICITADA"),
          { n: 2, metodo: actual.metodo, fechaFirma: null, resultado: "PENDIENTE", fechaResultado: null },
        ],
      };
    });
  }, []);

  // El chequeador toma (o suelta) el crédito pendiente de chequeo telefónico.
  const tomarChequeo = useCallback(() => {
    setApp((prev) =>
      prev.estado === "CHEQUEO_TELEFONICO" && prev.chequeoTelefonico
        ? { ...prev, chequeoTelefonico: { ...prev.chequeoTelefonico, tomado: true } }
        : prev
    );
  }, []);

  const soltarChequeo = useCallback(() => {
    setApp((prev) =>
      prev.estado === "CHEQUEO_TELEFONICO" && prev.chequeoTelefonico
        ? { ...prev, chequeoTelefonico: { ...prev.chequeoTelefonico, tomado: false } }
        : prev
    );
  }, []);

  // Observa el chequeo: sigue En chequeo telefónico, con la nota a la vista del canal de venta.
  const observarChequeo = useCallback((nota: string) => {
    setApp((prev) => {
      if (prev.estado !== "CHEQUEO_TELEFONICO" || !prev.chequeoTelefonico?.tomado) return prev;
      return {
        ...prev,
        chequeoTelefonico: {
          ...prev.chequeoTelefonico,
          tomado: false,
          observacion: { nota, fecha: selloTiempo() },
          intentos: [
            ...intentosChequeo(prev.chequeoTelefonico),
            { nota, fecha: selloTiempo() },
          ],
        },
      };
    });
  }, []);

  // Finaliza el chequeo. OK: pasa solo a liquidación, sin volver al analista. NO_OK: rechazo.
  const finalizarChequeo = useCallback((resultado: ResultadoChequeo, comentario: string) => {
    setApp((prev) => {
      if (prev.estado !== "CHEQUEO_TELEFONICO" || !prev.chequeoTelefonico?.tomado) return prev;
      const chequeo = { ...prev.chequeoTelefonico, tomado: true, resultado, comentario, fecha: selloTiempo() };
      if (resultado === "NO_OK") {
        return {
          ...prev,
          estado: "RECHAZADO",
          chequeoTelefonico: chequeo,
          rechazo: {
            origen: "CHEQUEADOR",
            codigos: ["CT-01"],
            motivo: "Chequeo telefónico no correcto",
            observacion: comentario,
            fecha: fechaHoy(),
          },
        };
      }
      const conChequeo = { ...prev, chequeoTelefonico: chequeo };
      return puedeLiquidar(conChequeo) ? { ...conChequeo, estado: "PARA_LIQUIDAR" } : prev;
    });
  }, []);


  // "Reiniciar demo" reinicia todas las pestañas: las demás lo reciben por RESET_KEY.
  const reiniciarDemo = useCallback(() => {
    reinicioLocal();
    try {
      localStorage.setItem(RESET_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  }, [reinicioLocal]);

  const value = useMemo<ApplicationContextValue>(
    () => ({
      app,
      creditosDB,
      cargarCreditoDeDB,
      paso,
      pasoMaximo,
      pantallaActual,
      menuAbierto,
      hidratado,
      setPaso,
      setPantallaActual,
      setMenuAbierto,
      patchApp,
      setTipoPersona,
      consultarCliente,
      patchCliente,
      patchLaboral,
      verificarIdentidad,
      registrarFirma,
      borrarFirma,
      solicitar,
      finalizarRiesgo,
      aplicarCambioOferta,
      autorizarExcepcionCambioOferta,
      aplicarCambioDatosFinancieros,
      patchOferta,
      togglePrecancelar,
      setDeudaTerceros,
      aceptarOferta,
      irAPostOferta,
      setCampo,
      enviarLinkWhatsApp,
      simularCompletaCliente,
      tokenizarPresencial,
      confirmarTarjetaGuardada,
      quitarTarjeta,
      agregarPersona,
      actualizarPersona,
      actualizarDomicilioPersona,
      buscarPersonaPorDni,
      quitarPersona,
      adjuntarReciboSueldo,
      quitarReciboSueldo,
      adjuntarOtroDocumento,
      quitarOtroDocumento,
      adjuntarDocumento,
      quitarArchivo,
      registrarLegajo,
      visitarPantalla,
      finalizarCarga,
      tomarAnalisis,
      confirmarObservacion,
      observarCredito,
      anularCredito,
      agregarComentario,
      soltarAnalisis,
      retomarObservada,
      aceptarOfertaAnalista,
      guardarCorreccion,
      reabrirCorreccion,
      rechazarCredito,
      aprobarCredito,
      dejarAprobado,
      registrarFirmaCliente,
      confirmarChequeoFirma,
      verificarFirma,
      enviarASuperior,
      aprobarSuperior,
      solicitarRefirma,
      tomarChequeo,
      soltarChequeo,
      finalizarChequeo,
      observarChequeo,
      reiniciarDemo,
    }),
    [
      app,
      creditosDB,
      cargarCreditoDeDB,
      paso,
      pasoMaximo,
      pantallaActual,
      menuAbierto,
      hidratado,
      setPaso,
      patchApp,
      setTipoPersona,
      consultarCliente,
      patchCliente,
      patchLaboral,
      verificarIdentidad,
      registrarFirma,
      borrarFirma,
      solicitar,
      finalizarRiesgo,
      aplicarCambioOferta,
      autorizarExcepcionCambioOferta,
      aplicarCambioDatosFinancieros,
      patchOferta,
      togglePrecancelar,
      setDeudaTerceros,
      aceptarOferta,
      irAPostOferta,
      setCampo,
      enviarLinkWhatsApp,
      simularCompletaCliente,
      tokenizarPresencial,
      confirmarTarjetaGuardada,
      quitarTarjeta,
      agregarPersona,
      actualizarPersona,
      actualizarDomicilioPersona,
      buscarPersonaPorDni,
      quitarPersona,
      adjuntarReciboSueldo,
      quitarReciboSueldo,
      adjuntarOtroDocumento,
      quitarOtroDocumento,
      adjuntarDocumento,
      quitarArchivo,
      registrarLegajo,
      visitarPantalla,
      finalizarCarga,
      tomarAnalisis,
      confirmarObservacion,
      observarCredito,
      anularCredito,
      agregarComentario,
      soltarAnalisis,
      retomarObservada,
      aceptarOfertaAnalista,
      guardarCorreccion,
      reabrirCorreccion,
      rechazarCredito,
      aprobarCredito,
      dejarAprobado,
      registrarFirmaCliente,
      confirmarChequeoFirma,
      verificarFirma,
      enviarASuperior,
      aprobarSuperior,
      solicitarRefirma,
      tomarChequeo,
      soltarChequeo,
      finalizarChequeo,
      observarChequeo,
      reiniciarDemo,
    ]
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext);
  if (!ctx) throw new Error("useApplication debe usarse dentro de AppProvider");
  return ctx;
}
