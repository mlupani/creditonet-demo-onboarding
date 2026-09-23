"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AccionLegajo,
  ArchivoLegajo,
  ClienteDatos,
  CreditApplication,
  DeudaTerceros,
  Domicilio,
  LaboralIngresos,
  Oferta,
  PantallaPostOfertaId,
  PersonaVinculada,
  Plazo,
  PostOferta,
  ReglaInstitucional,
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
import {
  CAPITAL_MAXIMO_BASE,
  CAPITAL_MAXIMO_CON_PRECANCELACION,
  calcularLimites,
  conMoraCancelada,
  recalcularOferta,
} from "./credit";
import { reglaBloquea } from "./motores";
import { institucionalesBloquean } from "./reglas-institucionales";
import {
  aplicarCambioCampo,
  aplicarCambioDomicilio,
  sanitizarCampoDomicilio,
  type PantallaConCampos,
} from "./campos-post-oferta";
import { fechaHoy, onlyDigits, selloTiempo } from "./format";
import { formatTelefono } from "./telefono";
import { BANCOS } from "./parametros";
import { PLANES_CUOTAS, SESION, SESION_ANALISTA, SESION_SUPERVISOR } from "./config";
import { hidratarProductos } from "./productos";
import { hidratarPlanes } from "./planes";
import { hidratarOrganismos } from "./organismos";

// Plazo de la oferta dentro de la grilla del plan; si el plan no lo tiene, el primero de la grilla.
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

const STORAGE_KEY = "creditonet.demo.v19";

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
  ingresoBruto: number;
  ingresoNeto: number;
  nota: string;
}

interface ApplicationContextValue {
  app: CreditApplication;
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
  // Cambio de oferta del analista: requiere refrendación del supervisor para regir.
  proponerCambioOferta: (cambio: CambioOferta) => void;
  refrendarCambioOferta: () => void;
  rechazarCambioOferta: () => void;

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
  guardarCorreccion: (pantalla: PantallaPostOfertaId) => void;
  reabrirCorreccion: (pantalla: PantallaPostOfertaId) => void;
  rechazarCredito: (codigo: string, motivo: string, observacion: string) => void;
  aprobarCredito: () => void;

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
            setApp(appPersistida as CreditApplication);
          }
          if (typeof parsed.paso === "number") setPasoState(parsed.paso);
          if (typeof parsed.pasoMaximo === "number") setPasoMaximo(parsed.pasoMaximo);
          if (parsed.pantallaActual) setPantallaActual(parsed.pantallaActual);
        }
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
        JSON.stringify({ app, paso, pasoMaximo, pantallaActual } satisfies EstadoPersistido)
      );
    } catch {
      /* noop */
    }
  }, [app, paso, pasoMaximo, pantallaActual, hidratado]);

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
    setApp((prev) => ({
      ...prev,
      numeroCredito: prev.numeroCredito ?? "CR-000184",
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
  // El cambio no rige al proponerlo: queda pendiente hasta que lo refrende el supervisor.
  const proponerCambioOferta = useCallback((cambio: CambioOferta) => {
    setApp((prev) => ({
      ...prev,
      analista: {
        ...prev.analista,
        cambioOfertaPendiente: {
          montoSolicitado: cambio.montoSolicitado,
          plazo: cambio.plazo,
          ingresoBruto: cambio.ingresoBruto,
          ingresoNeto: cambio.ingresoNeto,
          nota: cambio.nota,
          fecha: selloTiempo(),
          solicitadoPor: SESION_ANALISTA.nombre,
        },
      },
    }));
  }, []);

  const refrendarCambioOferta = useCallback(() => {
    setApp((prev) => {
      const cambio = prev.analista.cambioOfertaPendiente;
      if (!cambio) return prev;
      return {
        ...prev,
        estado: "OBSERVADO",
        laboral: {
          ...prev.laboral,
          ingresoBruto: cambio.ingresoBruto,
          ingresoNeto: cambio.ingresoNeto,
        },
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
          cambioOfertaPendiente: null,
          observacion: {
            motivo: "Cambio de oferta del analista",
            nota: `${cambio.nota} (refrendado por ${SESION_SUPERVISOR.nombre})`,
            fecha: fechaHoy(),
            pantallas: [],
          },
        },
      };
    });
  }, []);

  const rechazarCambioOferta = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      analista: { ...prev.analista, cambioOfertaPendiente: null },
    }));
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

  // "Finalizar carga" (En trámite → Preaprobado) o "Reenviar correcciones" (Observado →
  // Preaprobado). Preaprobado es lo que manda la solicitud a la bandeja del analista.
  const finalizarCarga = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "PREAPROBADO",
      etapa: "ENVIADA",
      fechaPreaprobacion: prev.fechaPreaprobacion ?? selloTiempo(),
      fechaEnvioAnalisis: selloTiempo(),
      analista: {
        ...prev.analista,
        tomado: false,
        reenviada: prev.estado === "OBSERVADO",
      },
    }));
  }, []);

  const tomarAnalisis = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "ANALISIS_TOMADO",
      analista: { ...prev.analista, tomado: true },
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
      setApp((prev) => ({
        ...prev,
        estado: "OBSERVADO",
        analista: {
          ...prev.analista,
          tomado: false,
          reenviada: false,
          pantallasCorregidas: [],
          cambioOfertaPendiente: null,
          observacion: { motivo, nota, fecha: fechaHoy(), pantallas, campos },
        },
      }));
    },
    []
  );

  // Anular: el cliente desistió. No es un rechazo de riesgo (reunión 11/09, 01:19).
  const anularCredito = useCallback((nota: string) => {
    setApp((prev) => ({
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
    setApp((prev) => ({
      ...prev,
      estado: "PREAPROBADO",
      analista: { ...prev.analista, tomado: false, cambioOfertaPendiente: null },
    }));
  }, []);

  const retomarObservada = useCallback(() => {
    setApp((prev) => ({ ...prev, etapa: "POST_OFERTA" }));
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
    setApp((prev) => ({
      ...prev,
      estado: "RECHAZADO",
      rechazo: { origen: "ANALISTA", codigos: [codigo], motivo, observacion, fecha: fechaHoy() },
    }));
  }, []);

  const aprobarCredito = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "PARA_LIQUIDAR",
      fechaAprobacion: selloTiempo(),
    }));
  }, []);

  const reiniciarDemo = useCallback(() => {
    setApp(crearAplicacionInicial());
    setPasoState(1);
    setPasoMaximo(1);
    setPantallaActual("personales");
    setMenuAbierto(false);
  }, []);

  const value = useMemo<ApplicationContextValue>(
    () => ({
      app,
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
      proponerCambioOferta,
      refrendarCambioOferta,
      rechazarCambioOferta,
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
      observarCredito,
      anularCredito,
      agregarComentario,
      soltarAnalisis,
      retomarObservada,
      guardarCorreccion,
      reabrirCorreccion,
      rechazarCredito,
      aprobarCredito,
      reiniciarDemo,
    }),
    [
      app,
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
      proponerCambioOferta,
      refrendarCambioOferta,
      rechazarCambioOferta,
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
      observarCredito,
      anularCredito,
      agregarComentario,
      soltarAnalisis,
      retomarObservada,
      guardarCorreccion,
      reabrirCorreccion,
      rechazarCredito,
      aprobarCredito,
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
